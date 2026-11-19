begin;
select no_plan();

-- Feature 020 (20261119000200_report_month_deposits.sql): report_unit_month_totals() also returns deposit_centavos, the month's
-- sum of the stored deposit (non-voided payments minus allowance), so the Yearly report agrees with the app. Voided payments and
-- deleted remittances are left out. Far-future dates keep the fixtures away from real data.

insert into public.units (id, body_number, plate_number, make_model)
values ('00000000-0000-0000-0000-000000460101', 'MT-460-A', 'MT460A', 'Test Tricycle'),
       ('00000000-0000-0000-0000-000000460102', 'MT-460-B', 'MT460B', 'Test Tricycle');
insert into public.drivers (id, full_name, license_number, license_expiry_date, phone)
values ('00000000-0000-0000-0000-000000460201', 'Deposit Totals Driver', 'MT-460-L1', '2035-12-31', '09170000460');
insert into public.driver_assignments (id, unit_id, driver_id, assignment_type, starts_on)
values ('00000000-0000-0000-0000-000000460301', '00000000-0000-0000-0000-000000460101', '00000000-0000-0000-0000-000000460201', 'primary', '2034-01-01');
insert into public.unit_assignments (unit_id, driver_id, service_date)
values ('00000000-0000-0000-0000-000000460101', '00000000-0000-0000-0000-000000460201', '2034-03-01'),
  ('00000000-0000-0000-0000-000000460101', '00000000-0000-0000-0000-000000460201', '2034-03-02'),
  ('00000000-0000-0000-0000-000000460101', '00000000-0000-0000-0000-000000460201', '2034-03-03'),
  ('00000000-0000-0000-0000-000000460101', '00000000-0000-0000-0000-000000460201', '2034-03-04'),
  ('00000000-0000-0000-0000-000000460101', '00000000-0000-0000-0000-000000460201', '2034-04-01')
on conflict do nothing;

-- March: R1 unpaid, R2 part paid (100), R3 paid in full then the payment is voided, R4 paid in full but deleted.
-- April: R5 overnight/overtime (300) paid in full.
insert into public.remittances (id, unit_id, driver_id, service_date, disposition, idempotency_key)
values
  ('00000000-0000-0000-0000-000000460401', '00000000-0000-0000-0000-000000460101', '00000000-0000-0000-0000-000000460201', '2034-03-01', 'returned', gen_random_uuid()),
  ('00000000-0000-0000-0000-000000460402', '00000000-0000-0000-0000-000000460101', '00000000-0000-0000-0000-000000460201', '2034-03-02', 'returned', gen_random_uuid()),
  ('00000000-0000-0000-0000-000000460403', '00000000-0000-0000-0000-000000460101', '00000000-0000-0000-0000-000000460201', '2034-03-03', 'returned', gen_random_uuid()),
  ('00000000-0000-0000-0000-000000460404', '00000000-0000-0000-0000-000000460101', '00000000-0000-0000-0000-000000460201', '2034-03-04', 'returned', gen_random_uuid()),
  ('00000000-0000-0000-0000-000000460405', '00000000-0000-0000-0000-000000460101', '00000000-0000-0000-0000-000000460201', '2034-04-01', 'overnight_overtime', gen_random_uuid());

insert into public.remittance_payments (id, remittance_id, amount_centavos, idempotency_key) values
  ('00000000-0000-0000-0000-000000460501', '00000000-0000-0000-0000-000000460402', 10000, gen_random_uuid()),
  ('00000000-0000-0000-0000-000000460502', '00000000-0000-0000-0000-000000460403', 18000, gen_random_uuid()),
  ('00000000-0000-0000-0000-000000460503', '00000000-0000-0000-0000-000000460404', 18000, gen_random_uuid()),
  ('00000000-0000-0000-0000-000000460504', '00000000-0000-0000-0000-000000460405', 30000, gen_random_uuid());
update public.remittance_payments set deleted_at = now() where id = '00000000-0000-0000-0000-000000460502';
update public.remittances set deleted_at = now() where id = '00000000-0000-0000-0000-000000460404';

insert into public.expenses (unit_id, category, custom_category, expense_date, amount_centavos, notes, idempotency_key)
values ('00000000-0000-0000-0000-000000460102', 'others', 'Test', '2034-05-10', 7000, 'Only expenses this month', gen_random_uuid());

select is((select deposit_centavos from public.remittances where id = '00000000-0000-0000-0000-000000460401'), -4000::bigint,
  'the stored deposit of an unpaid remittance is minus the allowance');

select is((select array[rental_centavos, allowance_centavos, remittance_count::bigint]
  from public.report_unit_month_totals('2034-01-01', '2034-12-31')
  where unit_id = '00000000-0000-0000-0000-000000460101' and month = '2034-03-01'),
  array[54000, 12000, 3]::bigint[], 'March: three live remittances (the deleted one is out), rentals and allowances unchanged');

select is((select deposit_centavos from public.report_unit_month_totals('2034-01-01', '2034-12-31')
  where unit_id = '00000000-0000-0000-0000-000000460101' and month = '2034-03-01'),
  -2000::bigint, 'March deposit: unpaid -4000, part paid 6000, voided payment -4000; the deleted remittance is ignored');

select is((select deposit_centavos from public.report_unit_month_totals('2034-01-01', '2034-12-31')
  where unit_id = '00000000-0000-0000-0000-000000460101' and month = '2034-04-01'),
  26000::bigint, 'April deposit: a paid overnight remittance is 300 minus the 40 allowance');

select is((select array[rental_centavos, deposit_centavos, remittance_count::bigint, expense_centavos]
  from public.report_unit_month_totals('2034-01-01', '2034-12-31')
  where unit_id = '00000000-0000-0000-0000-000000460102' and month = '2034-05-01'),
  array[0, 0, 0, 7000]::bigint[], 'a month with only an expense has deposit 0');

select is((select sum(deposit_centavos)::bigint from public.report_unit_month_totals('2034-01-01', '2034-12-31')
  where unit_id = '00000000-0000-0000-0000-000000460101'),
  24000::bigint, 'the year adds the months');

select is((select count(*)::int from public.report_unit_month_totals('2034-04-01', '2034-04-30')
  where unit_id = '00000000-0000-0000-0000-000000460101'), 1, 'the date range still limits the months');

select ok(has_function_privilege('authenticated', 'public.report_unit_month_totals(date, date)', 'execute'), 'authenticated can run it');
select ok(not has_function_privilege('anon', 'public.report_unit_month_totals(date, date)', 'execute'), 'anon cannot run it');
select ok(not (select prosecdef from pg_proc where oid = 'public.report_unit_month_totals(date, date)'::regprocedure), 'it is security invoker');

select * from finish();
rollback;
