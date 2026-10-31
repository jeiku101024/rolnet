begin;
select plan(7);

-- Feature 009: staff can record a payment within the rental (the deposit trigger updates the
-- parent under their RLS), and nobody can set the stored allowance or deposit directly.

insert into auth.users (id, email, aud, role)
values
  ('00000000-0000-0000-0000-000000200001', 'fin-owner@rolnet.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000200002', 'fin-staff@rolnet.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000200003', 'fin-pending@rolnet.test', 'authenticated', 'authenticated');
update public.profiles
set role = 'owner', account_status = 'approved', approved_at = now(), approved_by = user_id
where user_id = '00000000-0000-0000-0000-000000200001';
update public.profiles
set account_status = 'approved', approved_at = now(), approved_by = '00000000-0000-0000-0000-000000200001'
where user_id = '00000000-0000-0000-0000-000000200002';

insert into public.units (id, body_number, plate_number, make_model)
values ('00000000-0000-0000-0000-000000200101', 'FIN-200-A', 'FIN200A', 'Test Tricycle');
insert into public.drivers (id, full_name, license_number, license_expiry_date, phone)
values ('00000000-0000-0000-0000-000000200201', 'Financials RLS Driver', 'FIN-200-L1', '2035-12-31', '09170000200');
insert into public.driver_assignments (id, unit_id, driver_id, assignment_type, starts_on)
values ('00000000-0000-0000-0000-000000200301', '00000000-0000-0000-0000-000000200101', '00000000-0000-0000-0000-000000200201', 'primary', '2031-09-01');
insert into public.remittances (id, assignment_id, unit_id, driver_id, service_date, disposition, idempotency_key)
values ('00000000-0000-0000-0000-000000200401', '00000000-0000-0000-0000-000000200301', '00000000-0000-0000-0000-000000200101',
        '00000000-0000-0000-0000-000000200201', '2031-09-01', 'returned', gen_random_uuid());

-- Approved staff.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000200002","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$insert into public.remittance_payments (remittance_id, amount_centavos, idempotency_key)
  values ('00000000-0000-0000-0000-000000200401', 10000, gen_random_uuid())$$,
  'staff can record a payment within the rental');
select is((select deposit_centavos from public.remittances where id = '00000000-0000-0000-0000-000000200401'),
  6000::bigint, 'the staff payment updates the stored deposit');
select throws_ok($$insert into public.remittance_payments (remittance_id, amount_centavos, idempotency_key)
  values ('00000000-0000-0000-0000-000000200401', 9000, gen_random_uuid())$$,
  '23514', null, 'staff cannot record a payment above the rental');
update public.remittances set deposit_centavos = 999999 where id = '00000000-0000-0000-0000-000000200401';
select is((select deposit_centavos from public.remittances where id = '00000000-0000-0000-0000-000000200401'),
  6000::bigint, 'a staff write to the deposit is replaced by the formula');
reset role;

-- Approved owner.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000200001","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$update public.remittances set allowance_centavos = 0 where id = '00000000-0000-0000-0000-000000200401'$$,
  '23514', null, 'the owner cannot change the allowance');
update public.remittances set deposit_centavos = -1 where id = '00000000-0000-0000-0000-000000200401';
select is((select deposit_centavos from public.remittances where id = '00000000-0000-0000-0000-000000200401'),
  6000::bigint, 'an owner write to the deposit is replaced by the formula');
reset role;

-- A user still waiting for approval is refused by RLS before any rental check (no amounts leak).
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000200003","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$insert into public.remittance_payments (remittance_id, amount_centavos, idempotency_key)
  values ('00000000-0000-0000-0000-000000200401', 50000, gen_random_uuid())$$,
  '42501', null, 'a pending user gets a permission error, not the over-rental message');
reset role;

select finish();
rollback;
