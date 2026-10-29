begin;
select plan(12);

-- T123 (FR-026, FR-029, SC-004, T102): the monthly summary and CSV report reconcile to source rows.
-- Column order checked below: due, paid, outstanding, credit, fuel, repair, registration,
-- insurance, other, total expense, net income.

insert into auth.users (id, email, aud, role)
values
  ('00000000-0000-0000-0000-000000220001', 'report-owner@rolnet.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000220002', 'report-staff@rolnet.test', 'authenticated', 'authenticated');
update public.profiles
set role = 'owner', account_status = 'approved', approved_at = now(), approved_by = user_id
where user_id = '00000000-0000-0000-0000-000000220001';
update public.profiles
set account_status = 'approved', approved_at = now(), approved_by = '00000000-0000-0000-0000-000000220001'
where user_id = '00000000-0000-0000-0000-000000220002';

insert into public.units (id, body_number, plate_number, make_model)
values
  ('00000000-0000-0000-0000-000000220101', 'RPT-220-A', 'RPT220A', 'Test Tricycle'),
  ('00000000-0000-0000-0000-000000220102', 'RPT-220-B', 'RPT220B', 'Test Tricycle');
insert into public.drivers (id, full_name, license_number, license_expiry_date, phone)
values
  ('00000000-0000-0000-0000-000000220201', 'Report Driver X', 'RPT-220-LX', '2035-12-31', '09170000220'),
  ('00000000-0000-0000-0000-000000220202', 'Report Driver Y', 'RPT-220-LY', '2035-12-31', '09170000221');
insert into public.driver_assignments (id, unit_id, driver_id, assignment_type, starts_on)
values
  ('00000000-0000-0000-0000-000000220301', '00000000-0000-0000-0000-000000220101', '00000000-0000-0000-0000-000000220201', 'primary', '2031-06-01'),
  ('00000000-0000-0000-0000-000000220302', '00000000-0000-0000-0000-000000220102', '00000000-0000-0000-0000-000000220202', 'primary', '2031-06-01');
insert into public.remittances (id, assignment_id, unit_id, driver_id, service_date, disposition, idempotency_key)
values
  -- Unit A, June (due not in July; paid in July).
  ('00000000-0000-0000-0000-000000220400', '00000000-0000-0000-0000-000000220301', '00000000-0000-0000-0000-000000220101', '00000000-0000-0000-0000-000000220201', '2031-06-30', 'returned', gen_random_uuid()),
  -- Unit A, July 1: 18,000 due, paid 10,000 in July and 10,000 in August -> credit 2,000.
  ('00000000-0000-0000-0000-000000220401', '00000000-0000-0000-0000-000000220301', '00000000-0000-0000-0000-000000220101', '00000000-0000-0000-0000-000000220201', '2031-07-01', 'returned', gen_random_uuid()),
  -- Unit A, July 31: 30,000 due, paid 5,000 in July and 1 in August -> outstanding 24,999.
  ('00000000-0000-0000-0000-000000220402', '00000000-0000-0000-0000-000000220301', '00000000-0000-0000-0000-000000220101', '00000000-0000-0000-0000-000000220201', '2031-07-31', 'overnight_overtime', gen_random_uuid()),
  -- Unit B, July 15: 18,000 due, paid in full.
  ('00000000-0000-0000-0000-000000220403', '00000000-0000-0000-0000-000000220302', '00000000-0000-0000-0000-000000220102', '00000000-0000-0000-0000-000000220202', '2031-07-15', 'returned', gen_random_uuid()),
  -- Unit B, July 16: reversed later, so excluded with its payment.
  ('00000000-0000-0000-0000-000000220404', '00000000-0000-0000-0000-000000220302', '00000000-0000-0000-0000-000000220102', '00000000-0000-0000-0000-000000220202', '2031-07-16', 'returned', gen_random_uuid());
insert into public.remittance_payments (remittance_id, paid_at, amount_centavos, idempotency_key)
values
  ('00000000-0000-0000-0000-000000220400', '2031-07-01 00:30+08', 18000, gen_random_uuid()),  -- June 30 16:30 UTC, July in Manila
  ('00000000-0000-0000-0000-000000220401', '2031-07-01 18:00+08', 10000, gen_random_uuid()),
  ('00000000-0000-0000-0000-000000220401', '2031-08-02 18:00+08', 10000, gen_random_uuid()),
  ('00000000-0000-0000-0000-000000220402', '2031-07-31 23:30+08', 5000, gen_random_uuid()),
  ('00000000-0000-0000-0000-000000220402', '2031-08-01 00:30+08', 1, gen_random_uuid()),      -- July 31 UTC, August in Manila
  ('00000000-0000-0000-0000-000000220403', '2031-07-15 18:00+08', 18000, gen_random_uuid()),
  ('00000000-0000-0000-0000-000000220404', '2031-07-16 18:00+08', 18000, gen_random_uuid());
update public.remittances set deleted_at = now() where id = '00000000-0000-0000-0000-000000220404';

