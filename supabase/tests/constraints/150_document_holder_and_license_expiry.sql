begin;
select plan(11);

-- T117 / T118 (FR-023): a document's holder must match its type, and a current driver-license
-- document must expire on the driver profile's license expiry date. The owner writes documents
-- through PostgREST both from the app (REST) and from /api/v1 (lib/domain/crud.ts createRow and
-- updateRow), so each case below runs as the signed-in owner, like both paths.

insert into auth.users (id, email, aud, role)
values ('00000000-0000-0000-0000-000000150001', 'doc-rules-owner@rolnet.test', 'authenticated', 'authenticated');
update public.profiles
set role = 'owner', account_status = 'approved', approved_at = now(), approved_by = user_id
where user_id = '00000000-0000-0000-0000-000000150001';

insert into public.units (id, body_number, plate_number, make_model)
values ('00000000-0000-0000-0000-000000150101', 'DOC-150-A', 'DOC150A', 'Test Tricycle');
insert into public.drivers (id, full_name, license_number, license_expiry_date, phone)
values
  ('00000000-0000-0000-0000-000000150201', 'Doc Driver One', 'DOC-150-L1', '2033-06-30', '09170000150'),
  ('00000000-0000-0000-0000-000000150202', 'Doc Driver Two', 'DOC-150-L2', '2033-07-31', '09170000151');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000150001","role":"authenticated"}', true);
set local role authenticated;

-- Holder and type pairing.
select throws_ok($$insert into public.documents (document_type, unit_id, expires_on, object_path, mime_type, size_bytes, sha256)
  values ('driver_license', '00000000-0000-0000-0000-000000150101', '2033-06-30', 'documents/x/a.pdf', 'application/pdf', 100, 'abc')$$,
  '23514', null, 'a driver license cannot belong to a unit');
select throws_ok($$insert into public.documents (document_type, driver_id, expires_on, object_path, mime_type, size_bytes, sha256)
  values ('or_cr', '00000000-0000-0000-0000-000000150201', '2033-06-30', 'documents/x/a.pdf', 'application/pdf', 100, 'abc')$$,
  '23514', null, 'an OR/CR cannot belong to a driver');
select throws_ok($$insert into public.documents (document_type, driver_id, expires_on, object_path, mime_type, size_bytes, sha256)
  values ('mtop_franchise', '00000000-0000-0000-0000-000000150201', '2033-06-30', 'documents/x/a.pdf', 'application/pdf', 100, 'abc')$$,
  '23514', null, 'an MTOP franchise cannot belong to a driver');
select throws_ok($$insert into public.documents (document_type, driver_id, expires_on, object_path, mime_type, size_bytes, sha256)
  values ('insurance', '00000000-0000-0000-0000-000000150201', '2033-06-30', 'documents/x/a.pdf', 'application/pdf', 100, 'abc')$$,
  '23514', null, 'an insurance document cannot belong to a driver');
select lives_ok($$insert into public.documents (document_type, unit_id, expires_on, object_path, mime_type, size_bytes, sha256)
  values ('or_cr', '00000000-0000-0000-0000-000000150101', '2032-01-31', 'documents/x/b.pdf', 'application/pdf', 100, 'abc')$$,
  'an OR/CR can belong to a unit');

-- License expiry must match the driver profile.
select throws_ok($$insert into public.documents (document_type, driver_id, expires_on, object_path, mime_type, size_bytes, sha256)
  values ('driver_license', '00000000-0000-0000-0000-000000150202', '2033-06-30', 'documents/x/c.pdf', 'application/pdf', 100, 'abc')$$,
  '23514', null, 'a driver license whose expiry differs from the profile is rejected');
select lives_ok($$insert into public.documents (id, document_type, driver_id, expires_on, object_path, mime_type, size_bytes, sha256)
  values ('00000000-0000-0000-0000-000000150301', 'driver_license', '00000000-0000-0000-0000-000000150201', '2033-06-30', 'documents/x/d.pdf', 'application/pdf', 100, 'abc')$$,
  'a driver license matching the profile expiry is accepted');
select throws_ok($$update public.documents set expires_on = '2034-01-31' where id = '00000000-0000-0000-0000-000000150301'$$,
  '23514', null, 'the expiry of a current license cannot be changed away from the profile');
select throws_ok($$update public.documents set driver_id = '00000000-0000-0000-0000-000000150202' where id = '00000000-0000-0000-0000-000000150301'$$,
  '23514', null, 'a current license cannot be moved to a driver with a different profile expiry');
select lives_ok($$update public.documents set document_number = 'N-150' where id = '00000000-0000-0000-0000-000000150301'$$,
  'other license metadata can still be edited');
select lives_ok($$update public.documents set deleted_at = now(), lifecycle_status = 'void' where id = '00000000-0000-0000-0000-000000150301'$$,
  'the owner can still archive a license document');
reset role;

select finish();
rollback;
