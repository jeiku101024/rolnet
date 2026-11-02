begin;
select plan(36);

-- Feature 013 (20261102000400_document_versions.sql, contracts/database.md): revert (with history
-- and as removal), restore, bring back (swap, recreate, file deleted), the stale checks, the
-- driver profile license date after every action for active and inactive drivers (FR-044a,
-- research R6), mark_document_files_deleted, and that no row is ever deleted.

insert into auth.users (id, email, aud, role)
values ('00000000-0000-0000-0000-000000380001', 'docrev-owner@rolnet.test', 'authenticated', 'authenticated');
update public.profiles
set role = 'owner', account_status = 'approved', approved_at = now(), approved_by = user_id
where user_id = '00000000-0000-0000-0000-000000380001';

insert into public.units (id, body_number, plate_number, make_model)
values
  ('00000000-0000-0000-0000-000000380101', 'DR-380-A', 'DR380A', 'Test Tricycle'),
  ('00000000-0000-0000-0000-000000380102', 'DR-380-B', 'DR380B', 'Test Tricycle');
insert into public.drivers (id, full_name, license_number, license_expiry_date, phone, is_active)
values
  ('00000000-0000-0000-0000-000000380201', 'Docrev Active', 'DR-380-L1', '2035-12-31', '09170000380', true),
  ('00000000-0000-0000-0000-000000380202', 'Docrev Inactive', 'DR-380-L2', '2035-12-31', '09170000381', false);

-- up(type, unit, driver, expires, file name) saves a version and returns its id.
create function pg_temp.up(t text, u uuid, d uuid, e date, n text) returns uuid language sql as $f$ select (public.save_compliance_document(jsonb_build_object('document_type', t, 'unit_id', u, 'driver_id', d, 'expires_on', e, 'object_path', 'documents/t/' || n, 'mime_type', 'application/pdf', 'size_bytes', 100, 'sha256', 'abc', 'file_name', n))->>'version_id')::uuid $f$;
create function pg_temp.cur(t text, u uuid, d uuid) returns uuid language sql as $f$ select id from public.documents where document_type = t::public.document_type and unit_id is not distinct from u and driver_id is not distinct from d and lifecycle_status = 'current' and deleted_at is null $f$;
create function pg_temp.lic(d uuid) returns date language sql as $f$ select license_expiry_date from public.drivers where id = d $f$;
grant execute on function pg_temp.up(text, uuid, uuid, date, text), pg_temp.cur(text, uuid, uuid), pg_temp.lic(uuid) to authenticated, service_role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000380001","role":"authenticated"}', true);
set local role authenticated;

-- A. Revert steps back one version at a time.
select set_config('t.i1', pg_temp.up('insurance', '00000000-0000-0000-0000-000000380101', null, '2030-01-31', 'ins-1.pdf')::text, true);
select set_config('t.i2', pg_temp.up('insurance', '00000000-0000-0000-0000-000000380101', null, '2031-01-31', 'ins-2.pdf')::text, true);
select set_config('t.i3', pg_temp.up('insurance', '00000000-0000-0000-0000-000000380101', null, '2032-01-31', 'ins-3.pdf')::text, true);
select is(public.revert_document_upload(current_setting('t.i3')::uuid)->>'result', 'previous', 'reverting a renewal restores the previous version');
select is(pg_temp.cur('insurance', '00000000-0000-0000-0000-000000380101', null)::text, current_setting('t.i2'), 'the previous version is current again');
select ok((select lifecycle_status = 'reverted' and reverted_by = '00000000-0000-0000-0000-000000380001' and purge_after = reverted_at + interval '30 days' and superseded_at is null
  from public.documents where id = current_setting('t.i3')::uuid), 'the mistaken version is reverted, with who and a 30-day retention date');
select is((select summary from public.document_events where version_id = current_setting('t.i3')::uuid and kind = 'reverted'),
  'Reverted ins-3.pdf. ins-2.pdf restored.', 'the revert is logged with both files');
