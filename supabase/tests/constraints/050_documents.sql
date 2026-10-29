begin;
select plan(22);

-- FR-022 / FR-023: compliance documents have exactly one holder, one current document per type
-- and holder, file limits (images or PDF up to 5 MB), and expiring_documents() buckets current
-- documents by expiry. Holder/type pairing and license expiry (T117, T118) are covered in
-- 150_document_holder_and_license_expiry.sql, renewal (T122) in 200_replacement_history.sql and
-- the Manila default date (T127) in 230_fleet_date_defaults.sql.

insert into auth.users (id, email, aud, role)
values ('00000000-0000-0000-0000-000000050001', 'docs-owner@rolnet.test', 'authenticated', 'authenticated');
update public.profiles
set role = 'owner', account_status = 'approved', approved_at = now(), approved_by = user_id
where user_id = '00000000-0000-0000-0000-000000050001';

insert into public.units (id, body_number, plate_number, make_model)
values
  ('00000000-0000-0000-0000-000000050101', 'DOC-050-A', 'DOC050A', 'Test Tricycle'),
  ('00000000-0000-0000-0000-000000050103', 'DOC-050-C', 'DOC050C', 'Test Tricycle'),
  ('00000000-0000-0000-0000-000000050104', 'DOC-050-D', 'DOC050D', 'Test Tricycle');
insert into public.drivers (id, full_name, license_number, license_expiry_date, phone)
values ('00000000-0000-0000-0000-000000050201', 'Docs Driver', 'DOC-050-L1', '2035-12-31', '09170000501');

-- Expiry fixtures, checked as of 2031-05-01.
insert into public.documents (id, document_type, unit_id, expires_on, lifecycle_status, object_path, mime_type, size_bytes, sha256, deleted_at)
values
  ('00000000-0000-0000-0000-000000050301', 'or_cr', '00000000-0000-0000-0000-000000050103', '2031-04-20', 'current', 'documents/c/or.pdf', 'application/pdf', 1000, 'abc', null),
  ('00000000-0000-0000-0000-000000050302', 'insurance', '00000000-0000-0000-0000-000000050103', '2031-05-08', 'current', 'documents/c/ins.pdf', 'application/pdf', 1000, 'abc', null),
  ('00000000-0000-0000-0000-000000050303', 'mtop_franchise', '00000000-0000-0000-0000-000000050103', '2031-05-31', 'current', 'documents/c/mtop.pdf', 'application/pdf', 1000, 'abc', null),
  ('00000000-0000-0000-0000-000000050304', 'or_cr', '00000000-0000-0000-0000-000000050104', '2031-06-01', 'current', 'documents/d/or.pdf', 'application/pdf', 1000, 'abc', null),
  ('00000000-0000-0000-0000-000000050305', 'insurance', '00000000-0000-0000-0000-000000050104', '2031-04-25', 'superseded', 'documents/d/ins.pdf', 'application/pdf', 1000, 'abc', null),
  ('00000000-0000-0000-0000-000000050306', 'mtop_franchise', '00000000-0000-0000-0000-000000050104', '2031-04-25', 'current', 'documents/d/mtop.pdf', 'application/pdf', 1000, 'abc', now());
select set_config('test.idem', gen_random_uuid()::text, true);

-- The owner records documents.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000050001","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(format($$insert into public.documents (document_type, unit_id, expires_on, object_path, mime_type, size_bytes, sha256, idempotency_key)
  values ('or_cr', '00000000-0000-0000-0000-000000050101', '2032-01-31', 'documents/a/or.jpg', 'image/jpeg', 1000, 'abc', %L)$$, current_setting('test.idem')),
  'an OR/CR is recorded for a unit');
select throws_ok($$insert into public.documents (document_type, unit_id, expires_on, object_path, mime_type, size_bytes, sha256)
  values ('or_cr', '00000000-0000-0000-0000-000000050101', '2033-01-31', 'documents/a/or2.jpg', 'image/jpeg', 1000, 'abc')$$,
  '23505', null, 'a second current OR/CR for the unit is rejected');
select lives_ok($$insert into public.documents (document_type, unit_id, expires_on, lifecycle_status, object_path, mime_type, size_bytes, sha256)
  values ('or_cr', '00000000-0000-0000-0000-000000050101', '2031-01-31', 'superseded', 'documents/a/or-old.jpg', 'image/jpeg', 1000, 'abc')$$,
  'an older superseded OR/CR is kept alongside the current one');
select lives_ok($$insert into public.documents (document_type, unit_id, expires_on, object_path, mime_type, size_bytes, sha256)
  values ('insurance', '00000000-0000-0000-0000-000000050101', '2032-01-31', 'documents/a/ins.png', 'image/png', 1000, 'abc')$$,
  'another document type is recorded for the same unit');
select lives_ok($$insert into public.documents (document_type, driver_id, expires_on, object_path, mime_type, size_bytes, sha256)
  values ('driver_license', '00000000-0000-0000-0000-000000050201', '2035-12-31', 'documents/l/lic.webp', 'image/webp', 1000, 'abc')$$,
  'a driver license is recorded for a driver');
select throws_ok($$insert into public.documents (document_type, driver_id, expires_on, object_path, mime_type, size_bytes, sha256)
  values ('driver_license', '00000000-0000-0000-0000-000000050201', '2035-12-31', 'documents/l/lic2.webp', 'image/webp', 1000, 'abc')$$,
  '23505', null, 'a second current license for the driver is rejected');
