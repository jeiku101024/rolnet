begin;
select plan(20);

-- Feature 013 (20261102000300/400_document_*.sql, data-model.md): the version columns and their
-- rules, the Activity table, and save_compliance_document (first upload, renewal, idempotency, stale
-- and archived checks, license profile date, events written and audited).

insert into auth.users (id, email, aud, role)
values ('00000000-0000-0000-0000-000000370001', 'docver-owner@rolnet.test', 'authenticated', 'authenticated');
update public.profiles
set role = 'owner', account_status = 'approved', approved_at = now(), approved_by = user_id
where user_id = '00000000-0000-0000-0000-000000370001';

insert into public.units (id, body_number, plate_number, make_model, archived, archived_at)
values
  ('00000000-0000-0000-0000-000000370101', 'DV-370-A', 'DV370A', 'Test Tricycle', false, null),
  ('00000000-0000-0000-0000-000000370102', 'DV-370-B', 'DV370B', 'Test Tricycle', true, now());
insert into public.drivers (id, full_name, license_number, license_expiry_date, phone, is_active)
values ('00000000-0000-0000-0000-000000370201', 'Docver Inactive', 'DV-370-L1', '2035-12-31', '09170000370', false);

-- Shape.
select ok((select count(*) = 6 from information_schema.columns where table_schema = 'public' and table_name = 'documents'
  and column_name in ('file_name', 'superseded_at', 'reverted_at', 'reverted_by', 'purge_after', 'file_deleted_at')),
  'documents has the six version columns');
select has_table('public', 'document_events', 'the Activity table exists');
select ok('reverted' = any(enum_range(null::public.document_lifecycle)::text[]), 'the lifecycle has a reverted value');

-- Column rules (as the table owner, so only constraints apply).
select throws_ok($$insert into public.documents (document_type, unit_id, expires_on, lifecycle_status, object_path, mime_type, size_bytes, sha256)
  values ('insurance', '00000000-0000-0000-0000-000000370101', '2032-01-31', 'reverted', 'documents/x/1.pdf', 'application/pdf', 10, 'abc')$$,
  '23514', null, 'a reverted row needs reverted_at, reverted_by and purge_after');
select throws_ok($$insert into public.documents (document_type, unit_id, expires_on, lifecycle_status, object_path, mime_type, size_bytes, sha256, file_deleted_at)
  values ('insurance', '00000000-0000-0000-0000-000000370101', '2032-01-31', 'superseded', 'documents/x/2.pdf', 'application/pdf', 10, 'abc', now())$$,
  '23514', null, 'only reverted rows can have a deleted file');
select throws_ok($$insert into public.documents (document_type, unit_id, expires_on, lifecycle_status, object_path, mime_type, size_bytes, sha256, file_name)
  values ('insurance', '00000000-0000-0000-0000-000000370101', '2032-01-31', 'superseded', 'documents/x/3.pdf', 'application/pdf', 10, 'abc', '   ')$$,
  '23514', null, 'a blank file name is rejected');