select lives_ok(format('select public.revert_document_upload(%L)', current_setting('t.i2')), 'reverting again');
select is(pg_temp.cur('insurance', '00000000-0000-0000-0000-000000380101', null)::text, current_setting('t.i1'), 'a second revert steps back one more version');
select throws_ok(format('select public.revert_document_upload(%L)', current_setting('t.i3')),
  '40001', 'This document changed since you opened it. Reload and try again.', 'reverting a version that is no longer current is refused (stale Undo)');

-- B. Restore any History version; Revert is refused right after a Restore.
select set_config('t.o1', pg_temp.up('or_cr', '00000000-0000-0000-0000-000000380101', null, '2030-01-31', 'or-1.pdf')::text, true);
select set_config('t.o2', pg_temp.up('or_cr', '00000000-0000-0000-0000-000000380101', null, '2031-01-31', 'or-2.pdf')::text, true);
select set_config('t.o3', pg_temp.up('or_cr', '00000000-0000-0000-0000-000000380101', null, '2032-01-31', 'or-3.pdf')::text, true);
select throws_ok(format('select public.restore_document_version(%L, %L)', current_setting('t.o1'), current_setting('t.o2')),
  '40001', 'This document changed since you opened it. Reload and try again.', 'a restore against an old current version is refused');
select throws_ok(format('select public.restore_document_version(%L, %L)', current_setting('t.o3'), current_setting('t.o3')),
  'P0002', 'That version is no longer in the history. Reload and try again.', 'only History versions can be restored');
select is(public.restore_document_version(current_setting('t.o1')::uuid, current_setting('t.o3')::uuid)->>'moved_id', current_setting('t.o3'),
  'restoring the oldest version moves the current one to History');
select is(pg_temp.cur('or_cr', '00000000-0000-0000-0000-000000380101', null)::text, current_setting('t.o1'), 'the restored version is current');
select is((select string_agg(file_name, ',' order by superseded_at desc) from public.documents
  where unit_id = '00000000-0000-0000-0000-000000380101' and document_type = 'or_cr' and lifecycle_status = 'superseded'),
  'or-3.pdf,or-2.pdf', 'the former current version is the newest History entry');
select is((select summary from public.document_events where version_id = current_setting('t.o1')::uuid and kind = 'restored'),
  'Restored or-1.pdf. or-3.pdf moved to history.', 'the restore is logged with both files');
select throws_ok(format('select public.revert_document_upload(%L)', current_setting('t.o1')),
  'P0001', 'This version was restored. Use Restore to choose another version.', 'Revert upload is refused after a restore');

-- C. Remove a first upload, bring it back, and swap it in over a newer upload.
select set_config('t.m1', pg_temp.up('mtop_franchise', '00000000-0000-0000-0000-000000380102', null, '2031-06-30', 'mtop-1.pdf')::text, true);
select is(public.revert_document_upload(current_setting('t.m1')::uuid)->>'result', 'removed', 'reverting the only version removes the document');
select is(pg_temp.cur('mtop_franchise', '00000000-0000-0000-0000-000000380102', null), null, 'a removed document has no current version');
select is((select summary from public.document_events where version_id = current_setting('t.m1')::uuid and kind = 'removed'),
  'Reverted mtop-1.pdf. Document removed.', 'the removal is logged');
select is(public.bring_back_document_version(current_setting('t.m1')::uuid, null)->>'result', 'recreated', 'bringing back a removed document recreates it');
select ok((select lifecycle_status = 'current' and reverted_at is null and reverted_by is null and purge_after is null
  from public.documents where id = current_setting('t.m1')::uuid), 'the brought-back version is current with the revert fields cleared');
select lives_ok(format('select public.revert_document_upload(%L)', current_setting('t.m1')), 'removing it again');
select set_config('t.m2', pg_temp.up('mtop_franchise', '00000000-0000-0000-0000-000000380102', null, '2032-06-30', 'mtop-2.pdf')::text, true);
select throws_ok(format('select public.bring_back_document_version(%L, null)', current_setting('t.m1')),
  '40001', 'This document changed since you opened it. Reload and try again.', 'a bring back that missed a newer upload is refused');
