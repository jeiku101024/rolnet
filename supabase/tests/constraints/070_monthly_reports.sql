begin;
select plan(9);

-- FR-028 / FR-029: monthly_report() returns the dashboard summary rows (one unit or the whole
-- fleet plus a total row). Reconciliation against source rows and the FLEET TOTAL row (T123) are
-- covered in 220_monthly_report_reconciliation.sql; this file checks unit selection.

insert into auth.users (id, email, aud, role)
values ('00000000-0000-0000-0000-000000070001', 'monthly-owner@rolnet.test', 'authenticated', 'authenticated');
update public.profiles
set role = 'owner', account_status = 'approved', approved_at = now(), approved_by = user_id
where user_id = '00000000-0000-0000-0000-000000070001';

insert into public.units (id, body_number, plate_number, make_model, deleted_at)
values
  ('00000000-0000-0000-0000-000000070101', 'MON-070-A', 'MON070A', 'Test Tricycle', null),
  ('00000000-0000-0000-0000-000000070102', 'MON-070-B', 'MON070B', 'Test Tricycle', null),
  ('00000000-0000-0000-0000-000000070103', 'MON-070-C', 'MON070C', 'Test Tricycle', now());
insert into public.drivers (id, full_name, license_number, license_expiry_date, phone)
values ('00000000-0000-0000-0000-000000070201', 'Monthly Driver', 'MON-070-L1', '2035-12-31', '09170000701');
insert into public.driver_assignments (id, unit_id, driver_id, assignment_type, starts_on)
values ('00000000-0000-0000-0000-000000070301', '00000000-0000-0000-0000-000000070101', '00000000-0000-0000-0000-000000070201', 'primary', '2031-10-01');
insert into public.remittances (id, assignment_id, unit_id, driver_id, service_date, disposition, idempotency_key)
values ('00000000-0000-0000-0000-000000070401', '00000000-0000-0000-0000-000000070301', '00000000-0000-0000-0000-000000070101', '00000000-0000-0000-0000-000000070201', '2031-10-02', 'returned', gen_random_uuid());
insert into public.remittance_payments (remittance_id, paid_at, amount_centavos, idempotency_key)
values ('00000000-0000-0000-0000-000000070401', '2031-10-02 18:00+08', 10000, gen_random_uuid());
insert into public.expenses (unit_id, category_id, expense_date, amount_centavos, idempotency_key)
select '00000000-0000-0000-0000-000000070101', id, '2031-10-05', 2500, gen_random_uuid()
from public.expense_categories where system_key = 'fuel' and is_system and deleted_at is null;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000070001","role":"authenticated"}', true);
set local role authenticated;
select is(
  (select array[remittance_due_centavos, remittance_paid_centavos, outstanding_centavos, fuel_expense_centavos, total_expense_centavos, net_income_centavos]
   from public.monthly_report('2031-10-01', '00000000-0000-0000-0000-000000070101')),
  array[18000, 10000, 8000, 2500, 2500, 7500]::bigint[],
  'a one-unit report has the unit''s due, paid, outstanding, expenses and net income');
select is(
  (select r::text from public.monthly_report('2031-10-01', '00000000-0000-0000-0000-000000070101') r),
  (select s::text from public.dashboard_monthly_unit_summary('2031-10-01') s where s.unit_id = '00000000-0000-0000-0000-000000070101'),
  'the report row matches the dashboard summary row');
select is(
  (select array[remittance_due_centavos, remittance_paid_centavos, outstanding_centavos, credit_centavos, total_expense_centavos, net_income_centavos]
   from public.monthly_report('2031-10-01', '00000000-0000-0000-0000-000000070102')),
  array[0, 0, 0, 0, 0, 0]::bigint[],
  'a unit with no activity reports zeros');
select is((select count(*) from public.monthly_report('2031-10-01', '00000000-0000-0000-0000-000000070102')), 1::bigint, 'a one-unit report has exactly one row');
select is_empty($$select 1 from public.monthly_report('2031-10-01', '00000000-0000-0000-0000-000000070103')$$, 'a soft-deleted unit has no report');
select is_empty($$select 1 from public.monthly_report('2031-10-01', gen_random_uuid())$$, 'an unknown unit has no report');
select is(
  (select count(*) from public.monthly_report('2031-10-01', null) where unit_id is not null),
  (select count(*) from public.units where deleted_at is null),
  'a fleet report has one row per current unit');
select is_empty($$select 1 from public.monthly_report('2031-10-01', null) where unit_id = '00000000-0000-0000-0000-000000070103'$$, 'a fleet report leaves out soft-deleted units');
select ok(
  (select net_income_centavos = remittance_paid_centavos - total_expense_centavos from public.monthly_report('2031-10-01', null) where unit_id is null),
  'the fleet net income is total paid minus total expenses');
reset role;

select finish();
rollback;
