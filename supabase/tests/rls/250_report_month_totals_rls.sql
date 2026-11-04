begin;
select plan(5);

-- Feature 014: report_unit_month_totals() is security invoker, so row level security decides what a caller sees.
-- An approved user gets the totals, a user still waiting for approval gets nothing, and anon cannot run it.

insert into auth.users (id, email, aud, role)
values
  ('00000000-0000-0000-0000-000000250001', 'mt-owner@rolnet.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000250002', 'mt-pending@rolnet.test', 'authenticated', 'authenticated');
update public.profiles
set role = 'owner', account_status = 'approved', approved_at = now(), approved_by = user_id
where user_id = '00000000-0000-0000-0000-000000250001';

insert into public.units (id, body_number, plate_number, make_model)
values ('00000000-0000-0000-0000-000000250101', 'MT-250-A', 'MT250A', 'Test Tricycle');
insert into public.drivers (id, full_name, license_number, license_expiry_date, phone)
values ('00000000-0000-0000-0000-000000250201', 'Month Totals RLS Driver', 'MT-250-L1', '2035-12-31', '09170000250');
insert into public.driver_assignments (id, unit_id, driver_id, assignment_type, starts_on)
values ('00000000-0000-0000-0000-000000250301', '00000000-0000-0000-0000-000000250101', '00000000-0000-0000-0000-000000250201', 'primary', '2033-01-01');
insert into public.unit_assignments (unit_id, driver_id, service_date)
values ('00000000-0000-0000-0000-000000250101', '00000000-0000-0000-0000-000000250201', '2033-02-01')
on conflict do nothing;
insert into public.remittances (id, unit_id, driver_id, service_date, disposition, idempotency_key)
values ('00000000-0000-0000-0000-000000250401', '00000000-0000-0000-0000-000000250101',
        '00000000-0000-0000-0000-000000250201', '2033-02-01', 'returned', gen_random_uuid());

select ok(not (select prosecdef from pg_proc where oid = 'public.report_unit_month_totals(date, date)'::regprocedure),
  'report_unit_month_totals is security invoker');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000250001","role":"authenticated"}', true);
set local role authenticated;
select is((select rental_centavos from public.report_unit_month_totals('2033-01-01', '2033-12-31')
  where unit_id = '00000000-0000-0000-0000-000000250101'),
  18000::bigint, 'an approved owner gets the unit''s monthly totals');
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000250002","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.report_unit_month_totals('2033-01-01', '2033-12-31')
  where unit_id = '00000000-0000-0000-0000-000000250101'),
  0, 'a user waiting for approval gets no rows');
reset role;

set local role anon;
select throws_ok($$select * from public.report_unit_month_totals('2033-01-01', '2033-12-31')$$,
  '42501', null, 'anon is refused');
reset role;

select ok(has_function_privilege('authenticated', 'public.report_unit_month_totals(date, date)', 'execute'),
  'authenticated has EXECUTE because the app calls it');

select finish();
rollback;
