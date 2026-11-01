begin;
select plan(24);

-- Feature 010 (20261101000100_unit_assignments.sql): one driver per unit and one unit per driver per
-- day, the save function, eligibility rules, and the lock once the day has a remittance.

insert into auth.users (id, email, aud, role)
values ('00000000-0000-0000-0000-000000280001', 'ua-owner@rolnet.test', 'authenticated', 'authenticated');
update public.profiles
set role = 'owner', account_status = 'approved', approved_at = now(), approved_by = user_id
where user_id = '00000000-0000-0000-0000-000000280001';

-- Units exist from 2030-01-01 so past and future dates can be tested.
insert into public.units (id, body_number, plate_number, make_model, status, created_at)
values
  ('00000000-0000-0000-0000-000000280101', 'UA-280-A', 'UA280A', 'Test Tricycle', 'active', '2030-01-01 08:00+08'),
  ('00000000-0000-0000-0000-000000280102', 'UA-280-B', 'UA280B', 'Test Tricycle', 'active', '2030-01-01 08:00+08'),
  ('00000000-0000-0000-0000-000000280103', 'UA-280-C', 'UA280C', 'Test Tricycle', 'active', '2030-06-01 08:00+08');
insert into public.drivers (id, full_name, license_number, license_expiry_date, phone, is_active)
values
  ('00000000-0000-0000-0000-000000280201', 'UA Driver One', 'UA-280-L1', '2035-12-31', '09170000280', true),
  ('00000000-0000-0000-0000-000000280202', 'UA Driver Two', 'UA-280-L2', '2035-12-31', '09170000281', true),
  ('00000000-0000-0000-0000-000000280203', 'UA Driver Inactive', 'UA-280-L3', '2035-12-31', '09170000282', false),
  ('00000000-0000-0000-0000-000000280204', 'UA Driver Expiring', 'UA-280-L4', '2030-03-31', '09170000283', true);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000280001","role":"authenticated"}', true);
set local role authenticated;

-- Saving
select lives_ok($$select public.save_unit_assignment('00000000-0000-0000-0000-000000280101', '2030-03-01', '00000000-0000-0000-0000-000000280201', '  first  ', null)$$,
  'save_unit_assignment inserts a new assignment');
select is((select notes from public.unit_assignments where unit_id = '00000000-0000-0000-0000-000000280101' and service_date = '2030-03-01'),
  'first', 'notes are trimmed');
select throws_ok($$select public.save_unit_assignment('00000000-0000-0000-0000-000000280101', '2030-03-01', '00000000-0000-0000-0000-000000280202', null, null)$$,
  'P0001', 'This unit was just assigned by someone else. Reload to see it.', 'a second first-save for the same unit and date is refused');
select throws_ok($$select public.save_unit_assignment('00000000-0000-0000-0000-000000280102', '2030-03-01', '00000000-0000-0000-0000-000000280201', null, null)$$,
  '23505', null, 'a driver already saved on another unit that day is refused');
select throws_ok($$insert into public.unit_assignments (unit_id, driver_id, service_date) values ('00000000-0000-0000-0000-000000280101', '00000000-0000-0000-0000-000000280202', '2030-03-01')$$,
  '23505', null, 'a direct insert cannot give a unit two drivers on one day');
select throws_ok($$select public.save_unit_assignment('00000000-0000-0000-0000-000000280102', '2030-03-01', null, null, null)$$,
  '22023', 'Choose a driver first', 'saving without a driver is refused');
select lives_ok($$select public.save_unit_assignment('00000000-0000-0000-0000-000000280101', '2030-03-01', '00000000-0000-0000-0000-000000280202', 'swapped',
  (select updated_at from public.unit_assignments where unit_id = '00000000-0000-0000-0000-000000280101' and service_date = '2030-03-01'))$$,
  'saving with the shown updated_at overwrites the assignment');
select is((select driver_id from public.unit_assignments where unit_id = '00000000-0000-0000-0000-000000280101' and service_date = '2030-03-01' and deleted_at is null),
  '00000000-0000-0000-0000-000000280202'::uuid, 'the overwrite changed the driver, keeping one row');
select throws_ok($$select public.save_unit_assignment('00000000-0000-0000-0000-000000280101', '2030-03-01', '00000000-0000-0000-0000-000000280201', null, '2000-01-01 00:00+00')$$,
  'P0001', 'This assignment was changed by someone else. Reload to see it.', 'a stale overwrite is refused');
select lives_ok($$select public.save_unit_assignment('00000000-0000-0000-0000-000000280102', '2030-03-01', '00000000-0000-0000-0000-000000280201', null, null)$$,
  'driver one is free again after the overwrite');

