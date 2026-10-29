begin;
select plan(8);

-- FR-028 / FR-029: the monthly report is owner-only. monthly_report() is security definer and
-- returns rows only when is_owner() is true, for both fleet and one-unit reports. Anon calls and
-- approved staff fleet reports are checked in 120_function_execute_rls.sql and
-- 220_monthly_report_reconciliation.sql.

insert into auth.users (id, email, aud, role)
values
  ('00000000-0000-0000-0000-000000075001', 'rptrls-owner@rolnet.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000075002', 'rptrls-staff@rolnet.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000075003', 'rptrls-pending@rolnet.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000075004', 'rptrls-deactivated@rolnet.test', 'authenticated', 'authenticated');
update public.profiles
set role = 'owner', account_status = 'approved', approved_at = now(), approved_by = user_id
where user_id = '00000000-0000-0000-0000-000000075001';
update public.profiles
set account_status = 'approved', approved_at = now(), approved_by = '00000000-0000-0000-0000-000000075001'
where user_id = '00000000-0000-0000-0000-000000075002';
update public.profiles
set account_status = 'deactivated', approved_at = now(), approved_by = '00000000-0000-0000-0000-000000075001'
where user_id = '00000000-0000-0000-0000-000000075004';

insert into public.units (id, body_number, plate_number, make_model)
values ('00000000-0000-0000-0000-000000075101', 'RPR-075-A', 'RPR075A', 'Test Tricycle');

select ok(not has_function_privilege('anon', 'public.monthly_report(date, uuid)', 'execute'), 'signed-out visitors cannot call the monthly report');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000075003","role":"authenticated"}', true);
set local role authenticated;
select is_empty($$select 1 from public.monthly_report('2031-10-01', null)$$, 'a pending user gets no fleet report, not even a total');
select is_empty($$select 1 from public.monthly_report('2031-10-01', '00000000-0000-0000-0000-000000075101')$$, 'a pending user gets no unit report');
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000075004","role":"authenticated"}', true);
set local role authenticated;
select is_empty($$select 1 from public.monthly_report('2031-10-01', null)$$, 'a deactivated user gets no fleet report');
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000075002","role":"authenticated"}', true);
set local role authenticated;
select is_empty($$select 1 from public.monthly_report('2031-10-01', '00000000-0000-0000-0000-000000075101')$$, 'staff get no unit report');
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000075001","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.monthly_report('2031-10-01', '00000000-0000-0000-0000-000000075101')), 1::bigint, 'the owner gets the unit report');
select is((select body_number from public.monthly_report('2031-10-01', '00000000-0000-0000-0000-000000075101')), 'RPR-075-A', 'the unit report names the unit');
select isnt_empty($$select 1 from public.monthly_report('2031-10-01', null) where unit_id is null and body_number = 'FLEET TOTAL'$$, 'the owner gets the fleet report with its total row');
reset role;

select finish();
rollback;
