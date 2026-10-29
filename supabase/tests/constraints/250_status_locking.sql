begin;
select plan(16);

-- Feature 005 (20261030000100_status_locking.sql): Inactive drivers and In repair or Retired
-- units have locked details; status changes, mileage, archive/restore and license renewals still
-- work; a driver with current or upcoming assignments cannot be set Inactive.

insert into auth.users (id, email, aud, role)
values
  ('00000000-0000-0000-0000-000000250001', 'lock-owner@rolnet.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000250002', 'lock-staff@rolnet.test', 'authenticated', 'authenticated');
update public.profiles
set role = 'owner', account_status = 'approved', approved_at = now(), approved_by = user_id
where user_id = '00000000-0000-0000-0000-000000250001';
update public.profiles
set role = 'staff', account_status = 'approved', approved_at = now(), approved_by = '00000000-0000-0000-0000-000000250001'
where user_id = '00000000-0000-0000-0000-000000250002';

insert into public.units (id, body_number, plate_number, make_model, status)
values
  ('00000000-0000-0000-0000-000000250101', 'LOCK-250-A', 'LOCK250A', 'Test Tricycle', 'in_repair'),
  ('00000000-0000-0000-0000-000000250102', 'LOCK-250-B', 'LOCK250B', 'Test Tricycle', 'retired'),
  ('00000000-0000-0000-0000-000000250103', 'LOCK-250-C', 'LOCK250C', 'Test Tricycle', 'active');
insert into public.drivers (id, full_name, license_number, license_expiry_date, phone, is_active)
values
  ('00000000-0000-0000-0000-000000250201', 'Lock Driver Inactive', 'LOCK-250-L1', '2035-12-31', '09170000250', false),
  ('00000000-0000-0000-0000-000000250202', 'Lock Driver Assigned', 'LOCK-250-L2', '2035-12-31', '09170000251', true),
  ('00000000-0000-0000-0000-000000250203', 'Lock Driver Ended', 'LOCK-250-L3', '2035-12-31', '09170000252', true),
  ('00000000-0000-0000-0000-000000250204', 'Lock Driver Active', 'LOCK-250-L4', '2035-12-31', '09170000253', true);
insert into public.documents (id, document_type, driver_id, expires_on, object_path, mime_type, size_bytes, sha256)
values
  ('00000000-0000-0000-0000-000000250401', 'driver_license', '00000000-0000-0000-0000-000000250201', '2035-12-31', 'documents/lock/l1.pdf', 'application/pdf', 100, 'abc'),
  ('00000000-0000-0000-0000-000000250402', 'driver_license', '00000000-0000-0000-0000-000000250204', '2035-12-31', 'documents/lock/l4.pdf', 'application/pdf', 100, 'abd');
insert into public.driver_assignments (unit_id, driver_id, assignment_type, starts_on)
values ('00000000-0000-0000-0000-000000250103', '00000000-0000-0000-0000-000000250202', 'primary', '2020-02-01');
insert into public.driver_assignments (unit_id, driver_id, assignment_type, starts_on, ends_on)
values ('00000000-0000-0000-0000-000000250101', '00000000-0000-0000-0000-000000250203', 'primary', '2020-01-01', (now() at time zone 'Asia/Manila')::date - 1);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000250001","role":"authenticated"}', true);
set local role authenticated;

-- Units
select throws_ok($$update public.units set make_model = 'Changed' where id = '00000000-0000-0000-0000-000000250101'$$,
  '23514', null, 'an In repair unit refuses a detail change');
select throws_ok($$update public.units set plate_number = 'NEW250B' where id = '00000000-0000-0000-0000-000000250102'$$,
  '23514', null, 'a Retired unit refuses a detail change');
select lives_ok($$insert into public.mileage_readings (unit_id, reading_date, mileage) values ('00000000-0000-0000-0000-000000250101', '2026-01-10', 1500)$$,
  'a mileage reading is accepted for an In repair unit');
select is((select current_mileage from public.units where id = '00000000-0000-0000-0000-000000250101'), 1500,
  'the reading raised the locked unit''s current mileage');
select ok((select public.soft_delete_record('units', '00000000-0000-0000-0000-000000250102')) is not null,
  'a locked unit can still be archived');
select lives_ok($$update public.units set status = 'active' where id = '00000000-0000-0000-0000-000000250101'$$,
  'a locked unit can be set back to Active');
select lives_ok($$update public.units set make_model = 'Changed' where id = '00000000-0000-0000-0000-000000250101'$$,
  'once Active, the unit''s details can be edited');

-- Drivers
select throws_ok($$update public.drivers set phone = '09179999250' where id = '00000000-0000-0000-0000-000000250201'$$,
  '23514', null, 'an Inactive driver refuses a detail change');
select throws_ok($$update public.drivers set license_expiry_date = '2035-12-30' where id = '00000000-0000-0000-0000-000000250201'$$,
  '23514', null, 'an Inactive driver refuses a direct license expiry change');
select lives_ok($$select public.renew_compliance_document('00000000-0000-0000-0000-000000250401', '{"expires_on":"2037-06-30","object_path":"documents/lock/l1b.pdf","mime_type":"application/pdf","size_bytes":"100","sha256":"abe"}'::jsonb)$$,
  'a license renewal is accepted for an Inactive driver');
select is((select license_expiry_date from public.drivers where id = '00000000-0000-0000-0000-000000250201'), '2037-06-30'::date,
  'the renewal updated the Inactive driver''s expiry');
select lives_ok($$select public.renew_compliance_document('00000000-0000-0000-0000-000000250402', '{"expires_on":"2037-07-31","object_path":"documents/lock/l4b.pdf","mime_type":"application/pdf","size_bytes":"100","sha256":"abf"}'::jsonb)$$,
  'a license renewal still works for an Active driver');
select throws_ok($$update public.drivers set is_active = false where id = '00000000-0000-0000-0000-000000250202'$$,
  '23503', null, 'a driver with a current assignment cannot be set Inactive');
select lives_ok($$update public.drivers set is_active = false where id = '00000000-0000-0000-0000-000000250203'$$,
  'a driver whose assignments have all ended can be set Inactive');
reset role;

-- Staff cannot change a status.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000250002","role":"authenticated"}', true);
set local role authenticated;
update public.units set status = 'in_repair' where id = '00000000-0000-0000-0000-000000250103';
reset role;
select is((select status::text from public.units where id = '00000000-0000-0000-0000-000000250103'), 'active',
  'a staff status change updates no row');

select ok(not has_function_privilege('authenticated', 'public.lock_inactive_driver_details()', 'execute')
  and not has_function_privilege('authenticated', 'public.lock_out_of_service_unit_details()', 'execute')
  and not has_function_privilege('authenticated', 'public.reject_driver_deactivation_with_assignments()', 'execute')
  and not has_function_privilege('anon', 'public.lock_inactive_driver_details()', 'execute'),
  'the new trigger functions are not executable by anon or authenticated');

select finish();
rollback;