-- Eligibility
select throws_ok($$select public.save_unit_assignment('00000000-0000-0000-0000-000000280103', '2030-05-31', '00000000-0000-0000-0000-000000280202', null, null)$$,
  '23514', 'This unit wasn''t in the fleet on this date.', 'a date before the unit was added is refused');
select throws_ok($$select public.save_unit_assignment('00000000-0000-0000-0000-000000280103', '2030-07-01', '00000000-0000-0000-0000-000000280203', null, null)$$,
  '23514', 'This driver can''t be assigned on this date. Check that they''re active and their licence is valid.', 'an inactive driver is refused');
select throws_ok($$select public.save_unit_assignment('00000000-0000-0000-0000-000000280103', '2030-07-01', '00000000-0000-0000-0000-000000280204', null, null)$$,
  '23514', 'This driver can''t be assigned on this date. Check that they''re active and their licence is valid.', 'a driver whose licence expired before the date is refused');
reset role;
insert into public.unit_status_changes (unit_id, from_status, to_status, changed_at, effective_on)
values ('00000000-0000-0000-0000-000000280103', 'active', 'in_repair', '2030-08-01 09:00+08', '2030-08-01');
set local role authenticated;
select throws_ok($$select public.save_unit_assignment('00000000-0000-0000-0000-000000280103', '2030-08-02', '00000000-0000-0000-0000-000000280202', null, null)$$,
  '23514', 'This unit is In repair on this date. Set it to Active to assign a driver.', 'a blocked date is refused');
select lives_ok($$select public.save_unit_assignment('00000000-0000-0000-0000-000000280103', '2030-07-31', '00000000-0000-0000-0000-000000280202', null, null)$$,
  'the day before the status change is still assignable');

-- Unit and date are fixed
select throws_ok($$update public.unit_assignments set service_date = '2030-03-02' where unit_id = '00000000-0000-0000-0000-000000280102' and service_date = '2030-03-01'$$,
  '23514', 'An assignment''s unit and date can''t change. Release it and save a new one.', 'an assignment cannot move to another date');

-- Lock after a remittance
insert into public.remittances (unit_id, driver_id, service_date, disposition, idempotency_key)
values ('00000000-0000-0000-0000-000000280102', '00000000-0000-0000-0000-000000280201', '2030-03-01', 'returned', gen_random_uuid());
select throws_ok($$update public.unit_assignments set notes = 'late note' where unit_id = '00000000-0000-0000-0000-000000280102' and service_date = '2030-03-01'$$,
  '23514', 'A remittance is already recorded for this day. The assignment can''t be changed.', 'an assignment with a remittance cannot be edited');
reset role;
select throws_ok($$update public.unit_assignments set deleted_at = now() where unit_id = '00000000-0000-0000-0000-000000280102' and service_date = '2030-03-01'$$,
  '23514', 'A remittance is already recorded for this day. The assignment can''t be changed.', 'an assignment with a remittance cannot be released');
set local role authenticated;
select public.reverse_remittance((select id from public.remittances where unit_id = '00000000-0000-0000-0000-000000280102' and service_date = '2030-03-01'), 'test');
select lives_ok($$update public.unit_assignments set notes = 'after reversal' where unit_id = '00000000-0000-0000-0000-000000280102' and service_date = '2030-03-01'$$,
  'after the remittance is reversed, the assignment can be edited again');

-- Pre-fill source
select lives_ok($$select public.save_unit_assignment('00000000-0000-0000-0000-000000280101', '2030-03-05', '00000000-0000-0000-0000-000000280201', null, null)$$,
  'a later assignment saves');
select is((select driver_id from public.latest_unit_assignments_before('2030-03-10') where unit_id = '00000000-0000-0000-0000-000000280101'),
  '00000000-0000-0000-0000-000000280201'::uuid, 'latest_unit_assignments_before returns the latest earlier assignment per unit');

-- No hard delete; grants
reset role;
select throws_ok($$delete from public.unit_assignments where unit_id = '00000000-0000-0000-0000-000000280101'$$,
  null, null, 'assignments cannot be hard-deleted');
select ok(not has_function_privilege('authenticated', 'public.validate_unit_assignment()', 'execute')
  and not has_function_privilege('anon', 'public.unit_status_on(uuid, date)', 'execute')
  and not has_function_privilege('authenticated', 'public.unit_status_on(uuid, date)', 'execute'),
  'trigger and lookup functions are not executable by app roles');
select ok(has_function_privilege('authenticated', 'public.save_unit_assignment(uuid, date, uuid, text, timestamptz)', 'execute')
  and has_function_privilege('authenticated', 'public.latest_unit_assignments_before(date)', 'execute')
  and not has_function_privilege('anon', 'public.save_unit_assignment(uuid, date, uuid, text, timestamptz)', 'execute'),
  'the two app-called functions are executable by authenticated only');

select * from finish();
rollback;
