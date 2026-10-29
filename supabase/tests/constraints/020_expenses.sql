begin;
select plan(27);

-- FR-017 / FR-018: expenses and expense categories accept valid rows and reject invalid ones.
-- Receipt path ownership (T119) is covered in 160_receipt_path_ownership.sql and owner-only
-- soft delete (T121) in rls/190_owner_soft_delete_rls.sql.

insert into auth.users (id, email, aud, role)
values
  ('00000000-0000-0000-0000-000000020001', 'expense-owner@rolnet.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000020002', 'expense-staff@rolnet.test', 'authenticated', 'authenticated');
update public.profiles
set role = 'owner', account_status = 'approved', approved_at = now(), approved_by = user_id
where user_id = '00000000-0000-0000-0000-000000020001';
update public.profiles
set account_status = 'approved', approved_at = now(), approved_by = '00000000-0000-0000-0000-000000020001'
where user_id = '00000000-0000-0000-0000-000000020002';

insert into public.units (id, body_number, plate_number, make_model)
values ('00000000-0000-0000-0000-000000020101', 'EXP-020-A', 'EXP020A', 'Test Tricycle');
insert into public.expense_categories (id, name)
values ('00000000-0000-0000-0000-000000020201', 'Expense Misc 020');
select set_config('test.fuel_id', (select id::text from public.expense_categories where system_key = 'fuel' and is_system and deleted_at is null), true);
select set_config('test.idem', gen_random_uuid()::text, true);

-- Structure the queries rely on.
select has_index('public', 'expenses', 'expenses_unit_date_idx', 'expenses are indexed by unit and date');
select has_index('public', 'expenses', 'expenses_category_idx', 'expenses are indexed by category');

-- Approved staff record expenses (operational path).
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000020002","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(format($$insert into public.expenses (id, unit_id, category_id, expense_date, amount_centavos, idempotency_key)
  values ('00000000-0000-0000-0000-000000020301', '00000000-0000-0000-0000-000000020101', %L, '2031-03-01', 50000, %L)$$,
  current_setting('test.fuel_id'), current_setting('test.idem')), 'staff record a valid expense');
select is((select amount_centavos from public.expenses where id = '00000000-0000-0000-0000-000000020301'), 50000::bigint, 'the amount is stored in centavos');
select is((select created_by from public.expenses where id = '00000000-0000-0000-0000-000000020301'), '00000000-0000-0000-0000-000000020002'::uuid, 'the creator is recorded');
select throws_ok($$insert into public.expenses (unit_id, category_id, expense_date, amount_centavos, idempotency_key)
  values ('00000000-0000-0000-0000-000000020101', '00000000-0000-0000-0000-000000020201', '2031-03-01', 0, gen_random_uuid())$$,
  '23514', null, 'a zero amount is rejected');
select throws_ok($$insert into public.expenses (unit_id, category_id, expense_date, amount_centavos, idempotency_key)
  values ('00000000-0000-0000-0000-000000020101', '00000000-0000-0000-0000-000000020201', '2031-03-01', -100, gen_random_uuid())$$,
  '23514', null, 'a negative amount is rejected');
select throws_ok($$insert into public.expenses (unit_id, category_id, expense_date, amount_centavos, idempotency_key)
  values ('00000000-0000-0000-0000-000000020101', '00000000-0000-0000-0000-000000020201', '2031-03-01', 100, null)$$,
  '23502', null, 'an idempotency key is required');
select throws_ok(format($$insert into public.expenses (unit_id, category_id, expense_date, amount_centavos, idempotency_key)
  values ('00000000-0000-0000-0000-000000020101', '00000000-0000-0000-0000-000000020201', '2031-03-02', 100, %L)$$, current_setting('test.idem')),
  '23505', null, 'a repeated idempotency key is rejected');
select throws_ok($$insert into public.expenses (unit_id, category_id, expense_date, amount_centavos, idempotency_key)
  values ('00000000-0000-0000-0000-000000020101', '00000000-0000-0000-0000-000000020201', null, 100, gen_random_uuid())$$,
  '23502', null, 'an expense date is required');
