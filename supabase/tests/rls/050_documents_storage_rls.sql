begin;
select plan(28);

-- FR-022 / FR-023: compliance documents, their files and the notification outbox are owner-only.
-- Anon is denied outright; pending users and approved staff see and change nothing.

insert into auth.users (id, email, aud, role)
values
  ('00000000-0000-0000-0000-000000055001', 'docrls-owner@rolnet.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000055002', 'docrls-staff@rolnet.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000055003', 'docrls-pending@rolnet.test', 'authenticated', 'authenticated');
update public.profiles
set role = 'owner', account_status = 'approved', approved_at = now(), approved_by = user_id
where user_id = '00000000-0000-0000-0000-000000055001';
update public.profiles
set account_status = 'approved', approved_at = now(), approved_by = '00000000-0000-0000-0000-000000055001'
where user_id = '00000000-0000-0000-0000-000000055002';

insert into public.units (id, body_number, plate_number, make_model)
values ('00000000-0000-0000-0000-000000055101', 'DCR-055-A', 'DCR055A', 'Test Tricycle');
insert into public.documents (id, document_type, unit_id, document_number, expires_on, object_path, mime_type, size_bytes, sha256)
values ('00000000-0000-0000-0000-000000055301', 'or_cr', '00000000-0000-0000-0000-000000055101', 'OR-055', '2031-05-05',
        'documents/00000000-0000-0000-0000-000000055101/or.pdf', 'application/pdf', 1000, 'abc');
insert into public.notification_outbox (id, event_type, entity_type, entity_id, threshold_key, scheduled_for, deduplication_key)
values ('00000000-0000-0000-0000-000000055401', 'document_expiring', 'documents', '00000000-0000-0000-0000-000000055301', 'due_7', now(), 'docrls-055301-due_7');
insert into storage.objects (bucket_id, name)
values ('documents', 'documents/00000000-0000-0000-0000-000000055101/or.pdf');

select policies_are('public', 'documents', array['documents_owner_select', 'documents_owner_insert', 'documents_owner_update'], 'document policies exist');
select policies_are('public', 'notification_outbox', array['outbox_owner_read'], 'outbox policies exist');
-- storage.objects is shared with the receipts bucket, so compare only the documents_storage_* policies.
select set_eq(
  $$select policyname::text from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like 'documents\_storage\_%'$$,
  array['documents_storage_owner_read', 'documents_storage_owner_insert', 'documents_storage_owner_delete'],
  'document storage policies exist'
);
select is((select public from storage.buckets where id = 'documents'), false, 'the document bucket is private');

-- Signed-out visitor.
set local role anon;
select throws_ok($$select 1 from public.documents$$, '42501', null, 'anon cannot read documents');
select throws_ok($$select 1 from public.notification_outbox$$, '42501', null, 'anon cannot read the outbox');
select is_empty($$select 1 from storage.objects where bucket_id = 'documents'$$, 'anon cannot list document files');
reset role;

-- Signed-in user whose registration is still pending.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000055003","role":"authenticated"}', true);
set local role authenticated;
select is_empty($$select 1 from public.documents where id = '00000000-0000-0000-0000-000000055301'$$, 'a pending user sees no documents');
select is_empty($$select 1 from public.expiring_documents('2031-05-01') where id = '00000000-0000-0000-0000-000000055301'$$, 'a pending user sees no expiring documents');
select throws_ok($$insert into public.documents (document_type, unit_id, expires_on, object_path, mime_type, size_bytes, sha256)
  values ('insurance', '00000000-0000-0000-0000-000000055101', '2032-01-31', 'documents/x.pdf', 'application/pdf', 1000, 'abc')$$,
  '42501', null, 'a pending user cannot record documents');
reset role;

-- Approved staff.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000055002","role":"authenticated"}', true);
set local role authenticated;
select is_empty($$select 1 from public.documents where id = '00000000-0000-0000-0000-000000055301'$$, 'staff see no documents');
select is_empty($$select 1 from public.expiring_documents('2031-05-01') where id = '00000000-0000-0000-0000-000000055301'$$, 'staff see no expiring documents');
select is_empty($$select 1 from public.notification_outbox where id = '00000000-0000-0000-0000-000000055401'$$, 'staff see no outbox rows');
select throws_ok($$insert into public.documents (document_type, unit_id, expires_on, object_path, mime_type, size_bytes, sha256)
  values ('insurance', '00000000-0000-0000-0000-000000055101', '2032-01-31', 'documents/x.pdf', 'application/pdf', 1000, 'abc')$$,
  '42501', null, 'staff cannot record documents');
update public.documents set document_number = 'STAFF-EDIT' where id = '00000000-0000-0000-0000-000000055301';
select throws_ok($$select public.renew_compliance_document('00000000-0000-0000-0000-000000055301', '{"expires_on":"2032-05-05"}'::jsonb)$$,
  '42501', null, 'staff cannot renew documents');
select is_empty($$select 1 from storage.objects where bucket_id = 'documents' and name like 'documents/00000000-0000-0000-0000-000000055101/%'$$, 'staff cannot read document files');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('documents', 'documents/00000000-0000-0000-0000-000000055101/staff.pdf')$$,
  '42501', null, 'staff cannot upload document files');
reset role;

-- Approved owner.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000055001","role":"authenticated"}', true);
set local role authenticated;
select is((select document_number from public.documents where id = '00000000-0000-0000-0000-000000055301'), 'OR-055', 'the owner reads documents, unchanged by the staff edit');
select is((select bucket from public.expiring_documents('2031-05-01') where id = '00000000-0000-0000-0000-000000055301'), 'due_7', 'the owner sees expiring documents');
select isnt_empty($$select 1 from public.notification_outbox where id = '00000000-0000-0000-0000-000000055401'$$, 'the owner reads the outbox');
select throws_ok($$insert into public.notification_outbox (event_type, entity_type, entity_id, threshold_key, scheduled_for, deduplication_key)
  values ('document_expiring', 'documents', '00000000-0000-0000-0000-000000055301', 'due_30', now(), 'docrls-055301-due_30')$$,
  '42501', null, 'the owner cannot queue outbox rows directly');
select lives_ok($$insert into public.documents (id, document_type, unit_id, expires_on, object_path, mime_type, size_bytes, sha256)
  values ('00000000-0000-0000-0000-000000055302', 'insurance', '00000000-0000-0000-0000-000000055101', '2032-01-31', 'documents/x.pdf', 'application/pdf', 1000, 'abc')$$,
  'the owner records documents');
select is((select created_by from public.documents where id = '00000000-0000-0000-0000-000000055302'), '00000000-0000-0000-0000-000000055001'::uuid, 'the owner is recorded as creator');
select lives_ok($$update public.documents set document_number = 'OWNER-EDIT' where id = '00000000-0000-0000-0000-000000055301'$$, 'the owner edits documents');
select is((select document_number from public.documents where id = '00000000-0000-0000-0000-000000055301'), 'OWNER-EDIT', 'the owner''s edit is saved');
select lives_ok($$update public.documents set deleted_at = now(), lifecycle_status = 'void' where id = '00000000-0000-0000-0000-000000055302'$$, 'the owner archives a document');
select isnt_empty($$select 1 from storage.objects where bucket_id = 'documents' and name = 'documents/00000000-0000-0000-0000-000000055101/or.pdf'$$, 'the owner reads document files');
select lives_ok($$insert into storage.objects (bucket_id, name) values ('documents', 'documents/00000000-0000-0000-0000-000000055101/owner.pdf')$$, 'the owner uploads document files');
reset role;

select finish();
rollback;
