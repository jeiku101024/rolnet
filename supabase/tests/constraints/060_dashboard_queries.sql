begin;
select plan(11);

-- FR-024 / FR-025 / FR-026: dashboard queries. due_maintenance() lists current parts and tires
-- due by date or by the unit's current mileage; the monthly summary and driver balances leave out
-- soft-deleted units, drivers and reversed remittances. Summary reconciliation (T123) is covered in
-- 220_monthly_report_reconciliation.sql, balances (T124) in 210_driver_outstanding_balances.sql and
-- the Manila default dates (T127) in 230_fleet_date_defaults.sql.

insert into auth.users (id, email, aud, role)
values
  ('00000000-0000-0000-0000-000000060001', 'dash-owner@rolnet.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000060002', 'dash-staff@rolnet.test', 'authenticated', 'authenticated');
update public.profiles
set role = 'owner', account_status = 'approved', approved_at = now(), approved_by = user_id
where user_id = '00000000-0000-0000-0000-000000060001';
update public.profiles
set account_status = 'approved', approved_at = now(), approved_by = '00000000-0000-0000-0000-000000060001'
where user_id = '00000000-0000-0000-0000-000000060002';

insert into public.units (id, body_number, plate_number, make_model, current_mileage)
values
  ('00000000-0000-0000-0000-000000060101', 'DSH-060-A', 'DSH060A', 'Test Tricycle', 1000),
  ('00000000-0000-0000-0000-000000060102', 'DSH-060-B', 'DSH060B', 'Test Tricycle', 0);
insert into public.drivers (id, full_name, license_number, license_expiry_date, phone)
values
  ('00000000-0000-0000-0000-000000060201', 'Dash Driver X', 'DSH-060-LX', '2035-12-31', '09170000601'),
  ('00000000-0000-0000-0000-000000060202', 'Dash Driver D', 'DSH-060-LD', '2035-12-31', '09170000602');
insert into public.driver_assignments (id, unit_id, driver_id, assignment_type, starts_on)
values
  ('00000000-0000-0000-0000-000000060301', '00000000-0000-0000-0000-000000060101', '00000000-0000-0000-0000-000000060201', 'primary', '2031-09-01'),
  ('00000000-0000-0000-0000-000000060302', '00000000-0000-0000-0000-000000060102', '00000000-0000-0000-0000-000000060202', 'primary', '2031-09-01');
insert into public.remittances (assignment_id, unit_id, driver_id, service_date, disposition, idempotency_key, deleted_at)
values
  ('00000000-0000-0000-0000-000000060301', '00000000-0000-0000-0000-000000060101', '00000000-0000-0000-0000-000000060201', '2031-09-02', 'returned', gen_random_uuid(), null),
  ('00000000-0000-0000-0000-000000060301', '00000000-0000-0000-0000-000000060101', '00000000-0000-0000-0000-000000060201', '2031-09-03', 'overnight_overtime', gen_random_uuid(), now()),
  ('00000000-0000-0000-0000-000000060302', '00000000-0000-0000-0000-000000060102', '00000000-0000-0000-0000-000000060202', '2031-09-02', 'returned', gen_random_uuid(), null);
-- Unit B and driver D are archived after their remittance was recorded.
update public.units set deleted_at = now() where id = '00000000-0000-0000-0000-000000060102';
update public.drivers set deleted_at = now() where id = '00000000-0000-0000-0000-000000060202';

-- Maintenance on unit A (current mileage 1,000), checked as of 2031-09-01.
insert into public.part_replacements (id, unit_id, part_name, cost_centavos, replaced_on, next_due_date, next_due_mileage, deleted_at)
values
  ('00000000-0000-0000-0000-000000060401', '00000000-0000-0000-0000-000000060101', 'Past due', 100, '2031-01-01', '2031-08-31', null, null),
  ('00000000-0000-0000-0000-000000060402', '00000000-0000-0000-0000-000000060101', 'Due today', 100, '2031-01-01', '2031-09-01', null, null),
  ('00000000-0000-0000-0000-000000060403', '00000000-0000-0000-0000-000000060101', 'Due tomorrow', 100, '2031-01-01', '2031-09-02', null, null),
  ('00000000-0000-0000-0000-000000060404', '00000000-0000-0000-0000-000000060101', 'Due at 1000', 100, '2031-01-01', null, 1000, null),
  ('00000000-0000-0000-0000-000000060405', '00000000-0000-0000-0000-000000060101', 'Due at 1001', 100, '2031-01-01', null, 1001, null),
  ('00000000-0000-0000-0000-000000060406', '00000000-0000-0000-0000-000000060101', 'Archived', 100, '2031-01-01', '2031-08-01', null, now());
