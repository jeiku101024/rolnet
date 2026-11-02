begin;
select plan(22);

-- Feature 012 (20261102000100_driver_absences.sql, research R5–R6): saving an absence releases the
-- today-and-later assignments it newly covers, only when the caller confirmed exactly that list; a
-- locked assignment (with a remittance) blocks the save; cancel, end early, and "Still on leave".

insert into auth.users (id, email, aud, role)
values ('00000000-0000-0000-0000-000000350001', 'absrel-owner@rolnet.test', 'authenticated', 'authenticated');
update public.profiles
set role = 'owner', account_status = 'approved', approved_at = now(), approved_by = user_id
where user_id = '00000000-0000-0000-0000-000000350001';

insert into public.units (id, name, body_number, plate_number, make_model, status, created_at)
values
  ('00000000-0000-0000-0000-000000350101', 'REL-U1', 'ABR-350-A', 'ABR350A', 'Test Tricycle', 'active', '2020-01-01 08:00+08'),
  ('00000000-0000-0000-0000-000000350102', 'REL-U2', 'ABR-350-B', 'ABR350B', 'Test Tricycle', 'active', '2020-01-01 08:00+08');
insert into public.drivers (id, full_name, license_number, license_expiry_date, phone, is_active)
values
  ('00000000-0000-0000-0000-000000350201', 'Release Absence One', 'ABR-350-L1', '2035-12-31', '09170000350', true),
  ('00000000-0000-0000-0000-000000350202', 'Release Absence Two', 'ABR-350-L2', '2035-12-31', '09170000351', true),
  ('00000000-0000-0000-0000-000000350203', 'Release Absence Three', 'ABR-350-L3', '2035-12-31', '09170000352', true),
  ('00000000-0000-0000-0000-000000350204', 'Release Absence Four', 'ABR-350-L4', '2035-12-31', '09170000353', true),
  ('00000000-0000-0000-0000-000000350205', 'Release Absence Five', 'ABR-350-L5', '2035-12-31', '09170000354', true);

-- Driver One on unit 1: yesterday to the day after tomorrow. Driver Two on unit 2: today + 3 and + 6.
create temp table fleet_day as select (now() at time zone 'Asia/Manila')::date as d;
grant select on fleet_day to authenticated;
insert into public.unit_assignments (unit_id, driver_id, service_date)
select '00000000-0000-0000-0000-000000350101'::uuid, '00000000-0000-0000-0000-000000350201'::uuid, d + k from fleet_day, generate_series(-1, 2) k;
insert into public.unit_assignments (unit_id, driver_id, service_date)
select '00000000-0000-0000-0000-000000350102'::uuid, '00000000-0000-0000-0000-000000350202'::uuid, d + k from fleet_day, unnest(array[3, 6]) k;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000350001","role":"authenticated"}', true);
set local role authenticated;

-- Release with the save
select throws_ok($$select public.save_driver_absence(null, '00000000-0000-0000-0000-000000350201', 'on_leave', (select d + 1 from fleet_day), (select d + 5 from fleet_day), 'sick', null, '{}', null)$$,
  'P0001', 'Assignments for these dates changed. Review them again.', 'a release list that misses assignments is refused');
select lives_ok($$select public.save_driver_absence(null, '00000000-0000-0000-0000-000000350201', 'on_leave', (select d + 1 from fleet_day), (select d + 5 from fleet_day), 'sick', null,
  (select array_agg(id) from public.unit_assignments where driver_id = '00000000-0000-0000-0000-000000350201' and service_date > (select d from fleet_day)), null)$$,
  'the absence saves with the confirmed release list');
select is((select count(*)::int from public.unit_assignments where driver_id = '00000000-0000-0000-0000-000000350201' and service_date >= (select d from fleet_day)),
  1, 'covered future assignments are released and today''s stays');
select is((select count(*)::int from public.unit_assignments where driver_id = '00000000-0000-0000-0000-000000350201' and service_date < (select d from fleet_day)),
  1, 'past assignments are never released');

-- A locked assignment blocks the save
reset role;
insert into public.remittances (unit_id, driver_id, service_date, disposition, idempotency_key)
select '00000000-0000-0000-0000-000000350101', '00000000-0000-0000-0000-000000350201', d, 'returned', gen_random_uuid() from fleet_day;
set local role authenticated;
select throws_ok($$select public.save_driver_absence(
  (select id from public.driver_absences where driver_id = '00000000-0000-0000-0000-000000350201'),
  '00000000-0000-0000-0000-000000350201', 'on_leave', (select d from fleet_day), (select d + 5 from fleet_day), 'sick', null,
  (select array_agg(id) from public.unit_assignments where driver_id = '00000000-0000-0000-0000-000000350201' and service_date = (select d from fleet_day)),
  (select updated_at from public.driver_absences where driver_id = '00000000-0000-0000-0000-000000350201'))$$,
  '23514', format('REL-U1 on %s already has a remittance, so this assignment can''t be released.', to_char((now() at time zone 'Asia/Manila')::date, 'Mon FMDD')),
  'an assignment with a remittance is never released');
select is((select start_date from public.driver_absences where driver_id = '00000000-0000-0000-0000-000000350201'),
  (select d + 1 from fleet_day), 'the refused edit left the absence unchanged');
select is((select count(*)::int from public.unit_assignments where driver_id = '00000000-0000-0000-0000-000000350201' and service_date = (select d from fleet_day)),
  1, 'the refused edit left the locked assignment in place');

