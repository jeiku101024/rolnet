begin;
select plan(28);

-- FR-017 / FR-018: who can read and write expenses, categories and receipt files.
-- Anon is denied outright, pending users see nothing, approved staff record expenses and receipts,
-- and only the owner manages categories. Staff soft-delete denial is in 190_owner_soft_delete_rls.sql.

insert into auth.users (id, email, aud, role)
values
  ('00000000-0000-0000-0000-000000025001', 'exprls-owner@rolnet.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000025002', 'exprls-staff@rolnet.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000025003', 'exprls-pending@rolnet.test', 'authenticated', 'authenticated');
update public.profiles
set role = 'owner', account_status = 'approved', approved_at = now(), approved_by = user_id
where user_id = '00000000-0000-0000-0000-000000025001';
update public.profiles
set account_status = 'approved', approved_at = now(), approved_by = '00000000-0000-0000-0000-000000025001'
where user_id = '00000000-0000-0000-0000-000000025002';

insert into public.units (id, body_number, plate_number, make_model)
values ('00000000-0000-0000-0000-000000025101', 'EXR-025-A', 'EXR025A', 'Test Tricycle');
insert into public.expense_categories (id, name)
values ('00000000-0000-0000-0000-000000025201', 'Expense RLS Misc 025');
insert into public.expenses (id, unit_id, category_id, expense_date, amount_centavos, idempotency_key, deleted_at)
values
  ('00000000-0000-0000-0000-000000025301', '00000000-0000-0000-0000-000000025101', '00000000-0000-0000-0000-000000025201', '2031-03-01', 50000, gen_random_uuid(), null),
  ('00000000-0000-0000-0000-000000025302', '00000000-0000-0000-0000-000000025101', '00000000-0000-0000-0000-000000025201', '2031-03-02', 60000, gen_random_uuid(), now());
insert into storage.objects (bucket_id, name)
values
  ('receipts', 'receipts/00000000-0000-0000-0000-000000025301/r.webp'),
  ('receipts', 'receipts/00000000-0000-0000-0000-000000025302/r.webp');

select policies_are('public', 'expense_categories', array['expense_categories_staff_read_policy', 'expense_categories_owner_insert_policy', 'expense_categories_owner_update_policy'], 'category RLS policies exist');
select policies_are('public', 'expenses', array['expenses_staff_read_policy', 'expenses_operational_insert_policy', 'expenses_operational_update_policy'], 'expense RLS policies exist');
-- storage.objects is shared with the documents bucket, so compare only the receipts_* policies.
select set_eq(
  $$select policyname::text from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like 'receipts\_%'$$,
  array['receipts_staff_read_policy', 'receipts_staff_insert_policy', 'receipts_owner_delete_policy'],
  'receipt storage policies exist'
);

-- Signed-out visitor.
set local role anon;
select throws_ok($$select 1 from public.expenses$$, '42501', null, 'anon cannot read expenses');
select throws_ok($$insert into public.expenses (unit_id, category_id, expense_date, amount_centavos, idempotency_key)
  values ('00000000-0000-0000-0000-000000025101', '00000000-0000-0000-0000-000000025201', '2031-03-03', 100, gen_random_uuid())$$,
  '42501', null, 'anon cannot record expenses');
select throws_ok($$select 1 from public.expense_categories$$, '42501', null, 'anon cannot read categories');
select is_empty($$select 1 from storage.objects where bucket_id = 'receipts'$$, 'anon cannot list receipt files');
reset role;

-- Signed-in user whose registration is still pending.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000025003","role":"authenticated"}', true);
set local role authenticated;
select is_empty($$select 1 from public.expenses where unit_id = '00000000-0000-0000-0000-000000025101'$$, 'a pending user sees no expenses');
select is_empty($$select 1 from public.expense_categories$$, 'a pending user sees no categories');
select throws_ok($$insert into public.expenses (unit_id, category_id, expense_date, amount_centavos, idempotency_key)
  values ('00000000-0000-0000-0000-000000025101', '00000000-0000-0000-0000-000000025201', '2031-03-03', 100, gen_random_uuid())$$,
  '42501', null, 'a pending user cannot record expenses');
select is_empty($$select 1 from storage.objects where bucket_id = 'receipts' and name like 'receipts/00000000-0000-0000-0000-00000002530_/%'$$, 'a pending user sees no receipt files');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('receipts', 'receipts/00000000-0000-0000-0000-000000025301/p.webp')$$,
  '42501', null, 'a pending user cannot upload receipts');
reset role;

-- Approved staff.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000025002","role":"authenticated"}', true);
set local role authenticated;
select isnt_empty($$select 1 from public.expenses where id = '00000000-0000-0000-0000-000000025301'$$, 'staff read current expenses');
select is_empty($$select 1 from public.expenses where id = '00000000-0000-0000-0000-000000025302'$$, 'staff do not see soft-deleted expenses');
select is((select count(*) from public.expense_categories where is_system and system_key in ('fuel', 'repairs', 'registration', 'insurance')), 4::bigint, 'staff read the built-in categories');
select lives_ok($$insert into public.expenses (unit_id, category_id, expense_date, amount_centavos, idempotency_key)
  values ('00000000-0000-0000-0000-000000025101', '00000000-0000-0000-0000-000000025201', '2031-03-03', 100, gen_random_uuid())$$,
  'staff record expenses');
select lives_ok($$update public.expenses set notes = 'staff note' where id = '00000000-0000-0000-0000-000000025301'$$, 'staff edit expenses');
select throws_ok($$insert into public.expense_categories (name) values ('Staff Category 025')$$, '42501', null, 'staff cannot create categories');
update public.expense_categories set name = 'Staff Rename 025' where id = '00000000-0000-0000-0000-000000025201';
select is((select name from public.expense_categories where id = '00000000-0000-0000-0000-000000025201'), 'Expense RLS Misc 025', 'staff cannot rename categories');
select isnt_empty($$select 1 from storage.objects where bucket_id = 'receipts' and name = 'receipts/00000000-0000-0000-0000-000000025301/r.webp'$$, 'staff read the receipt of a current expense');
select is_empty($$select 1 from storage.objects where bucket_id = 'receipts' and name = 'receipts/00000000-0000-0000-0000-000000025302/r.webp'$$, 'staff cannot read the receipt of a soft-deleted expense');
select lives_ok($$insert into storage.objects (bucket_id, name) values ('receipts', 'receipts/00000000-0000-0000-0000-000000025301/s.webp')$$, 'staff upload a receipt into the expense''s folder');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('receipts', 'receipts/' || gen_random_uuid() || '/s.webp')$$,
  '42501', null, 'staff cannot upload a receipt for an unknown expense');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('receipts', 'other/00000000-0000-0000-0000-000000025301/s.webp')$$,
  '42501', null, 'staff cannot upload outside the receipts folder');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('receipts', 'receipts/00000000-0000-0000-0000-000000025302/s.webp')$$,
  '42501', null, 'staff cannot upload a receipt for a soft-deleted expense');
reset role;

-- Approved owner.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000025001","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$insert into public.expense_categories (name) values ('Owner Category 025')$$, 'the owner creates categories');
select lives_ok($$update public.expense_categories set name = 'Owner Rename 025' where id = '00000000-0000-0000-0000-000000025201'$$, 'the owner renames categories');
select is((select name from public.expense_categories where id = '00000000-0000-0000-0000-000000025201'), 'Owner Rename 025', 'the owner''s rename is saved');
reset role;

select finish();
rollback;
