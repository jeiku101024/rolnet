begin;
select plan(9);

-- softDeleteUnit (contracts/actions.md): a unit with current or upcoming assignments cannot be
-- deleted until they are ended or removed (20261029001400).
-- FR-023: a driver's license expiry cannot drift from the current license document; renewal still
-- changes both (20261029001500; renewal itself is covered in 200_replacement_history.sql).

insert into auth.users (id, email, aud, role)
values ('00000000-0000-0000-0000-000000240001', 'gaps-owner@rolnet.test', 'authenticated', 'authenticated');
update public.profiles
set role = 'owner', account_status = 'approved', approved_at = now(), approved_by = user_id
where user_id = '00000000-0000-0000-0000-000000240001';

insert into public.units (id, body_number, plate_number, make_model)
values
  ('00000000-0000-0000-0000-000000240101', 'GAP-240-A', 'GAP240A', 'Test Tricycle'),
  ('00000000-0000-0000-0000-000000240102', 'GAP-240-B', 'GAP240B', 'Test Tricycle'),
  ('00000000-0000-0000-0000-000000240103', 'GAP-240-C', 'GAP240C', 'Test Tricycle');
insert into public.drivers (id, full_name, license_number, license_expiry_date, phone)
values
  ('00000000-0000-0000-0000-000000240201', 'Gap Driver X', 'GAP-240-LX', '2035-12-31', '09170000240'),
  ('00000000-0000-0000-0000-000000240202', 'Gap Driver Y', 'GAP-240-LY', '2035-12-31', '09170000241'),
  ('00000000-0000-0000-0000-000000240203', 'Gap Driver Z', 'GAP-240-LZ', '2035-12-31', '09170000242');
insert into public.documents (id, document_type, driver_id, expires_on, object_path, mime_type, size_bytes, sha256)
values ('00000000-0000-0000-0000-000000240401', 'driver_license', '00000000-0000-0000-0000-000000240201', '2035-12-31', 'documents/gap/license.pdf', 'application/pdf', 100, 'abc');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000240001","role":"authenticated"}', true);
set local role authenticated;

-- Unit A: open primary. Unit B: an upcoming, already-ended range. Unit C: only a past range.
insert into public.driver_assignments (id, unit_id, driver_id, assignment_type, starts_on)
values ('00000000-0000-0000-0000-000000240301', '00000000-0000-0000-0000-000000240101', '00000000-0000-0000-0000-000000240201', 'primary', '2020-02-01');
insert into public.driver_assignments (unit_id, driver_id, assignment_type, starts_on, ends_on)
values ('00000000-0000-0000-0000-000000240102', '00000000-0000-0000-0000-000000240202', 'primary', '2034-01-01', '2034-01-31');
insert into public.driver_assignments (unit_id, driver_id, assignment_type, starts_on, ends_on)
values ('00000000-0000-0000-0000-000000240103', '00000000-0000-0000-0000-000000240203', 'primary', '2020-01-01', '2020-01-31');

select throws_ok($$select public.soft_delete_record('units', '00000000-0000-0000-0000-000000240101')$$,
  '23503', null, 'a unit with an open primary assignment cannot be deleted');
select throws_ok($$select public.soft_delete_record('units', '00000000-0000-0000-0000-000000240102')$$,
  '23503', null, 'a unit with an upcoming assignment cannot be deleted');
select ok((select public.soft_delete_record('units', '00000000-0000-0000-0000-000000240103')) is not null,
  'a unit whose assignments have all ended can be deleted');

update public.driver_assignments
set ends_on = (now() at time zone 'Asia/Manila')::date - 1
where id = '00000000-0000-0000-0000-000000240301';
select ok((select public.soft_delete_record('units', '00000000-0000-0000-0000-000000240101')) is not null,
  'after its assignment is ended, the unit can be deleted');
select ok((select public.soft_delete_record('drivers', '00000000-0000-0000-0000-000000240203')) is not null,
  'the unit rule does not affect deleting other records');

-- License expiry stays in step with the current license document.
select throws_ok($$update public.drivers set license_expiry_date = '2036-06-30' where id = '00000000-0000-0000-0000-000000240201'$$,
  '23514', null, 'the profile expiry cannot differ from the current license document');
select lives_ok($$update public.drivers set phone = '09170000249' where id = '00000000-0000-0000-0000-000000240201'$$,
  'other driver fields can still be edited');
select lives_ok($$update public.drivers set license_expiry_date = '2036-06-30' where id = '00000000-0000-0000-0000-000000240202'$$,
  'a driver without a license document can change the expiry');
select is((select license_expiry_date from public.drivers where id = '00000000-0000-0000-0000-000000240201'), '2035-12-31'::date,
  'the rejected change left the profile expiry unchanged');
reset role;

select finish();
rollback;
