begin;
select plan(14);

-- T120 (FR-011, US1 scenario 3): a primary assignment can be ended and the unit reassigned.
-- T125 (FR-012): a driver cannot be booked as backup on a date already covered by another of
-- their assignments, nor given a primary range over a date they cover as backup elsewhere.

insert into auth.users (id, email, aud, role)
values ('00000000-0000-0000-0000-000000170001', 'assign-owner@rolnet.test', 'authenticated', 'authenticated');
update public.profiles
set role = 'owner', account_status = 'approved', approved_at = now(), approved_by = user_id
where user_id = '00000000-0000-0000-0000-000000170001';

insert into public.units (id, body_number, plate_number, make_model)
values
  ('00000000-0000-0000-0000-000000170101', 'ASG-170-A', 'ASG170A', 'Test Tricycle'),
  ('00000000-0000-0000-0000-000000170102', 'ASG-170-B', 'ASG170B', 'Test Tricycle'),
  ('00000000-0000-0000-0000-000000170103', 'ASG-170-C', 'ASG170C', 'Test Tricycle'),
  ('00000000-0000-0000-0000-000000170104', 'ASG-170-D', 'ASG170D', 'Test Tricycle');
insert into public.drivers (id, full_name, license_number, license_expiry_date, phone)
values
  ('00000000-0000-0000-0000-000000170201', 'Assign Driver X', 'ASG-170-LX', '2035-12-31', '09170000170'),
  ('00000000-0000-0000-0000-000000170202', 'Assign Driver Y', 'ASG-170-LY', '2035-12-31', '09170000171'),
  ('00000000-0000-0000-0000-000000170203', 'Assign Driver Z', 'ASG-170-LZ', '2035-12-31', '09170000172'),
  ('00000000-0000-0000-0000-000000170204', 'Assign Driver W', 'ASG-170-LW', '2035-12-31', '09170000173');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000170001","role":"authenticated"}', true);
set local role authenticated;

-- End a primary assignment and reassign the unit (T120).
select lives_ok($$insert into public.driver_assignments (id, unit_id, driver_id, assignment_type, starts_on)
  values ('00000000-0000-0000-0000-000000170301', '00000000-0000-0000-0000-000000170101', '00000000-0000-0000-0000-000000170201', 'primary', '2031-03-01')$$,
  'the owner assigns an open primary driver');
select lives_ok($$update public.driver_assignments set ends_on = '2031-03-31' where id = '00000000-0000-0000-0000-000000170301'$$,
  'the owner can end a primary assignment');
select is((select ends_on from public.driver_assignments where id = '00000000-0000-0000-0000-000000170301'), '2031-03-31'::date,
  'the end date is saved');
select lives_ok($$insert into public.driver_assignments (id, unit_id, driver_id, assignment_type, starts_on)
  values ('00000000-0000-0000-0000-000000170302', '00000000-0000-0000-0000-000000170101', '00000000-0000-0000-0000-000000170202', 'primary', '2031-04-01')$$,
  'the unit can be reassigned to a new primary driver after the end date');
select throws_ok($$insert into public.driver_assignments (unit_id, driver_id, assignment_type, starts_on, ends_on)
  values ('00000000-0000-0000-0000-000000170101', '00000000-0000-0000-0000-000000170203', 'primary', '2031-03-15', '2031-04-15')$$,
  '23P01', null, 'overlapping primary ranges for a unit are still rejected');
select lives_ok($$insert into public.driver_assignments (id, unit_id, driver_id, assignment_type, starts_on, ends_on)
  values ('00000000-0000-0000-0000-000000170303', '00000000-0000-0000-0000-000000170102', '00000000-0000-0000-0000-000000170203', 'primary', '2031-04-01', '2031-04-30')$$,
  'a primary assignment can be created with an end date');

-- Backup coverage for a driver who is busy elsewhere (T125).
select throws_ok($$insert into public.driver_assignments (unit_id, driver_id, assignment_type, starts_on, ends_on, covered_primary_assignment_id)
  values ('00000000-0000-0000-0000-000000170101', '00000000-0000-0000-0000-000000170203', 'backup', '2031-04-10', '2031-04-10', '00000000-0000-0000-0000-000000170302')$$,
  '23P01', null, 'a driver whose primary range covers the date cannot be backup on another unit');
select lives_ok($$insert into public.driver_assignments (id, unit_id, driver_id, assignment_type, starts_on, ends_on, covered_primary_assignment_id)
  values ('00000000-0000-0000-0000-000000170304', '00000000-0000-0000-0000-000000170101', '00000000-0000-0000-0000-000000170201', 'backup', '2031-04-10', '2031-04-10', '00000000-0000-0000-0000-000000170302')$$,
  'a driver whose primary assignment has ended can be backup');
select lives_ok($$update public.driver_assignments set reason = 'sick leave' where id = '00000000-0000-0000-0000-000000170304'$$,
  'a saved backup assignment can be edited');
select throws_ok($$insert into public.driver_assignments (unit_id, driver_id, assignment_type, starts_on)
  values ('00000000-0000-0000-0000-000000170103', '00000000-0000-0000-0000-000000170201', 'primary', '2031-04-05')$$,
  '23P01', null, 'a primary range cannot cover a date the driver is backup elsewhere');
select lives_ok($$insert into public.driver_assignments (unit_id, driver_id, assignment_type, starts_on)
  values ('00000000-0000-0000-0000-000000170103', '00000000-0000-0000-0000-000000170201', 'primary', '2031-04-11')$$,
  'a primary range after the backup date is accepted');
select throws_ok($$insert into public.driver_assignments (unit_id, driver_id, assignment_type, starts_on, ends_on, covered_primary_assignment_id)
  values ('00000000-0000-0000-0000-000000170101', '00000000-0000-0000-0000-000000170204', 'backup', '2031-04-12', '2031-04-13', '00000000-0000-0000-0000-000000170302')$$,
  '23514', null, 'backup coverage still spans exactly one day');
reset role;

-- An inactive driver's primary assignment can still be ended (no eligibility re-check on end).
insert into public.driver_assignments (id, unit_id, driver_id, assignment_type, starts_on)
values ('00000000-0000-0000-0000-000000170305', '00000000-0000-0000-0000-000000170104', '00000000-0000-0000-0000-000000170204', 'primary', '2031-03-01');
update public.drivers set is_active = false where id = '00000000-0000-0000-0000-000000170204';
set local role authenticated;
select lives_ok($$update public.driver_assignments set ends_on = '2031-03-31' where id = '00000000-0000-0000-0000-000000170305'$$,
  'the owner can end the primary assignment of a driver who is no longer active');
select throws_ok($$insert into public.driver_assignments (unit_id, driver_id, assignment_type, starts_on)
  values ('00000000-0000-0000-0000-000000170104', '00000000-0000-0000-0000-000000170204', 'primary', '2031-04-01')$$,
  '23514', null, 'an inactive driver still cannot receive a new assignment');
reset role;

select finish();
rollback;