-- Editing releases only newly covered dates
select lives_ok($$select public.save_driver_absence(null, '00000000-0000-0000-0000-000000350202', 'on_leave', (select d + 1 from fleet_day), (select d + 4 from fleet_day), 'vacation', null,
  (select array_agg(id) from public.unit_assignments where driver_id = '00000000-0000-0000-0000-000000350202' and service_date = (select d + 3 from fleet_day)), null)$$,
  'a leave releases the one assignment it covers');
select lives_ok($$select public.save_driver_absence(
  (select id from public.driver_absences where driver_id = '00000000-0000-0000-0000-000000350202'),
  '00000000-0000-0000-0000-000000350202', 'on_leave', (select d + 1 from fleet_day), (select d + 7 from fleet_day), 'vacation', null,
  (select array_agg(id) from public.unit_assignments where driver_id = '00000000-0000-0000-0000-000000350202' and service_date = (select d + 6 from fleet_day) and deleted_at is null),
  (select updated_at from public.driver_absences where driver_id = '00000000-0000-0000-0000-000000350202'))$$,
  'extending the leave releases only the newly covered assignment');
select is((select count(*)::int from public.unit_assignments where driver_id = '00000000-0000-0000-0000-000000350202'),
  0, 'both covered assignments are released');

-- Cancel
insert into public.driver_absences (driver_id, absence_type, start_date, end_date, reason)
select '00000000-0000-0000-0000-000000350202', 'day_off', d + 10, d + 10, 'personal' from fleet_day;
select throws_ok($$select public.cancel_driver_absence(
  (select id from public.driver_absences where driver_id = '00000000-0000-0000-0000-000000350202' and absence_type = 'day_off'), '2000-01-01 00:00+00')$$,
  'P0001', 'This absence was changed by someone else. Reload to see it.', 'a stale cancel is refused');
select lives_ok($$select public.cancel_driver_absence(
  (select id from public.driver_absences where driver_id = '00000000-0000-0000-0000-000000350202' and absence_type = 'day_off'),
  (select updated_at from public.driver_absences where driver_id = '00000000-0000-0000-0000-000000350202' and absence_type = 'day_off'))$$,
  'an upcoming absence can be cancelled');
select isnt((select cancelled_at from public.driver_absences where driver_id = '00000000-0000-0000-0000-000000350202' and absence_type = 'day_off'),
  null, 'the cancel is recorded');
insert into public.driver_absences (driver_id, absence_type, start_date, end_date, reason)
select '00000000-0000-0000-0000-000000350203', 'on_leave', d - 1, d + 1, 'sick' from fleet_day;
insert into public.driver_absences (driver_id, absence_type, start_date, end_date, reason)
select '00000000-0000-0000-0000-000000350203', 'day_off', d + 5, d + 5, 'personal' from fleet_day;
select throws_ok($$select public.cancel_driver_absence(
  (select id from public.driver_absences where driver_id = '00000000-0000-0000-0000-000000350203' and absence_type = 'on_leave'),
  (select updated_at from public.driver_absences where driver_id = '00000000-0000-0000-0000-000000350203' and absence_type = 'on_leave'))$$,
  '23514', 'Only upcoming absences can be cancelled. Use End early for one that has started.', 'an absence that has started cannot be cancelled');

-- End early, cancelling upcoming absences
select lives_ok($$select public.end_driver_absence(
  (select id from public.driver_absences where driver_id = '00000000-0000-0000-0000-000000350203' and absence_type = 'on_leave'),
  (select updated_at from public.driver_absences where driver_id = '00000000-0000-0000-0000-000000350203' and absence_type = 'on_leave'), true)$$,
  'an absence covering today can be ended early, cancelling upcoming ones');
select is((select ended_early_on from public.driver_absences where driver_id = '00000000-0000-0000-0000-000000350203' and absence_type = 'on_leave'),
  (select d from fleet_day), 'the leave ended today');
select isnt((select cancelled_at from public.driver_absences where driver_id = '00000000-0000-0000-0000-000000350203' and absence_type = 'day_off'),
  null, 'the upcoming day-off was cancelled too');
insert into public.driver_absences (driver_id, absence_type, start_date, end_date, reason)
select '00000000-0000-0000-0000-000000350204', 'day_off', d + 2, d + 2, 'sick' from fleet_day;
select throws_ok($$select public.end_driver_absence(
  (select id from public.driver_absences where driver_id = '00000000-0000-0000-0000-000000350204'),
  (select updated_at from public.driver_absences where driver_id = '00000000-0000-0000-0000-000000350204'), false)$$,
  '23514', 'Only an absence that covers today can be ended early.', 'an upcoming absence cannot be ended early');

-- Still on leave
insert into public.driver_absences (driver_id, absence_type, start_date, end_date, reason)
select '00000000-0000-0000-0000-000000350205', 'on_leave', d - 20, null, 'family_emergency' from fleet_day;
select lives_ok($$select public.confirm_driver_leave((select id from public.driver_absences where driver_id = '00000000-0000-0000-0000-000000350205'))$$,
  'a current open-ended leave can be marked as still on leave');
select is((select snoozed_until from public.driver_absences where driver_id = '00000000-0000-0000-0000-000000350205'),
  (select d + 7 from fleet_day), 'the flag is snoozed for the snooze setting');
select is((select count(*)::int from public.driver_absence_confirmations c join public.driver_absences a on a.id = c.absence_id
  where a.driver_id = '00000000-0000-0000-0000-000000350205' and c.confirmed_by = '00000000-0000-0000-0000-000000350001'),
  1, 'the confirmation is logged with who confirmed');
select throws_ok($$select public.confirm_driver_leave((select id from public.driver_absences where driver_id = '00000000-0000-0000-0000-000000350201'))$$,
  '23514', 'Only a current open-ended leave can be marked as still on leave.', 'a leave with an end date cannot be marked as still on leave');

select * from finish();
rollback;
