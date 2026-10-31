begin;
select plan(17);

-- Feature 009 (20261031000100_remittance_financials.sql): each remittance stores allowance 4000
-- and deposit = active payments - allowance; payments can't take the total above the rental;
-- already-overpaid records keep their payments but accept no new ones.

insert into public.units (id, body_number, plate_number, make_model)
values ('00000000-0000-0000-0000-000000270101', 'FIN-270-A', 'FIN270A', 'Test Tricycle');
insert into public.drivers (id, full_name, license_number, license_expiry_date, phone)
values ('00000000-0000-0000-0000-000000270201', 'Financials Driver', 'FIN-270-L1', '2035-12-31', '09170000270');
insert into public.driver_assignments (id, unit_id, driver_id, assignment_type, starts_on)
values ('00000000-0000-0000-0000-000000270301', '00000000-0000-0000-0000-000000270101', '00000000-0000-0000-0000-000000270201', 'primary', '2031-08-01');
insert into public.remittances (id, assignment_id, unit_id, driver_id, service_date, disposition, idempotency_key)
values
  ('00000000-0000-0000-0000-000000270401', '00000000-0000-0000-0000-000000270301', '00000000-0000-0000-0000-000000270101',
   '00000000-0000-0000-0000-000000270201', '2031-08-01', 'returned', gen_random_uuid()),
  ('00000000-0000-0000-0000-000000270402', '00000000-0000-0000-0000-000000270301', '00000000-0000-0000-0000-000000270101',
   '00000000-0000-0000-0000-000000270201', '2031-08-02', 'returned', gen_random_uuid());

select is((select array[allowance_centavos, deposit_centavos] from public.remittances where id = '00000000-0000-0000-0000-000000270401'),
  array[4000, -4000]::bigint[], 'a new remittance gets allowance 4000 and deposit -4000');

insert into public.remittance_payments (id, remittance_id, amount_centavos, idempotency_key)
values ('00000000-0000-0000-0000-000000270501', '00000000-0000-0000-0000-000000270401', 10000, gen_random_uuid());
select is((select deposit_centavos from public.remittances where id = '00000000-0000-0000-0000-000000270401'),
  6000::bigint, 'a 10,000 payment gives deposit 6,000');

insert into public.remittance_payments (id, remittance_id, amount_centavos, idempotency_key)
values ('00000000-0000-0000-0000-000000270502', '00000000-0000-0000-0000-000000270401', 8000, gen_random_uuid());
select is((select deposit_centavos from public.remittances where id = '00000000-0000-0000-0000-000000270401'),
  14000::bigint, 'paying the rest gives deposit 14,000');

update public.remittance_payments set deleted_at = now() where id = '00000000-0000-0000-0000-000000270502';
select is((select deposit_centavos from public.remittances where id = '00000000-0000-0000-0000-000000270401'),
  6000::bigint, 'voiding a payment recalculates the deposit');

select throws_ok($$insert into public.remittance_payments (remittance_id, amount_centavos, idempotency_key)
  values ('00000000-0000-0000-0000-000000270401', 8001, gen_random_uuid())$$,
  '23514', 'Payment can''t exceed the rental of ₱180.00. At most ₱80.00 more can be recorded.',
  'a payment above the remaining rental is rejected with a plain message');

insert into public.remittance_payments (remittance_id, amount_centavos, idempotency_key)
values ('00000000-0000-0000-0000-000000270401', 8000, gen_random_uuid());
select throws_ok($$update public.remittance_payments set deleted_at = null where id = '00000000-0000-0000-0000-000000270502'$$,
  '23514', null, 'restoring a voided payment that would exceed the rental is rejected');
select throws_ok($$update public.remittance_payments set amount_centavos = 10001 where id = '00000000-0000-0000-0000-000000270501'$$,
  '23514', null, 'raising a payment above the rental is rejected');

-- A legacy overpaid record, written as it could have been before this migration.
alter table public.remittance_payments disable trigger remittance_payments_validate;
insert into public.remittance_payments (remittance_id, amount_centavos, idempotency_key)
values ('00000000-0000-0000-0000-000000270402', 20000, gen_random_uuid());
alter table public.remittance_payments enable trigger remittance_payments_validate;
select is((select deposit_centavos from public.remittances where id = '00000000-0000-0000-0000-000000270402'),
  16000::bigint, 'an overpaid record keeps its payment, with deposit = paid - 4000');
select throws_ok($$insert into public.remittance_payments (remittance_id, amount_centavos, idempotency_key)
  values ('00000000-0000-0000-0000-000000270402', 100, gen_random_uuid())$$,
  '23514', null, 'an overpaid record accepts no new payment');

select throws_ok($$update public.remittances set allowance_centavos = 5000 where id = '00000000-0000-0000-0000-000000270401'$$,
  '23514', null, 'the allowance cannot be changed after save');
update public.remittances set deposit_centavos = 999 where id = '00000000-0000-0000-0000-000000270401';
select is((select deposit_centavos from public.remittances where id = '00000000-0000-0000-0000-000000270401'),
  14000::bigint, 'a direct deposit write is replaced by the formula');
select lives_ok($$update public.remittances set notes = 'still editable' where id = '00000000-0000-0000-0000-000000270401'$$,
  'notes stay editable');

-- Backfill invariants (the before/after updated_at snapshot is taken around the push).
select is((select count(*)::int from public.remittances where allowance_centavos <> 4000), 0,
  'every remittance has allowance 4000');
select is((select count(*)::int from public.remittances r
  where r.deposit_centavos <> coalesce((select sum(p.amount_centavos) from public.remittance_payments p
    where p.remittance_id = r.id and p.deleted_at is null), 0) - r.allowance_centavos), 0,
  'every remittance has deposit = active payments - allowance');

select has_index('public', 'remittances', 'remittances_service_date_idx', 'the service-date index exists');
select ok(not has_function_privilege('authenticated', 'public.remittances_set_deposit()', 'execute')
  and not has_function_privilege('anon', 'public.remittances_set_deposit()', 'execute'),
  'remittances_set_deposit is not executable by anon or authenticated');
select ok(not has_function_privilege('authenticated', 'public.remittance_payments_sync_deposit()', 'execute')
  and not has_function_privilege('anon', 'public.remittance_payments_sync_deposit()', 'execute'),
  'remittance_payments_sync_deposit is not executable by anon or authenticated');

select finish();
rollback;