insert into public.tire_installations (id, unit_id, position, brand, installed_on, cost_centavos, next_due_date, next_due_mileage, replaced_by_id, deleted_at)
values
  ('00000000-0000-0000-0000-000000060501', '00000000-0000-0000-0000-000000060101', 'rear_left', 'Current', '2031-02-01', 100, '2031-08-01', null, null, null),
  ('00000000-0000-0000-0000-000000060503', '00000000-0000-0000-0000-000000060101', 'front', 'Not due', '2031-02-01', 100, null, 5000, null, null),
  ('00000000-0000-0000-0000-000000060504', '00000000-0000-0000-0000-000000060101', 'rear_right', 'Archived', '2031-02-01', 100, '2031-07-01', null, null, now());
insert into public.tire_installations (id, unit_id, position, brand, installed_on, cost_centavos, next_due_date, replaced_by_id)
values ('00000000-0000-0000-0000-000000060502', '00000000-0000-0000-0000-000000060101', 'rear_left', 'Replaced', '2031-01-01', 100, '2031-07-01', '00000000-0000-0000-0000-000000060501');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000060001","role":"authenticated"}', true);
set local role authenticated;
select set_eq(
  $$select item_id from public.due_maintenance('2031-09-01') where unit_id = '00000000-0000-0000-0000-000000060101'$$,
  array['00000000-0000-0000-0000-000000060401', '00000000-0000-0000-0000-000000060402', '00000000-0000-0000-0000-000000060404', '00000000-0000-0000-0000-000000060501']::uuid[],
  'current parts and tires due by date or mileage are listed; later, archived and replaced ones are not');
select set_eq(
  $$select item_id from public.due_maintenance('2031-08-31') where unit_id = '00000000-0000-0000-0000-000000060101'$$,
  array['00000000-0000-0000-0000-000000060401', '00000000-0000-0000-0000-000000060404', '00000000-0000-0000-0000-000000060501']::uuid[],
  'an item due on the as_of date is included, one due the next day is not');
select is((select item_type from public.due_maintenance('2031-09-01') where item_id = '00000000-0000-0000-0000-000000060501'), 'tire', 'tires are labelled');
select is((select due_date from public.due_maintenance('2031-09-01') where item_id = '00000000-0000-0000-0000-000000060401'), '2031-08-31'::date, 'the due date is returned');
select is((select due_mileage from public.due_maintenance('2031-09-01') where item_id = '00000000-0000-0000-0000-000000060404'), 1000, 'the due mileage is returned');
insert into public.mileage_readings (unit_id, reading_date, mileage) values ('00000000-0000-0000-0000-000000060101', '2031-08-20', 1001);
select isnt_empty($$select 1 from public.due_maintenance('2031-09-01') where item_id = '00000000-0000-0000-0000-000000060405'$$,
  'a new mileage reading makes a mileage-based item due');

select is_empty($$select 1 from public.dashboard_monthly_unit_summary('2031-09-01') where unit_id = '00000000-0000-0000-0000-000000060102'$$,
  'a soft-deleted unit is left out of the monthly summary');
select is((select remittance_due_centavos from public.dashboard_monthly_unit_summary('2031-09-01') where unit_id = '00000000-0000-0000-0000-000000060101'),
  18000::bigint, 'a reversed remittance is left out of the monthly due');
select is((select outstanding_centavos from public.driver_outstanding_balances('2031-09-30') where driver_id = '00000000-0000-0000-0000-000000060201'),
  18000::bigint, 'a reversed remittance is left out of the driver balance');
select is_empty($$select 1 from public.driver_outstanding_balances('2031-09-30') where driver_id = '00000000-0000-0000-0000-000000060202'$$,
  'a soft-deleted driver is left out of the balances');
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000060002","role":"authenticated"}', true);
set local role authenticated;
select is_empty($$select 1 from public.due_maintenance('2031-09-01')$$, 'staff see no due maintenance');
reset role;

select finish();
rollback;
