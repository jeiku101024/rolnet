begin;
select plan(12);

-- Feature 013 (FR-046, contracts/database.md): the owner can save, revert, restore and bring back
-- documents and read Activity; staff, unapproved users and anon can't; nobody can write, change or
-- delete Activity directly; only the service role can mark purged files.

insert into auth.users (id, email, aud, role)
values
  ('00000000-0000-0000-0000-000000240001', 'docr-owner@rolnet.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000240002', 'docr-staff@rolnet.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000240003', 'docr-pending@rolnet.test', 'authenticated', 'authenticated');
update public.profiles
set role = 'owner', account_status = 'approved', approved_at = now(), approved_by = user_id
where user_id = '00000000-0000-0000-0000-000000240001';
update public.profiles
set account_status = 'approved', approved_at = now(), approved_by = '00000000-0000-0000-0000-000000240001'
where user_id = '00000000-0000-0000-0000-000000240002';

insert into public.units (id, body_number, plate_number, make_model)
values ('00000000-0000-0000-0000-000000240101', 'DOCR-240', 'DOCR240', 'Test Tricycle');

-- Owner
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000240001","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$select public.save_compliance_document(jsonb_build_object('document_type', 'insurance', 'unit_id', '00000000-0000-0000-0000-000000240101',
  'expires_on', '2032-01-31', 'object_path', 'documents/r/1.pdf', 'mime_type', 'application/pdf', 'size_bytes', 100, 'sha256', 'abc', 'file_name', 'r-1.pdf'))$$,
  'the owner can upload a document');
select lives_ok($$select public.save_compliance_document(jsonb_build_object('document_type', 'insurance', 'unit_id', '00000000-0000-0000-0000-000000240101',
  'expires_on', '2033-01-31', 'object_path', 'documents/r/2.pdf', 'mime_type', 'application/pdf', 'size_bytes', 100, 'sha256', 'abc', 'file_name', 'r-2.pdf'))$$,
  'the owner can renew it');
select is((select count(*)::int from public.document_events where unit_id = '00000000-0000-0000-0000-000000240101'), 2, 'the owner reads Activity');
select lives_ok($$select public.revert_document_upload((select id from public.documents where unit_id = '00000000-0000-0000-0000-000000240101' and lifecycle_status = 'current'))$$,
  'the owner can revert an upload');
select throws_ok($$insert into public.document_events (document_type, unit_id, kind, version_id, summary)
  values ('insurance', '00000000-0000-0000-0000-000000240101', 'uploaded', (select id from public.documents where unit_id = '00000000-0000-0000-0000-000000240101' limit 1), 'Forged.')$$,
  '42501', null, 'Activity can''t be written directly, even by the owner');
select is_empty($$update public.document_events set summary = 'Changed.' where unit_id = '00000000-0000-0000-0000-000000240101' returning id$$,
  'Activity can''t be changed');

-- Approved staff
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000240002","role":"authenticated"}', true);
select throws_ok($$select public.revert_document_upload((select id from public.documents where unit_id = '00000000-0000-0000-0000-000000240101' and lifecycle_status = 'current'))$$,
  '42501', 'Owner access is required', 'staff can''t revert documents');
select throws_ok($$select public.save_compliance_document(jsonb_build_object('document_type', 'insurance', 'unit_id', '00000000-0000-0000-0000-000000240101',
  'expires_on', '2034-01-31', 'object_path', 'documents/r/3.pdf', 'mime_type', 'application/pdf', 'size_bytes', 100, 'sha256', 'abc'))$$,
  '42501', 'Owner access is required', 'staff can''t upload documents');
select is_empty($$select 1 from public.document_events$$, 'staff see no Activity');

-- Unapproved user
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000240003","role":"authenticated"}', true);
select throws_ok($$select public.restore_document_version(gen_random_uuid(), null)$$, '42501', 'Owner access is required', 'an unapproved user can''t restore');
reset role;

-- Anon
set local role anon;
select throws_ok($$select public.bring_back_document_version(gen_random_uuid(), null)$$, '42501', null, 'anon can''t bring back documents');
reset role;

select throws_ok($$delete from public.document_events where unit_id = '00000000-0000-0000-0000-000000240101'$$,
  null, null, 'Activity rows are never deleted');

select finish();
rollback;