select set_config('test.key', gen_random_uuid()::text, true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000370001","role":"authenticated"}', true);
set local role authenticated;

-- First upload.
select is((public.save_compliance_document(jsonb_build_object(
    'document_type', 'or_cr', 'unit_id', '00000000-0000-0000-0000-000000370101', 'document_number', 'OR-1',
    'expires_on', '2031-01-31', 'object_path', 'documents/a/or1.pdf', 'mime_type', 'application/pdf',
    'size_bytes', 100, 'sha256', 'abc', 'file_name', 'or-2025.pdf', 'expected_current_id', null)))->>'renewed',
  'false', 'a first upload is not a renewal');
select is((select file_name || '/' || lifecycle_status from public.documents where unit_id = '00000000-0000-0000-0000-000000370101' and document_type = 'or_cr'),
  'or-2025.pdf/current', 'the first upload is current with its file name');
select is((select kind || ': ' || summary from public.document_events where unit_id = '00000000-0000-0000-0000-000000370101'),
  'uploaded: Uploaded or-2025.pdf.', 'the upload is logged in Activity');

-- Renewal.
select set_config('test.first', (select id::text from public.documents where unit_id = '00000000-0000-0000-0000-000000370101' and document_type = 'or_cr'), true);
select set_config('test.renew', (public.save_compliance_document(jsonb_build_object(
    'document_type', 'or_cr', 'unit_id', '00000000-0000-0000-0000-000000370101', 'expires_on', '2032-01-31',
    'object_path', 'documents/a/or2.pdf', 'mime_type', 'application/pdf', 'size_bytes', 100, 'sha256', 'abc',
    'file_name', 'or-2026.pdf', 'idempotency_key', current_setting('test.key'),
    'expected_current_id', current_setting('test.first'))))::text, true);
select is(current_setting('test.renew')::jsonb->>'renewed', 'true', 'uploading a type the unit has renews it');
select ok((select lifecycle_status = 'superseded' and superseded_at is not null and superseded_by_id = (current_setting('test.renew')::jsonb->>'version_id')::uuid
  from public.documents where id = current_setting('test.first')::uuid), 'the previous version moves to History with superseded_at and its successor');
select is((select summary from public.document_events where kind = 'renewed' and unit_id = '00000000-0000-0000-0000-000000370101'),
  'Renewed with or-2026.pdf. or-2025.pdf moved to history.', 'the renewal summary names both files');
select is((public.save_compliance_document(jsonb_build_object(
    'document_type', 'or_cr', 'unit_id', '00000000-0000-0000-0000-000000370101', 'expires_on', '2032-01-31',
    'object_path', 'documents/a/or2.pdf', 'mime_type', 'application/pdf', 'size_bytes', 100, 'sha256', 'abc',
    'idempotency_key', current_setting('test.key'))))->>'version_id',
  current_setting('test.renew')::jsonb->>'version_id', 'repeating a save with the same key returns the saved version');

-- Refusals.
select throws_ok(format($$select public.save_compliance_document(jsonb_build_object(
    'document_type', 'or_cr', 'unit_id', '00000000-0000-0000-0000-000000370101', 'expires_on', '2033-01-31',
    'object_path', 'documents/a/or3.pdf', 'mime_type', 'application/pdf', 'size_bytes', 100, 'sha256', 'abc',
    'expected_current_id', %L))$$, current_setting('test.first')),
  '40001', 'This document changed since you opened it. Reload and try again.', 'a save against an old current version is refused');
select throws_ok($$select public.save_compliance_document(jsonb_build_object(
    'document_type', 'insurance', 'unit_id', '00000000-0000-0000-0000-000000370102', 'expires_on', '2033-01-31',
    'object_path', 'documents/b/ins.pdf', 'mime_type', 'application/pdf', 'size_bytes', 100, 'sha256', 'abc'))$$,
  'P0001', 'This unit is archived. Choose another unit.', 'an archived unit gets no new documents');

-- A first license for an inactive driver sets the profile date (FR-044a, research R6).
select lives_ok($$select public.save_compliance_document(jsonb_build_object(
    'document_type', 'driver_license', 'driver_id', '00000000-0000-0000-0000-000000370201', 'expires_on', '2036-06-30',
    'object_path', 'documents/l/lic.pdf', 'mime_type', 'application/pdf', 'size_bytes', 100, 'sha256', 'abc', 'file_name', 'lic.pdf'))$$,
  'a first license can be uploaded for an inactive driver');
select is((select license_expiry_date from public.drivers where id = '00000000-0000-0000-0000-000000370201'), '2036-06-30'::date,
  'the driver profile takes the uploaded license expiry');

-- The legacy renewal function still works through the same path.
select is((public.renew_compliance_document((current_setting('test.renew')::jsonb->>'version_id')::uuid, jsonb_build_object(
    'expires_on', '2033-01-31', 'object_path', 'documents/a/or4.pdf', 'mime_type', 'application/pdf', 'size_bytes', 100, 'sha256', 'abc'))).lifecycle_status::text,
  'current', 'renew_compliance_document still returns the new current version');
reset role;

select ok((select count(*) >= 4 from public.audit_events where entity_type = 'document_events'
  and entity_id in (select id from public.document_events where unit_id = '00000000-0000-0000-0000-000000370101' or driver_id = '00000000-0000-0000-0000-000000370201')),
  'every Activity event is in the audit log');
select is((select count(*)::int from public.documents where unit_id = '00000000-0000-0000-0000-000000370101' and document_type = 'or_cr'), 3,
  'all three OR/CR versions are kept');

select finish();
rollback;
