begin;
select plan(9);

-- Feature 014 (20261103000200_report_unit_month_totals.sql): one row per unit and month with rental and allowance
-- totals, a remittance count, and the expenses, for the yearly report. Deleted rows are left out.

insert into public.units (id, body_number, plate_number, make_model)
values ('00000000-0000-0000-0000-000000400101', 'MT-400-A', 'MT400A', 'Test Tricycle'),
       ('00000000-0000-0000-0000-000000400102', 'MT-400-B', 'MT400B', 'Test Tricycle');
insert into public.drivers (id, full_name, license_number, license_expiry_date, phone)
values ('00000000-0000-0000-0000-000000400201', 'Month Totals Driver', 'MT-400-L1', '2035-12-31', '09170000400');
insert into public.driver_assignments (id, unit_id, driver_id, assignment_type, starts_on)
values ('00000000-0000-0000-0000-000000400301', '00000000-0000-0000-0000-000000400101', '00000000-0000-0000-0000-000000400201', 'primary', '2032-01-01');
insert into public.unit_assignments (unit_id, driver_id, service_date)
values ('00000000-0000-0000-0000-000000400101', '00000000-0000-0000-0000-000000400201', '2032-03-01'),
  ('00000000-0000-0000-0000-000000400101', '00000000-0000-0000-0000-000000400201', '2032-03-02'),
  ('00000000-0000-0000-0000-000000400101', '00000000-0000-0000-0000-000000400201', '2032-03-03'),
  ('00000000-0000-0000-0000-000000400101', '00000000-0000-0000-0000-000000400201', '2032-04-01')
on conflict do nothing;
insert into public.remittances (id, unit_id, driver_id, service_date, disposition, idempotency_key)
values
  ('00000000-0000-0000-0000-000000400401', '00000000-0000-0000-0000-000000400101', '00000000-0000-0000-0000-000000400201', '2032-03-01', 'returned', gen_random_uuid()),
  ('00000000-0000-0000-0000-000000400402', '00000000-0000-0000-0000-000000400101', '00000000-0000-0000-0000-000000400201', '2032-03-02', 'overnight_overtime', gen_random_uuid()),
  ('00000000-0000-0000-0000-000000400403', '00000000-0000-0000-0000-000000400101', '00000000-0000-0000-0000-000000400201', '2032-03-03', 'returned', gen_random_uuid()),
  ('00000000-0000-0000-0000-000000400404', '00000000-0000-0000-0000-000000400101', '00000000-0000-0000-0000-000000400201', '2032-04-01', 'returned', gen_random_uuid());
update public.remittances set deleted_at = now() where id = '00000000-0000-0000-0000-000000400403';

insert into public.expenses (unit_id, category, custom_category, expense_date, amount_centavos, notes, idempotency_key)
values
  ('00000000-0000-0000-0000-000000400101', 'others', 'Test', '2032-03-05', 12000, 'March expense', gen_random_uuid()),
  ('00000000-0000-0000-0000-000000400101', 'others', 'Test', '2032-03-20', 3000, 'Deleted expense', gen_random_uuid()),
  ('00000000-0000-0000-0000-000000400102', 'others', 'Test', '2032-05-10', 7000, 'Only expenses this month', gen_random_uuid());
update public.expenses set deleted_at = now() where notes = 'Deleted expense';

select is((select array[rental_centavos, allowance_centavos, remittance_count::bigint, expense_centavos]
  from public.report_unit_month_totals('2032-01-01', '2032-12-31')
  where unit_id = '00000000-0000-0000-0000-000000400101' and month = '2032-03-01'),
  array[48000, 8000, 2, 12000]::bigint[], 'March totals: rentals 18,000 + 30,000, two allowances, one live expense');
select is((select rental_centavos from public.report_unit_month_totals('2032-01-01', '2032-12-31')
  where unit_id = '00000000-0000-0000-0000-000000400101' and month = '2032-04-01'),
  18000::bigint, 'April has its own row');
select is((select array[rental_centavos, remittance_count::bigint, expense_centavos]
  from public.report_unit_month_totals('2032-01-01', '2032-12-31')
  where unit_id = '00000000-0000-0000-0000-000000400102' and month = '2032-05-01'),
  array[0, 0, 7000]::bigint[], 'a month with only an expense still has a row with zero rental');
select is((select count(*)::int from public.report_unit_month_totals('2032-01-01', '2032-12-31')
  where unit_id in ('00000000-0000-0000-0000-000000400101', '00000000-0000-0000-0000-000000400102')),
  3, 'one row per unit and month with any record');
select is((select count(*)::int from public.report_unit_month_totals('2032-04-01', '2032-04-30')
  where unit_id = '00000000-0000-0000-0000-000000400101'),
  1, 'the date range limits the months');
select is((select count(*)::int from public.report_unit_month_totals('2033-01-01', '2033-12-31')
  where unit_id = '00000000-0000-0000-0000-000000400101'),
  0, 'a year without records returns no rows for the unit');
select is((select array_agg(month order by month) from public.report_unit_month_totals('2032-01-01', '2032-12-31')
  where unit_id = '00000000-0000-0000-0000-000000400101'),
  array['2032-03-01', '2032-04-01']::date[], 'rows come ordered by unit then month');

select ok(has_function_privilege('authenticated', 'public.report_unit_month_totals(date, date)', 'execute'),
  'authenticated can run report_unit_month_totals');
select ok(not has_function_privilege('anon', 'public.report_unit_month_totals(date, date)', 'execute'),
  'anon cannot run report_unit_month_totals');

select finish();
rollback;
