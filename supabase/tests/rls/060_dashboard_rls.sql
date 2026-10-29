begin;
select plan(15);

-- FR-024 / FR-026 / FR-027: the dashboard functions are security definer, so each one filters on
-- is_owner(). Anon cannot call them, pending and deactivated users get no rows, and the approved
-- owner gets the fleet's rows. Approved staff are checked in 060_dashboard_queries.sql,
-- 210_driver_outstanding_balances.sql and 220_monthly_report_reconciliation.sql.

insert into auth.users (id, email, aud, role)
values
  ('00000000-0000-0000-0000-000000065001', 'dashrls-owner@rolnet.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000065003', 'dashrls-pending@rolnet.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000065004', 'dashrls-deactivated@rolnet.test', 'authenticated', 'authenticated');
update public.profiles
set role = 'owner', account_status = 'approved', approved_at = now(), approved_by = user_id
where user_id = '00000000-0000-0000-0000-000000065001';
update public.profiles
set account_status = 'deactivated', approved_at = now(), approved_by = '00000000-0000-0000-0000-000000065001'
where user_id = '00000000-0000-0000-0000-000000065004';

insert into public.units (id, body_number, plate_number, make_model)
values ('00000000-0000-0000-0000-000000065101', 'DSR-065-A', 'DSR065A', 'Test Tricycle');
insert into public.drivers (id, full_name, license_number, license_expiry_date, phone)
values ('00000000-0000-0000-0000-000000065201', 'Dash RLS Driver', 'DSR-065-L1', '2035-12-31', '09170000651');
insert into public.driver_assignments (id, unit_id, driver_id, assignment_type, starts_on)
values ('00000000-0000-0000-0000-000000065301', '00000000-0000-0000-0000-000000065101', '00000000-0000-0000-0000-000000065201', 'primary', '2031-09-01');
insert into public.remittances (assignment_id, unit_id, driver_id, service_date, disposition, idempotency_key)
values ('00000000-0000-0000-0000-000000065301', '00000000-0000-0000-0000-000000065101', '00000000-0000-0000-0000-000000065201', '2031-09-02', 'returned', gen_random_uuid());
insert into public.part_replacements (id, unit_id, part_name, cost_centavos, replaced_on, next_due_date)
values ('00000000-0000-0000-0000-000000065401', '00000000-0000-0000-0000-000000065101', 'Brake pads', 100, '2031-01-01', '2031-08-01');

select ok(has_function_privilege('authenticated', 'public.dashboard_monthly_unit_summary(date)', 'execute'), 'signed-in users can call the monthly summary');
select ok(has_function_privilege('authenticated', 'public.driver_outstanding_balances(date)', 'execute'), 'signed-in users can call the driver balances');
select ok(has_function_privilege('authenticated', 'public.due_maintenance(date)', 'execute'), 'signed-in users can call due maintenance');
select ok(has_function_privilege('authenticated', 'public.expiring_documents(date)', 'execute'), 'signed-in users can call expiring documents');

-- Signed-out visitor.
set local role anon;
select throws_ok($$select * from public.dashboard_monthly_unit_summary('2031-09-01')$$, '42501', null, 'anon cannot call the monthly summary');
select throws_ok($$select * from public.driver_outstanding_balances('2031-09-30')$$, '42501', null, 'anon cannot call the driver balances');
select throws_ok($$select * from public.due_maintenance('2031-09-01')$$, '42501', null, 'anon cannot call due maintenance');
reset role;

-- Signed-in user whose registration is still pending.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000065003","role":"authenticated"}', true);
set local role authenticated;
select is_empty($$select 1 from public.dashboard_monthly_unit_summary('2031-09-01')$$, 'a pending user gets no summary rows');
select is_empty($$select 1 from public.driver_outstanding_balances('2031-09-30')$$, 'a pending user gets no balances');
select is_empty($$select 1 from public.due_maintenance('2031-09-01')$$, 'a pending user gets no due maintenance');
reset role;

-- Deactivated staff member.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000065004","role":"authenticated"}', true);
set local role authenticated;
select is_empty($$select 1 from public.dashboard_monthly_unit_summary('2031-09-01')$$, 'a deactivated user gets no summary rows');
select is_empty($$select 1 from public.driver_outstanding_balances('2031-09-30')$$, 'a deactivated user gets no balances');
reset role;

-- Approved owner.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000065001","role":"authenticated"}', true);
set local role authenticated;
select is((select remittance_due_centavos from public.dashboard_monthly_unit_summary('2031-09-01') where unit_id = '00000000-0000-0000-0000-000000065101'), 18000::bigint, 'the owner gets the unit''s summary');
select is((select outstanding_centavos from public.driver_outstanding_balances('2031-09-30') where driver_id = '00000000-0000-0000-0000-000000065201'), 18000::bigint, 'the owner gets the driver''s balance');
select isnt_empty($$select 1 from public.due_maintenance('2031-09-01') where item_id = '00000000-0000-0000-0000-000000065401'$$, 'the owner gets due maintenance');
reset role;

select finish();
rollback;
