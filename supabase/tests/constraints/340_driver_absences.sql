begin;
select plan(31);

-- Feature 012 (20261102000100_driver_absences.sql): absence shape, the no-overlap guarantee,
-- effective coverage (driver_absent_on), Inactive refusal, finished-absence lock, and the
-- assignment trigger refusing an absent driver.

insert into auth.users (id, email, aud, role)
values ('00000000-0000-0000-0000-000000340001', 'abs-owner@rolnet.test', 'authenticated', 'authenticated');
update public.profiles
set role = 'owner', account_status = 'approved', approved_at = now(), approved_by = user_id
where user_id = '00000000-0000-0000-0000-000000340001';

insert into public.units (id, name, body_number, plate_number, make_model, status, created_at)
values ('00000000-0000-0000-0000-000000340101', 'ABS-U1', 'ABS-340-A', 'ABS340A', 'Test Tricycle', 'active', '2030-01-01 08:00+08');
insert into public.drivers (id, full_name, license_number, license_expiry_date, phone, is_active)
values
  ('00000000-0000-0000-0000-000000340201', 'Absence Driver A', 'ABS-340-L1', '2035-12-31', '09170000340', true),
  ('00000000-0000-0000-0000-000000340202', 'Absence Driver B', 'ABS-340-L2', '2035-12-31', '09170000341', false),
  ('00000000-0000-0000-0000-000000340203', 'Absence Driver C', 'ABS-340-L3', '2035-12-31', '09170000342', true),
  ('00000000-0000-0000-0000-000000340204', 'Absence Driver D', 'ABS-340-L4', '2035-12-31', '09170000343', true),
  ('00000000-0000-0000-0000-000000340205', 'Absence Driver E', 'ABS-340-L5', '2035-12-31', '09170000344', true),
  ('00000000-0000-0000-0000-000000340206', 'Absence Driver F', 'ABS-340-L6', '2035-12-31', '09170000345', true);

-- Shape
select has_table('public', 'driver_absences', 'driver_absences exists');
select has_table('public', 'driver_absence_confirmations', 'driver_absence_confirmations exists');
select has_column('public', 'drivers', 'notes', 'drivers has notes');
select is((select stale_leave_amber_days || '/' || stale_leave_red_days || '/' || stale_leave_snooze_days from public.fleet_settings where id = true),
  '14/30/7', 'stale leave settings default to 14, 30 and 7 days');
select throws_ok($$update public.fleet_settings set stale_leave_red_days = 10 where id = true$$,
  '23514', null, 'the red threshold must be above the amber threshold');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000340001","role":"authenticated"}', true);
set local role authenticated;

-- Saving and overlap
select lives_ok($$select public.save_driver_absence(null, '00000000-0000-0000-0000-000000340201', 'day_off', '2031-03-05', null, 'sick', ' cough ', '{}', null)$$,
  'a day-off saves');
select is((select end_date from public.driver_absences where driver_id = '00000000-0000-0000-0000-000000340201' and start_date = '2031-03-05'),
  '2031-03-05'::date, 'a day-off ends on its start date');
select throws_ok($$select public.save_driver_absence(null, '00000000-0000-0000-0000-000000340201', 'on_leave', '2031-03-01', '2031-03-10', 'vacation', null, '{}', null)$$,
  '23514', 'Absence Driver A is already on day-off Mar 5.', 'an overlapping leave is refused, naming the day-off');
select lives_ok($$select public.save_driver_absence(null, '00000000-0000-0000-0000-000000340201', 'on_leave', '2031-04-05', '2031-04-09', 'vacation', null, '{}', null)$$,
  'a leave saves');
select lives_ok($$select public.save_driver_absence(null, '00000000-0000-0000-0000-000000340201', 'on_leave', '2031-04-10', '2031-04-12', 'personal', null, '{}', null)$$,
  'a back-to-back leave is allowed');
select throws_ok($$select public.save_driver_absence(null, '00000000-0000-0000-0000-000000340201', 'on_leave', '2031-04-01', null, 'other', null, '{}', null)$$,
  '23514', 'Absence Driver A is already on leave Apr 5 to Apr 9.', 'an open-ended leave over an existing leave is refused');
select throws_ok($$insert into public.driver_absences (driver_id, absence_type, start_date, end_date, reason) values ('00000000-0000-0000-0000-000000340201', 'on_leave', '2031-04-08', '2031-04-11', 'sick')$$,
  '23P01', null, 'the exclusion constraint refuses an overlap that skips the function');
select throws_ok($$select public.save_driver_absence(null, '00000000-0000-0000-0000-000000340201', 'on_leave', '2031-06-10', '2031-06-01', 'sick', null, '{}', null)$$,
  '23514', 'The To date must be on or after the From date.', 'To before From is refused');
select throws_ok($$insert into public.driver_absences (driver_id, absence_type, start_date, end_date, reason) values ('00000000-0000-0000-0000-000000340201', 'day_off', '2031-07-01', '2031-07-02', 'sick')$$,
  '23514', 'A day-off covers one date.', 'a day-off covering two dates is refused');
select throws_ok($$select public.save_driver_absence(null, '00000000-0000-0000-0000-000000340202', 'day_off', '2031-03-05', null, 'sick', null, '{}', null)$$,
  '23514', 'Inactive drivers cannot have absences', 'an Inactive driver cannot get an absence');

