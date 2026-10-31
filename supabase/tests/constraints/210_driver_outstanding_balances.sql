begin;
select plan(10);

-- T124 (FR-016, US3 scenario 4): balances total payments per remittance before summing, so a
-- remittance with several payments counts its due once, and each unpaid remittance's unit and
-- service date are returned.

insert into auth.users (id, email, aud, role)
values
  ('00000000-0000-0000-0000-000000210001', 'balance-owner@rolnet.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000210002', 'balance-staff@rolnet.test', 'authenticated', 'authenticated');
update public.profiles
set role = 'owner', account_status = 'approved', approved_at = now(), approved_by = user_id
where user_id = '00000000-0000-0000-0000-000000210001';
update public.profiles
set account_status = 'approved', approved_at = now(), approved_by = '00000000-0000-0000-0000-000000210001'
where user_id = '00000000-0000-0000-0000-000000210002';

insert into public.units (id, body_number, plate_number, make_model)
values
  ('00000000-0000-0000-0000-000000210101', 'BAL-210-A', 'BAL210A', 'Test Tricycle'),
  ('00000000-0000-0000-0000-000000210102', 'BAL-210-B', 'BAL210B', 'Test Tricycle');
insert into public.drivers (id, full_name, license_number, license_expiry_date, phone)
values
  ('00000000-0000-0000-0000-000000210201', 'Balance Driver X', 'BAL-210-LX', '2035-12-31', '09170000210'),
  ('00000000-0000-0000-0000-000000210202', 'Balance Driver Y', 'BAL-210-LY', '2035-12-31', '09170000211');
insert into public.driver_assignments (id, unit_id, driver_id, assignment_type, starts_on)
values
  ('00000000-0000-0000-0000-000000210301', '00000000-0000-0000-0000-000000210101', '00000000-0000-0000-0000-000000210201', 'primary', '2031-06-01'),
  ('00000000-0000-0000-0000-000000210302', '00000000-0000-0000-0000-000000210102', '00000000-0000-0000-0000-000000210202', 'primary', '2031-06-01');
insert into public.remittances (id, assignment_id, unit_id, driver_id, service_date, disposition, idempotency_key)
values
  -- X: 18,000 due, paid 10,000 + 5,000 -> 3,000 unpaid.
  ('00000000-0000-0000-0000-000000210401', '00000000-0000-0000-0000-000000210301', '00000000-0000-0000-0000-000000210101', '00000000-0000-0000-0000-000000210201', '2031-06-01', 'returned', gen_random_uuid()),
  -- X: 30,000 due, paid 15,000 + 15,000 -> settled.
  ('00000000-0000-0000-0000-000000210402', '00000000-0000-0000-0000-000000210301', '00000000-0000-0000-0000-000000210101', '00000000-0000-0000-0000-000000210201', '2031-06-02', 'overnight_overtime', gen_random_uuid()),
  -- X: 18,000 due, nothing paid.
  ('00000000-0000-0000-0000-000000210403', '00000000-0000-0000-0000-000000210301', '00000000-0000-0000-0000-000000210101', '00000000-0000-0000-0000-000000210201', '2031-06-03', 'returned', gen_random_uuid()),
  -- Y: 18,000 due, paid 18,000 + 2,000 (credit) -> settled.
  ('00000000-0000-0000-0000-000000210404', '00000000-0000-0000-0000-000000210302', '00000000-0000-0000-0000-000000210102', '00000000-0000-0000-0000-000000210202', '2031-06-01', 'returned', gen_random_uuid());
insert into public.remittance_payments (remittance_id, paid_at, amount_centavos, idempotency_key)
values
  ('00000000-0000-0000-0000-000000210401', '2031-06-01 18:00+08', 10000, gen_random_uuid()),
  ('00000000-0000-0000-0000-000000210401', '2031-06-02 18:00+08', 5000, gen_random_uuid()),
  ('00000000-0000-0000-0000-000000210402', '2031-06-02 18:00+08', 15000, gen_random_uuid()),
  ('00000000-0000-0000-0000-000000210402', '2031-06-03 18:00+08', 15000, gen_random_uuid());
-- Feature 009 rejects payments above the rental; Y's overpayment is a legacy record written as it
-- could have been before that rule, so the check trigger is off for this insert only.
alter table public.remittance_payments disable trigger remittance_payments_validate;
insert into public.remittance_payments (remittance_id, paid_at, amount_centavos, idempotency_key)
values
  ('00000000-0000-0000-0000-000000210404', '2031-06-01 18:00+08', 18000, gen_random_uuid()),
  ('00000000-0000-0000-0000-000000210404', '2031-06-01 19:00+08', 2000, gen_random_uuid());
alter table public.remittance_payments enable trigger remittance_payments_validate;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000210001","role":"authenticated"}', true);
set local role authenticated;
select is((select outstanding_centavos from public.driver_outstanding_balances('2031-06-30') where driver_id = '00000000-0000-0000-0000-000000210201'),
  21000::bigint, 'each remittance''s due is counted once across several payments');
select is((select unpaid_remittance_count from public.driver_outstanding_balances('2031-06-30') where driver_id = '00000000-0000-0000-0000-000000210201'),
  2, 'two remittances are unpaid');
select is((select first_unpaid_service_date from public.driver_outstanding_balances('2031-06-30') where driver_id = '00000000-0000-0000-0000-000000210201'),
  '2031-06-01'::date, 'the unpaid period starts on the first unpaid service date');
select is((select last_unpaid_service_date from public.driver_outstanding_balances('2031-06-30') where driver_id = '00000000-0000-0000-0000-000000210201'),
  '2031-06-03'::date, 'the unpaid period ends on the last unpaid service date');
select is((select unpaid_remittances -> 0 ->> 'body_number' from public.driver_outstanding_balances('2031-06-30') where driver_id = '00000000-0000-0000-0000-000000210201'),
  'BAL-210-A', 'each unpaid remittance names its unit');
select is((select (unpaid_remittances -> 0 ->> 'balance_centavos')::bigint from public.driver_outstanding_balances('2031-06-30') where driver_id = '00000000-0000-0000-0000-000000210201'),
  3000::bigint, 'each unpaid remittance carries its own balance');
select is((select outstanding_centavos from public.driver_outstanding_balances('2031-06-01') where driver_id = '00000000-0000-0000-0000-000000210201'),
  8000::bigint, 'as_of limits both the remittances and the payments counted');
select is_empty($$select 1 from public.driver_outstanding_balances('2031-06-30') where driver_id = '00000000-0000-0000-0000-000000210202'$$,
  'a settled driver with an overpayment is not listed');
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000210002","role":"authenticated"}', true);
set local role authenticated;
select is_empty($$select 1 from public.driver_outstanding_balances('2031-06-30')$$, 'staff see no balances');
reset role;
select ok(has_function_privilege('authenticated', 'public.driver_outstanding_balances(date)', 'execute'), 'signed-in users keep EXECUTE on the recreated function');

select finish();
rollback;