select is(public.bring_back_document_version(current_setting('t.m1')::uuid, current_setting('t.m2')::uuid)->>'result', 'swapped',
  'bringing back over a newer upload swaps them');
select is((select lifecycle_status::text from public.documents where id = current_setting('t.m2')::uuid), 'superseded', 'the newer upload moves to History');

-- D. Licenses keep the profile date in step, for active and inactive drivers.
select set_config('t.a1', pg_temp.up('driver_license', null, '00000000-0000-0000-0000-000000380201', '2036-01-31', 'a-1.pdf')::text, true);
select set_config('t.a2', pg_temp.up('driver_license', null, '00000000-0000-0000-0000-000000380201', '2037-01-31', 'a-2.pdf')::text, true);
select lives_ok(format('select public.restore_document_version(%L, %L)', current_setting('t.a1'), current_setting('t.a2')), 'restoring an active driver''s older license');
select is(pg_temp.lic('00000000-0000-0000-0000-000000380201'), '2036-01-31'::date, 'the profile takes the restored license expiry');
select set_config('t.n1', pg_temp.up('driver_license', null, '00000000-0000-0000-0000-000000380202', '2036-03-31', 'n-1.pdf')::text, true);
select set_config('t.n2', pg_temp.up('driver_license', null, '00000000-0000-0000-0000-000000380202', '2037-03-31', 'n-2.pdf')::text, true);
select set_config('t.n_after_renew', pg_temp.lic('00000000-0000-0000-0000-000000380202')::text, true);
select lives_ok(format('select public.revert_document_upload(%L)', current_setting('t.n2')), 'reverting an inactive driver''s renewal');
select is(current_setting('t.n_after_renew') || ' > ' || pg_temp.lic('00000000-0000-0000-0000-000000380202')::text, '2037-03-31 > 2036-03-31',
  'the inactive driver''s profile follows the renewal and then the revert');
select lives_ok(format('select public.bring_back_document_version(%L, %L)', current_setting('t.n2'), current_setting('t.n1')), 'bringing the renewal back');
select is(pg_temp.lic('00000000-0000-0000-0000-000000380202'), '2037-03-31'::date, 'the profile follows the bring back');
select lives_ok(format('select public.revert_document_upload(%L)', current_setting('t.n2')), 'reverting it again');
select lives_ok(format('select public.revert_document_upload(%L)', current_setting('t.n1')), 'removing the only remaining license');
select is(pg_temp.lic('00000000-0000-0000-0000-000000380202'), '2036-03-31'::date, 'removing the only license keeps the profile date');
reset role;
select throws_ok($$update public.drivers set license_expiry_date = '2040-01-31' where id = '00000000-0000-0000-0000-000000380202'$$,
  '23514', 'This driver is Inactive. Set the driver to Active before editing their details', 'a direct date edit on an inactive driver is still refused');

-- E. A file past its retention date can't be brought back, and only the service role marks it deleted.
update public.documents set reverted_at = now() - interval '31 days', purge_after = now() - interval '1 day'
where id = current_setting('t.i3')::uuid;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000380001","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(format('select public.bring_back_document_version(%L, %L)', current_setting('t.i3'), current_setting('t.i1')),
  'P0001', 'This file was deleted after 30 days and can''t be brought back.', 'a file past 30 days can''t be brought back');
reset role;
set local role service_role;
select is(public.mark_document_files_deleted(array[current_setting('t.i3')::uuid, current_setting('t.i2')::uuid, current_setting('t.i1')::uuid]), 1,
  'only the past-due reverted file is marked deleted');
reset role;

select is((select count(*)::int from public.documents
  where unit_id in ('00000000-0000-0000-0000-000000380101', '00000000-0000-0000-0000-000000380102')
     or driver_id in ('00000000-0000-0000-0000-000000380201', '00000000-0000-0000-0000-000000380202')), 12,
  'every version saved is kept (no row is ever deleted)');

select finish();
rollback;
