begin;
select plan(13);

-- T122 (FR-021, FR-023): replacing a tire and renewing a document succeed in one call and keep the
-- previous row as history.

insert into auth.users (id, email, aud, role)
values
  ('00000000-0000-0000-0000-000000200001', 'replace-owner@rolnet.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000200002', 'replace-staff@rolnet.test', 'authenticated', 'authenticated');
update public.profiles
set role = 'owner', account_status = 'approved', approved_at = now(), approved_by = user_id
where user_id = '00000000-0000-0000-0000-000000200001';
update public.profiles
set account_status = 'approved', approved_at = now(), approved_by = '00000000-0000-0000-0000-000000200001'
where user_id = '00000000-0000-0000-0000-000000200002';

insert into public.units (id, body_number, plate_number, make_model)
values ('00000000-0000-0000-0000-000000200101', 'REP-200-A', 'REP200A', 'Test Tricycle');
insert into public.drivers (id, full_name, license_number, license_expiry_date, phone)
values ('00000000-0000-0000-0000-000000200201', 'Renew Driver', 'REP-200-L1', '2032-06-30', '09170000200');
insert into public.tire_installations (id, unit_id, position, brand, installed_on, cost_centavos, next_due_date)
values ('00000000-0000-0000-0000-000000200301', '00000000-0000-0000-0000-000000200101', 'rear_left', 'Old Tire', '2031-01-01', 100000, '2032-01-01');
insert into public.documents (id, document_type, unit_id, expires_on, object_path, mime_type, size_bytes, sha256)
values ('00000000-0000-0000-0000-000000200401', 'or_cr', '00000000-0000-0000-0000-000000200101', '2031-12-31', 'documents/a/old.pdf', 'application/pdf', 100, 'abc');
insert into public.documents (id, document_type, driver_id, expires_on, object_path, mime_type, size_bytes, sha256)
values ('00000000-0000-0000-0000-000000200402', 'driver_license', '00000000-0000-0000-0000-000000200201', '2032-06-30', 'documents/b/old.pdf', 'application/pdf', 100, 'abc');

-- Staff replace a tire.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000200002","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$select public.replace_tire_installation('00000000-0000-0000-0000-000000200301',
  '{"brand":"New Tire","installed_on":"2031-09-01","cost_centavos":"120000","next_due_date":"2032-09-01"}'::jsonb)$$,
  'staff can replace a current tire');
select is((select count(*) from public.tire_installations where unit_id = '00000000-0000-0000-0000-000000200101' and position = 'rear_left' and replaced_by_id is null),
  1::bigint, 'exactly one tire is current in the position');
select is((select brand from public.tire_installations where unit_id = '00000000-0000-0000-0000-000000200101' and position = 'rear_left' and replaced_by_id is null),
  'New Tire', 'the replacement is the current tire');
select is((select replaced_by_id from public.tire_installations where id = '00000000-0000-0000-0000-000000200301'),
  (select id from public.tire_installations where unit_id = '00000000-0000-0000-0000-000000200101' and position = 'rear_left' and replaced_by_id is null),
  'the old tire is kept and points at its replacement');
select throws_ok($$select public.renew_compliance_document('00000000-0000-0000-0000-000000200401', '{"expires_on":"2032-12-31","object_path":"documents/c/new.pdf","mime_type":"application/pdf","size_bytes":"100","sha256":"def"}'::jsonb)$$,
  '42501', null, 'staff cannot renew documents');
reset role;

-- The owner renews an OR/CR and a driver license.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000200001","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$select public.renew_compliance_document('00000000-0000-0000-0000-000000200401', '{"expires_on":"2032-12-31","object_path":"documents/c/new.pdf","mime_type":"application/pdf","size_bytes":"100","sha256":"def"}'::jsonb)$$,
  'the owner can renew an OR/CR');
select is((select lifecycle_status::text from public.documents where id = '00000000-0000-0000-0000-000000200401'), 'superseded', 'the previous OR/CR is kept as superseded');
select is((select superseded_by_id from public.documents where id = '00000000-0000-0000-0000-000000200401'),
  (select id from public.documents where unit_id = '00000000-0000-0000-0000-000000200101' and document_type = 'or_cr' and lifecycle_status = 'current' and deleted_at is null),
  'the previous OR/CR points at the renewal');
select is((select expires_on from public.documents where unit_id = '00000000-0000-0000-0000-000000200101' and document_type = 'or_cr' and lifecycle_status = 'current' and deleted_at is null),
  '2032-12-31'::date, 'the renewal is the current OR/CR');
select lives_ok($$select public.renew_compliance_document('00000000-0000-0000-0000-000000200402', '{"expires_on":"2037-06-30","object_path":"documents/d/new.pdf","mime_type":"application/pdf","size_bytes":"100","sha256":"def"}'::jsonb)$$,
  'the owner can renew a driver license');
select is((select license_expiry_date from public.drivers where id = '00000000-0000-0000-0000-000000200201'), '2037-06-30'::date,
  'renewing the license updates the driver profile');
select is((select expires_on from public.documents where driver_id = '00000000-0000-0000-0000-000000200201' and lifecycle_status = 'current' and deleted_at is null),
  '2037-06-30'::date, 'the renewed license matches the profile');
select is((select count(*) from public.documents where driver_id = '00000000-0000-0000-0000-000000200201'), 2::bigint,
  'the previous license is kept as history');
reset role;

select finish();
rollback;