select throws_ok($$insert into public.expenses (unit_id, category_id, expense_date, amount_centavos, idempotency_key)
  values ('00000000-0000-0000-0000-000000020101', gen_random_uuid(), '2031-03-01', 100, gen_random_uuid())$$,
  '23503', null, 'an unknown category is rejected');
select throws_ok($$insert into public.expenses (unit_id, category_id, expense_date, amount_centavos, idempotency_key)
  values (gen_random_uuid(), '00000000-0000-0000-0000-000000020201', '2031-03-01', 100, gen_random_uuid())$$,
  '23503', null, 'an unknown unit is rejected');

-- Receipt metadata is all-or-nothing and limited to small images.
select throws_ok($$update public.expenses set receipt_object_path = 'receipts/00000000-0000-0000-0000-000000020301/r.webp'
  where id = '00000000-0000-0000-0000-000000020301'$$, '23514', null, 'a receipt path without its metadata is rejected');
select throws_ok($$update public.expenses set receipt_object_path = 'receipts/00000000-0000-0000-0000-000000020301/r.pdf',
  receipt_mime_type = 'application/pdf', receipt_size_bytes = 1000, receipt_sha256 = 'abc'
  where id = '00000000-0000-0000-0000-000000020301'$$, '23514', null, 'a non-image receipt is rejected');
select throws_ok($$update public.expenses set receipt_object_path = 'receipts/00000000-0000-0000-0000-000000020301/r.jpg',
  receipt_mime_type = 'image/jpeg', receipt_size_bytes = 512001, receipt_sha256 = 'abc'
  where id = '00000000-0000-0000-0000-000000020301'$$, '23514', null, 'a receipt over 500 KB is rejected');
select lives_ok($$update public.expenses set receipt_object_path = 'receipts/00000000-0000-0000-0000-000000020301/r.jpg',
  receipt_mime_type = 'image/jpeg', receipt_size_bytes = 512000, receipt_sha256 = 'abc', notes = 'with receipt'
  where id = '00000000-0000-0000-0000-000000020301'$$, 'a 500 KB image receipt is accepted');
select is((select updated_by from public.expenses where id = '00000000-0000-0000-0000-000000020301'), '00000000-0000-0000-0000-000000020002'::uuid, 'the editor is recorded');
reset role;

-- Hard deletes are rejected even for a role that bypasses RLS.
select throws_ok($$delete from public.expenses where id = '00000000-0000-0000-0000-000000020301'$$, '23514', null, 'expenses cannot be hard-deleted');
select throws_ok($$delete from public.expense_categories where id = '00000000-0000-0000-0000-000000020201'$$, '23514', null, 'categories cannot be hard-deleted');
select throws_ok($$insert into public.expense_categories (name, is_system) values ('System Without Key 020', true)$$,
  '23514', null, 'a built-in category needs a system key');

-- The owner manages categories.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000020001","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$insert into public.expense_categories (name) values ('  expense misc 020 ')$$, '23505', null, 'category names are unique ignoring case and spaces');
select throws_ok($$insert into public.expense_categories (name) values ('   ')$$, '23514', null, 'a blank category name is rejected');
select lives_ok($$update public.expense_categories set name = 'Expense Tolls 020' where id = '00000000-0000-0000-0000-000000020201'$$, 'the owner renames a custom category');
select is((select name from public.expense_categories where id = '00000000-0000-0000-0000-000000020201'), 'Expense Tolls 020', 'the new name is saved');
update public.expense_categories set name = 'Gasoline' where id = current_setting('test.fuel_id')::uuid;
select is((select name from public.expense_categories where id = current_setting('test.fuel_id')::uuid), 'Fuel', 'built-in categories cannot be renamed');
reset role;

-- Receipt bucket settings (FR-017: private, images up to 500 KB).
select is((select public from storage.buckets where id = 'receipts'), false, 'the receipt bucket is private');
select is((select file_size_limit from storage.buckets where id = 'receipts'), 512000::bigint, 'the receipt bucket limits files to 500 KB');

select finish();
rollback;