select throws_ok($$insert into public.documents (document_type, unit_id, driver_id, expires_on, object_path, mime_type, size_bytes, sha256)
  values ('mtop_franchise', '00000000-0000-0000-0000-000000050101', '00000000-0000-0000-0000-000000050201', '2032-01-31', 'documents/x.pdf', 'application/pdf', 1000, 'abc')$$,
  '23514', null, 'a document cannot have two holders');
select throws_ok($$insert into public.documents (document_type, expires_on, object_path, mime_type, size_bytes, sha256)
  values ('mtop_franchise', '2032-01-31', 'documents/x.pdf', 'application/pdf', 1000, 'abc')$$,
  '23514', null, 'a document needs a holder');
select throws_ok($$insert into public.documents (document_type, unit_id, expires_on, object_path, mime_type, size_bytes, sha256)
  values ('mtop_franchise', '00000000-0000-0000-0000-000000050101', '2032-01-31', 'documents/x.txt', 'text/plain', 1000, 'abc')$$,
  '23514', null, 'a file that is not an image or PDF is rejected');
select throws_ok($$insert into public.documents (document_type, unit_id, expires_on, object_path, mime_type, size_bytes, sha256)
  values ('mtop_franchise', '00000000-0000-0000-0000-000000050101', '2032-01-31', 'documents/x.pdf', 'application/pdf', 0, 'abc')$$,
  '23514', null, 'an empty file is rejected');
select throws_ok($$insert into public.documents (document_type, unit_id, expires_on, object_path, mime_type, size_bytes, sha256)
  values ('mtop_franchise', '00000000-0000-0000-0000-000000050101', '2032-01-31', 'documents/x.pdf', 'application/pdf', 5242881, 'abc')$$,
  '23514', null, 'a file over 5 MB is rejected');
select lives_ok($$insert into public.documents (document_type, unit_id, expires_on, object_path, mime_type, size_bytes, sha256)
  values ('mtop_franchise', '00000000-0000-0000-0000-000000050101', '2032-01-31', 'documents/x.pdf', 'application/pdf', 5242880, 'abc')$$,
  'a 5 MB PDF is accepted');
select throws_ok($$insert into public.documents (document_type, unit_id, expires_on, object_path, mime_type, size_bytes, sha256)
  values ('mtop_franchise', '00000000-0000-0000-0000-000000050101', null, 'documents/y.pdf', 'application/pdf', 1000, 'abc')$$,
  '23502', null, 'an expiry date is required');
select throws_ok($$insert into public.documents (document_type, unit_id, expires_on, object_path, mime_type, size_bytes, sha256)
  values ('barangay_permit', '00000000-0000-0000-0000-000000050101', '2032-01-31', 'documents/y.pdf', 'application/pdf', 1000, 'abc')$$,
  '22P02', null, 'an unknown document type is rejected');
select throws_ok(format($$insert into public.documents (document_type, unit_id, expires_on, lifecycle_status, object_path, mime_type, size_bytes, sha256, idempotency_key)
  values ('or_cr', '00000000-0000-0000-0000-000000050101', '2030-01-31', 'superseded', 'documents/a/or3.jpg', 'image/jpeg', 1000, 'abc', %L)$$, current_setting('test.idem')),
  '23505', null, 'a repeated idempotency key is rejected');

-- Expiry buckets as of 2031-05-01: expired, within 7 days, within 30 days, in expiry order.
select is(
  (select array_agg(e.bucket) from public.expiring_documents('2031-05-01') e
   where e.unit_id in ('00000000-0000-0000-0000-000000050103', '00000000-0000-0000-0000-000000050104')),
  array['expired', 'due_7', 'due_30'],
  'expiring documents are bucketed and ordered by expiry');
select is_empty($$select 1 from public.expiring_documents('2031-05-01') where id in
  ('00000000-0000-0000-0000-000000050304', '00000000-0000-0000-0000-000000050305', '00000000-0000-0000-0000-000000050306')$$,
  'documents beyond 30 days, superseded or soft-deleted are not listed');
reset role;

select has_index('public', 'documents', 'documents_expiry_idx', 'current documents are indexed by expiry');
select throws_ok($$delete from public.documents where id = '00000000-0000-0000-0000-000000050301'$$, '23514', null, 'documents cannot be hard-deleted');

-- Notification outbox rows are deduplicated.
select lives_ok($$insert into public.notification_outbox (id, event_type, entity_type, entity_id, threshold_key, scheduled_for, deduplication_key)
  values ('00000000-0000-0000-0000-000000050401', 'document_expiring', 'documents', '00000000-0000-0000-0000-000000050302', 'due_7', now(), 'doc-050302-due_7')$$,
  'an outbox notification is queued');
select is((select status::text from public.notification_outbox where id = '00000000-0000-0000-0000-000000050401'), 'pending', 'a queued notification starts pending');
select throws_ok($$insert into public.notification_outbox (event_type, entity_type, entity_id, threshold_key, scheduled_for, deduplication_key)
  values ('document_expiring', 'documents', '00000000-0000-0000-0000-000000050302', 'due_7', now(), 'doc-050302-due_7')$$,
  '23505', null, 'the same notification is not queued twice');

select finish();
rollback;