insert into public.expense_categories (id, name) values ('00000000-0000-0000-0000-000000220501', 'Report Misc 220');
insert into public.expenses (unit_id, category_id, expense_date, amount_centavos, idempotency_key, deleted_at)
select e.unit_id, coalesce(c.id, '00000000-0000-0000-0000-000000220501'), e.expense_date::date, e.amount, gen_random_uuid(), e.deleted_at::timestamptz
from (values
  ('00000000-0000-0000-0000-000000220101'::uuid, 'fuel', '2031-07-02', 50000::bigint, null),
  ('00000000-0000-0000-0000-000000220101'::uuid, 'repairs', '2031-07-10', 20000::bigint, null),
  ('00000000-0000-0000-0000-000000220101'::uuid, null, '2031-07-11', 3000::bigint, null),
  ('00000000-0000-0000-0000-000000220101'::uuid, 'fuel', '2031-07-12', 99999::bigint, '2031-07-13'),  -- soft-deleted
  ('00000000-0000-0000-0000-000000220101'::uuid, 'fuel', '2031-08-01', 7000::bigint, null),           -- August
  ('00000000-0000-0000-0000-000000220102'::uuid, 'insurance', '2031-07-20', 100000::bigint, null)
) as e(unit_id, system_key, expense_date, amount, deleted_at)
left join public.expense_categories c on c.system_key = e.system_key and c.is_system and c.deleted_at is null;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000220001","role":"authenticated"}', true);
set local role authenticated;
select is(
  (select array[remittance_due_centavos, remittance_paid_centavos, outstanding_centavos, credit_centavos, fuel_expense_centavos, repair_expense_centavos,
                registration_expense_centavos, insurance_expense_centavos, other_expense_centavos, total_expense_centavos, net_income_centavos]
   from public.dashboard_monthly_unit_summary('2031-07-01') where unit_id = '00000000-0000-0000-0000-000000220101'),
  array[48000, 33000, 24999, 2000, 50000, 20000, 0, 0, 3000, 73000, -40000]::bigint[],
  'unit A reconciles: paid by received date, outstanding and credit per remittance, expenses by category');
select is(
  (select array[remittance_due_centavos, remittance_paid_centavos, outstanding_centavos, credit_centavos, fuel_expense_centavos, repair_expense_centavos,
                registration_expense_centavos, insurance_expense_centavos, other_expense_centavos, total_expense_centavos, net_income_centavos]
   from public.dashboard_monthly_unit_summary('2031-07-01') where unit_id = '00000000-0000-0000-0000-000000220102'),
  array[18000, 18000, 0, 0, 0, 0, 0, 100000, 0, 100000, -82000]::bigint[],
  'unit B reconciles and excludes the reversed remittance and its payment');
select is((select plate_number from public.dashboard_monthly_unit_summary('2031-07-01') where unit_id = '00000000-0000-0000-0000-000000220101'),
  'RPT220A', 'the summary includes the plate number');
select is(
  (select array[remittance_due_centavos, remittance_paid_centavos, outstanding_centavos, credit_centavos, fuel_expense_centavos, repair_expense_centavos,
                registration_expense_centavos, insurance_expense_centavos, other_expense_centavos, total_expense_centavos, net_income_centavos]
   from public.dashboard_monthly_unit_summary('2031-07-15') where unit_id = '00000000-0000-0000-0000-000000220101'),
  array[48000, 33000, 24999, 2000, 50000, 20000, 0, 0, 3000, 73000, -40000]::bigint[],
  'any date in the month selects the whole month');
select is(
  (select array[remittance_due_centavos, remittance_paid_centavos, outstanding_centavos, credit_centavos, fuel_expense_centavos, repair_expense_centavos,
                registration_expense_centavos, insurance_expense_centavos, other_expense_centavos, total_expense_centavos, net_income_centavos]
   from public.monthly_report('2031-07-01', null) where unit_id is null),
  array[66000, 51000, 24999, 2000, 50000, 20000, 0, 100000, 3000, 173000, -122000]::bigint[],
  'the fleet total row sums the unit rows');
select is((select body_number from public.monthly_report('2031-07-01', null) where unit_id is null), 'FLEET TOTAL', 'the fleet total row is labelled');
select is((select count(*) from public.monthly_report('2031-07-01', null) where unit_id is null), 1::bigint, 'there is one fleet total row');
select ok(
  (select array_agg(unit_id is null) from public.monthly_report('2031-07-01', null)) = array_append(array_fill(false, array[(select count(*)::int from public.units where deleted_at is null)]), true),
  'unit rows come first and the fleet total row is last');
select is(
  (select array_agg(array[remittance_due_centavos, remittance_paid_centavos, net_income_centavos]) from public.monthly_report('2031-07-01', '00000000-0000-0000-0000-000000220101')),
  array[array[48000, 33000, -40000]]::bigint[],
  'a one-unit report has that unit''s row and no fleet total');
select is(
  (select array[remittance_due_centavos, remittance_paid_centavos, outstanding_centavos, credit_centavos, fuel_expense_centavos, repair_expense_centavos,
                registration_expense_centavos, insurance_expense_centavos, other_expense_centavos, total_expense_centavos, net_income_centavos]
   from public.monthly_report('2040-01-01', null) where unit_id is null),
  array[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]::bigint[],
  'an empty month still has a zero fleet total row');
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000220002","role":"authenticated"}', true);
set local role authenticated;
select is_empty($$select 1 from public.monthly_report('2031-07-01', null)$$, 'staff get no report rows, not even a total');
select is_empty($$select 1 from public.dashboard_monthly_unit_summary('2031-07-01')$$, 'staff get no dashboard summary rows');
reset role;

select finish();
rollback;