-- Coverage
reset role;
select ok(public.driver_absent_on('00000000-0000-0000-0000-000000340201', '2031-04-05'), 'the first day of a leave is covered');
select ok(public.driver_absent_on('00000000-0000-0000-0000-000000340201', '2031-04-09'), 'the last day of a leave is covered');
select ok(not public.driver_absent_on('00000000-0000-0000-0000-000000340201', '2031-04-13'), 'the day after a leave is not covered');
set local role authenticated;

-- Cancelled ranges are free
insert into public.driver_absences (driver_id, absence_type, start_date, end_date, reason) values ('00000000-0000-0000-0000-000000340203', 'on_leave', '2031-05-01', null, 'family_emergency');
select lives_ok($$select public.cancel_driver_absence(
  (select id from public.driver_absences where driver_id = '00000000-0000-0000-0000-000000340203' and start_date = '2031-05-01'),
  (select updated_at from public.driver_absences where driver_id = '00000000-0000-0000-0000-000000340203' and start_date = '2031-05-01'))$$,
  'an upcoming absence can be cancelled');
select lives_ok($$select public.save_driver_absence(null, '00000000-0000-0000-0000-000000340203', 'day_off', '2031-05-20', null, 'sick', null, '{}', null)$$,
  'a cancelled absence no longer blocks its dates');

-- Ended early stops coverage from that day on
insert into public.driver_absences (driver_id, absence_type, start_date, end_date, reason) values ('00000000-0000-0000-0000-000000340204', 'on_leave', (now() at time zone 'Asia/Manila')::date - 3, (now() at time zone 'Asia/Manila')::date + 5, 'sick');
select lives_ok($$select public.end_driver_absence(
  (select id from public.driver_absences where driver_id = '00000000-0000-0000-0000-000000340204'),
  (select updated_at from public.driver_absences where driver_id = '00000000-0000-0000-0000-000000340204'))$$,
  'an absence covering today can be ended early');
select is((select ended_early_on from public.driver_absences where driver_id = '00000000-0000-0000-0000-000000340204'),
  (now() at time zone 'Asia/Manila')::date, 'ended early is recorded as today');
reset role;
select ok(not public.driver_absent_on('00000000-0000-0000-0000-000000340204', (now() at time zone 'Asia/Manila')::date), 'ending early frees today');
select ok(public.driver_absent_on('00000000-0000-0000-0000-000000340204', (now() at time zone 'Asia/Manila')::date - 1), 'days before ending early stay covered');
set local role authenticated;
select lives_ok($$select public.save_driver_absence(null, '00000000-0000-0000-0000-000000340204', 'day_off', (now() at time zone 'Asia/Manila')::date + 1, null, 'personal', null, '{}', null)$$,
  'dates after ending early are free for a new absence');
select throws_ok($$update public.driver_absences set reason = 'other' where driver_id = '00000000-0000-0000-0000-000000340204' and ended_early_on is not null$$,
  '23514', 'This absence is finished and can''t be edited.', 'an ended absence is read-only');

-- Absent drivers can't be assigned
select throws_ok($$select public.save_unit_assignment('00000000-0000-0000-0000-000000340101', '2031-04-06', '00000000-0000-0000-0000-000000340201', null, null)$$,
  '23514', 'This driver is absent on this date. Choose another driver.', 'an absent driver cannot be assigned');
select lives_ok($$select public.save_unit_assignment('00000000-0000-0000-0000-000000340101', '2031-04-13', '00000000-0000-0000-0000-000000340201', null, null)$$,
  'the day after the leave the driver can be assigned');

-- Ending early on the start day covers nothing
insert into public.driver_absences (driver_id, absence_type, start_date, end_date, reason) values ('00000000-0000-0000-0000-000000340205', 'on_leave', (now() at time zone 'Asia/Manila')::date, null, 'other');
select lives_ok($$select public.end_driver_absence(
  (select id from public.driver_absences where driver_id = '00000000-0000-0000-0000-000000340205'),
  (select updated_at from public.driver_absences where driver_id = '00000000-0000-0000-0000-000000340205'))$$,
  'a leave can be ended on its start day');
select lives_ok($$select public.save_driver_absence(null, '00000000-0000-0000-0000-000000340205', 'day_off', (now() at time zone 'Asia/Manila')::date, null, 'sick', null, '{}', null)$$,
  'a leave ended on its start day leaves the day free');

-- A started absence can't be shortened to before today
insert into public.driver_absences (driver_id, absence_type, start_date, end_date, reason) values ('00000000-0000-0000-0000-000000340206', 'on_leave', (now() at time zone 'Asia/Manila')::date - 2, (now() at time zone 'Asia/Manila')::date + 5, 'sick');
select throws_ok($$select public.save_driver_absence(
  (select id from public.driver_absences where driver_id = '00000000-0000-0000-0000-000000340206'),
  '00000000-0000-0000-0000-000000340206', 'on_leave', (now() at time zone 'Asia/Manila')::date - 2, (now() at time zone 'Asia/Manila')::date - 1, 'sick', null, '{}',
  (select updated_at from public.driver_absences where driver_id = '00000000-0000-0000-0000-000000340206'))$$,
  '23514', 'The end date can''t be before today. Use End early to stop the leave today.', 'an active absence cannot end before today');

select * from finish();
rollback;
