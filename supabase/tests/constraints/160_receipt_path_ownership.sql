begin;
select plan(5);

-- T119 (FR-017): an expense's receipt metadata must point at its own receipts/<expense id>/ folder.

insert into auth.users (id, email, aud, role)
values ('00000000-0000-0000-0000-000000160002', 'receipt-staff@rolnet.test', 'authenticated', 'authenticated');
update public.profiles
set account_status = 'approved', approved_at = now(), approved_by = user_id
where user_id = '00000000-0000-0000-0000-000000160002';

insert into public.units (id, body_number, plate_number, make_model)
values ('00000000-0000-0000-0000-000000160101', 'RCPT-160-A', 'RCP160A', 'Test Tricycle');
insert into public.expenses (id, unit_id, category_id, expense_date, amount_centavos, idempotency_key)
select x.id, '00000000-0000-0000-0000-000000160101', c.id, '2031-02-01', 50000, gen_random_uuid()
from public.expense_categories c,
  (values ('00000000-0000-0000-0000-000000160401'::uuid), ('00000000-0000-0000-0000-000000160402'::uuid)) as x(id)
where c.system_key = 'fuel' and c.deleted_at is null;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000160002","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$update public.expenses set receipt_object_path = 'receipts/00000000-0000-0000-0000-000000160402/a.webp',
  receipt_mime_type = 'image/webp', receipt_size_bytes = 1000, receipt_sha256 = 'abc'
  where id = '00000000-0000-0000-0000-000000160401'$$, '23514', null, 'an expense cannot use another expense''s receipt');
select throws_ok($$update public.expenses set receipt_object_path = 'elsewhere/00000000-0000-0000-0000-000000160401/a.webp',
  receipt_mime_type = 'image/webp', receipt_size_bytes = 1000, receipt_sha256 = 'abc'
  where id = '00000000-0000-0000-0000-000000160401'$$, '23514', null, 'a receipt outside the receipts folder is rejected');
select throws_ok($$update public.expenses set receipt_object_path = 'receipts/00000000-0000-0000-0000-000000160401/sub/a.webp',
  receipt_mime_type = 'image/webp', receipt_size_bytes = 1000, receipt_sha256 = 'abc'
  where id = '00000000-0000-0000-0000-000000160401'$$, '23514', null, 'a receipt in a nested folder is rejected');
select lives_ok($$update public.expenses set receipt_object_path = 'receipts/00000000-0000-0000-0000-000000160401/a.webp',
  receipt_mime_type = 'image/webp', receipt_size_bytes = 1000, receipt_sha256 = 'abc'
  where id = '00000000-0000-0000-0000-000000160401'$$, 'an expense can use a receipt in its own folder');
select is((select receipt_object_path from public.expenses where id = '00000000-0000-0000-0000-000000160401'),
  'receipts/00000000-0000-0000-0000-000000160401/a.webp', 'the receipt path is saved');
reset role;

select finish();
rollback;
