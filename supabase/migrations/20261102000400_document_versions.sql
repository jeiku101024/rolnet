-- Feature 013 (specs/013-documents-page-redesign), migration 2 of 2: document versions, revert,
-- restore, bring back, activity, and the 7-day status rule.
--
-- A document is still every documents row with one type and holder; its current version is the one
-- 'current' row (research R1). Reverted uploads keep their row (R2). A document whose only version was
-- reverted has no current row and counts as removed (R3). superseded_at orders History so the version
-- moved there last is on top (R4).
--
-- Every action is one function and one transaction (R5). Each takes an advisory lock on the document,
-- checks the current version the caller saw, keeps the driver profile's license expiry in step (R6),
-- and writes a document_events row that the details modal shows and the audit log records (R7).
-- The functions are security definer and start with require_owner(), the same rule as the owner-only
-- RLS on documents (FR-046: no role checks beyond page access). Definer rights let them call the
-- private helpers below, which app roles can't execute.
--
-- Reverted files are kept 30 days. The purge route deletes the Storage objects with the service role
-- and stamps file_deleted_at through mark_document_files_deleted (R10). Records are never deleted.

-- 1. Columns, constraints, indexes, backfill ------------------------------------------------------

alter table public.documents
  add column file_name text,
  add column superseded_at timestamptz,
  add column reverted_at timestamptz,
  add column reverted_by uuid references auth.users(id),
  add column purge_after timestamptz,
  add column file_deleted_at timestamptz;

update public.documents d
set superseded_at = coalesce((select s.created_at from public.documents s where s.id = d.superseded_by_id), d.updated_at)
where d.lifecycle_status = 'superseded';

alter table public.documents
  add constraint documents_reverted_fields_check check (
    (lifecycle_status = 'reverted') = (reverted_at is not null)
    and (reverted_at is null or (reverted_by is not null and purge_after is not null and purge_after = reverted_at + interval '30 days'))
    and (reverted_at is not null or (reverted_by is null and purge_after is null))
  ),
  add constraint documents_file_deleted_check check (file_deleted_at is null or lifecycle_status = 'reverted'),
  add constraint documents_file_name_check check (file_name is null or length(btrim(file_name)) between 1 and 200);

create index documents_reverted_recent_idx on public.documents (reverted_at desc) where lifecycle_status = 'reverted';
create index documents_purge_due_idx on public.documents (purge_after) where lifecycle_status = 'reverted' and file_deleted_at is null;
create index documents_history_idx on public.documents (document_type, unit_id, driver_id, superseded_at desc) where deleted_at is null;

-- 2. Activity events ---------------------------------------------------------------------------------

create type public.document_event_kind as enum ('uploaded', 'renewed', 'reverted', 'removed', 'brought_back', 'restored');

create table public.document_events (
  id uuid primary key default gen_random_uuid(),
  document_type public.document_type not null,
  unit_id uuid references public.units(id),
  driver_id uuid references public.drivers(id),
  kind public.document_event_kind not null,
  version_id uuid not null references public.documents(id),
  related_version_id uuid references public.documents(id),
  file_name text,
  related_file_name text,
  summary text not null check (length(btrim(summary)) between 1 and 500),
  occurred_at timestamptz not null default clock_timestamp(),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id),
  constraint document_events_holder_check check ((unit_id is null) <> (driver_id is null)),
  constraint document_events_holder_type_check check ((document_type = 'driver_license') = (driver_id is not null))
);

create index document_events_document_idx on public.document_events (document_type, unit_id, driver_id, occurred_at desc);

create trigger document_events_audit_fields before insert or update on public.document_events
  for each row execute function public.set_audit_fields();
create trigger document_events_no_hard_delete before delete on public.document_events
  for each row execute function public.reject_hard_delete();
create trigger document_events_business_audit after insert or update on public.document_events
  for each row execute function public.audit_business_change();

alter table public.document_events enable row level security;
create policy document_events_owner_select on public.document_events for select to authenticated using (public.is_owner());
-- No insert policy: events are written only by document_log_event (security definer), so app users
-- can't add or change Activity directly.
revoke all on public.document_events from anon;

-- 3. Private helpers -----------------------------------------------------------------------------------
-- Called only from the definer functions in this migration; app roles get no EXECUTE. The ones that
-- write also check the caller with require_owner().

-- Serialises every action on one document (type + holder).
create or replace function public.document_lock(p_type public.document_type, p_unit_id uuid, p_driver_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.require_owner();
  perform pg_advisory_xact_lock(hashtextextended('document:' || p_type::text || ':' || coalesce(p_unit_id, p_driver_id)::text, 0));
end;
$$;

-- The name shown for a version: the uploaded file name, or "[Type] [holder] [date].[ext]" for rows
-- saved before file names were stored (research R9; lib/documents/file-label.ts builds the same text).
-- Called only from document_log_event (definer), so it needs no grant.
create or replace function public.document_shown_name(p_doc public.documents)
returns text
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(
    nullif(btrim(p_doc.file_name), ''),
    (case p_doc.document_type when 'or_cr' then 'OR-CR' when 'mtop_franchise' then 'MTOP franchise' when 'insurance' then 'Insurance' else 'Driver''s license' end)
      || ' ' || coalesce((select u.name from public.units u where u.id = p_doc.unit_id), (select d.full_name from public.drivers d where d.id = p_doc.driver_id), 'Unknown')
      || ' ' || to_char(p_doc.created_at at time zone 'Asia/Manila', 'YYYY-MM-DD')
      || '.' || (case p_doc.mime_type when 'application/pdf' then 'pdf' when 'image/png' then 'png' when 'image/jpeg' then 'jpeg' else 'webp' end)
  );
$$;

-- Sets the driver profile's license expiry to the version becoming current (R6, FR-044a). The
-- transaction-local flag lets lock_inactive_driver_details accept the change for inactive drivers;
-- it is switched off again right after, so later statements in the same transaction stay locked.
create or replace function public.document_set_license_date(p_driver_id uuid, p_expires_on date)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.require_owner();
  perform set_config('rolnet.document_license_sync', 'on', true);
  update public.drivers set license_expiry_date = p_expires_on
  where id = p_driver_id and deleted_at is null and license_expiry_date is distinct from p_expires_on;
  perform set_config('rolnet.document_license_sync', 'off', true);
end;
$$;

-- Writes one Activity event. p_template uses {a} for the version's shown name and {b} for the related
-- version's, for example 'Reverted {a}. {b} restored.'
create or replace function public.document_log_event(
  p_kind public.document_event_kind, p_version public.documents, p_related public.documents, p_template text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare a text; b text;
begin
  perform public.require_owner();
  a := public.document_shown_name(p_version);
  b := case when p_related.id is null then null else public.document_shown_name(p_related) end;
  insert into public.document_events (document_type, unit_id, driver_id, kind, version_id, related_version_id, file_name, related_file_name, summary, occurred_at)
  values (
    p_version.document_type, p_version.unit_id, p_version.driver_id, p_kind, p_version.id, p_related.id, a, b,
    replace(replace(p_template, '{a}', a), '{b}', coalesce(b, '')), clock_timestamp()
  );
end;
$$;

-- 4. First upload or renewal ------------------------------------------------------------------------

create or replace function public.save_compliance_document(p_document jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type public.document_type := nullif(p_document->>'document_type', '')::public.document_type;
  v_unit uuid := nullif(p_document->>'unit_id', '')::uuid;
  v_driver uuid := nullif(p_document->>'driver_id', '')::uuid;
  v_key uuid := nullif(p_document->>'idempotency_key', '')::uuid;
  existing public.documents;
  cur public.documents;
  saved public.documents;
  previous_id uuid;
begin
  perform public.require_owner();
  if v_key is not null then
    select * into existing from public.documents where idempotency_key = v_key;
    if existing.id is not null then
      select related_version_id into previous_id from public.document_events
      where version_id = existing.id and kind in ('uploaded', 'renewed') order by occurred_at limit 1;
      return jsonb_build_object('version_id', existing.id, 'renewed', previous_id is not null, 'previous_id', previous_id);
    end if;
  end if;
  if v_type is null or (v_unit is null) = (v_driver is null) then
    raise exception using errcode = 'P0001', message = 'Choose a document type and who it belongs to.';
  end if;
  if v_unit is not null and not exists (select 1 from public.units where id = v_unit and deleted_at is null and not archived) then
    raise exception using errcode = 'P0001', message = 'This unit is archived. Choose another unit.';
  end if;
  if v_driver is not null and not exists (select 1 from public.drivers where id = v_driver and deleted_at is null) then
    raise exception using errcode = 'P0002', message = 'This driver was not found. Reload and try again.';
  end if;

  perform public.document_lock(v_type, v_unit, v_driver);
  select * into cur from public.documents
  where document_type = v_type and unit_id is not distinct from v_unit and driver_id is not distinct from v_driver
    and lifecycle_status = 'current' and deleted_at is null
  for update;
  if p_document ? 'expected_current_id' and nullif(p_document->>'expected_current_id', '')::uuid is distinct from cur.id then
    raise exception using errcode = '40001', message = 'This document changed since you opened it. Reload and try again.';
  end if;

  if cur.id is not null then
    update public.documents set lifecycle_status = 'superseded', superseded_at = clock_timestamp() where id = cur.id;
  end if;
  if v_type = 'driver_license' then
    perform public.document_set_license_date(v_driver, (p_document->>'expires_on')::date);
  end if;
  insert into public.documents (document_type, unit_id, driver_id, document_number, issued_on, expires_on, lifecycle_status,
    object_path, mime_type, size_bytes, sha256, idempotency_key, file_name)
  values (
    v_type, v_unit, v_driver, nullif(btrim(p_document->>'document_number'), ''), nullif(p_document->>'issued_on', '')::date,
    (p_document->>'expires_on')::date, 'current', p_document->>'object_path', p_document->>'mime_type',
    (p_document->>'size_bytes')::integer, p_document->>'sha256', v_key, nullif(btrim(p_document->>'file_name'), '')
  )
  returning * into saved;

  if cur.id is not null then
    update public.documents set superseded_by_id = saved.id where id = cur.id returning * into cur;
    perform public.document_log_event('renewed', saved, cur, 'Renewed with {a}. {b} moved to history.');
  else
    perform public.document_log_event('uploaded', saved, null, 'Uploaded {a}.');
  end if;
  return jsonb_build_object('version_id', saved.id, 'renewed', cur.id is not null, 'previous_id', cur.id);
end;
$$;

-- Kept for existing callers (feature 001): renews the given current document through the same path.
create or replace function public.renew_compliance_document(p_previous_id uuid, p_document jsonb)
returns public.documents
language plpgsql
security definer
set search_path = public
as $$
declare previous public.documents; result jsonb; replacement public.documents;
begin
  perform public.require_owner();
  select * into previous from public.documents
  where id = p_previous_id and deleted_at is null and lifecycle_status = 'current';
  if previous.id is null then
    raise exception using errcode = 'P0002', message = 'Current document was not found';
  end if;
  result := public.save_compliance_document(p_document || jsonb_build_object(
    'document_type', previous.document_type, 'unit_id', previous.unit_id, 'driver_id', previous.driver_id,
    'expected_current_id', previous.id));
  select * into replacement from public.documents where id = (result->>'version_id')::uuid;
  return replacement;
end;
$$;

-- 5. Revert (modal and toast Undo) --------------------------------------------------------------------

create or replace function public.revert_document_upload(p_current_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  cur public.documents;
  prev public.documents;
  last_kind public.document_event_kind;
begin
  perform public.require_owner();
  select * into cur from public.documents where id = p_current_id;
  if cur.id is null then
    raise exception using errcode = 'P0002', message = 'This document was not found. Reload and try again.';
  end if;
  perform public.document_lock(cur.document_type, cur.unit_id, cur.driver_id);
  select * into cur from public.documents where id = p_current_id for update;
  if cur.lifecycle_status <> 'current' or cur.deleted_at is not null then
    raise exception using errcode = '40001', message = 'This document changed since you opened it. Reload and try again.';
  end if;
  select kind into last_kind from public.document_events
  where document_type = cur.document_type and unit_id is not distinct from cur.unit_id and driver_id is not distinct from cur.driver_id
  order by occurred_at desc limit 1;
  if last_kind = 'restored' then
    raise exception using errcode = 'P0001', message = 'This version was restored. Use Restore to choose another version.';
  end if;

  update public.documents
  set lifecycle_status = 'reverted', reverted_at = now(), reverted_by = auth.uid(), purge_after = now() + interval '30 days'
  where id = cur.id
  returning * into cur;

  select * into prev from public.documents
  where document_type = cur.document_type and unit_id is not distinct from cur.unit_id and driver_id is not distinct from cur.driver_id
    and lifecycle_status = 'superseded' and deleted_at is null
  order by superseded_at desc nulls last, created_at desc
  limit 1
  for update;

  if prev.id is null then
    perform public.document_log_event('removed', cur, null, 'Reverted {a}. Document removed.');
    return jsonb_build_object('result', 'removed', 'version_id', cur.id, 'restored_id', null);
  end if;
  if cur.document_type = 'driver_license' then
    perform public.document_set_license_date(cur.driver_id, prev.expires_on);
  end if;
  update public.documents set lifecycle_status = 'current', superseded_at = null, superseded_by_id = null where id = prev.id
  returning * into prev;
  perform public.document_log_event('reverted', cur, prev, 'Reverted {a}. {b} restored.');
  return jsonb_build_object('result', 'previous', 'version_id', cur.id, 'restored_id', prev.id);
end;
$$;

-- 6. Restore a History version ------------------------------------------------------------------------

create or replace function public.restore_document_version(p_version_id uuid, p_current_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.documents;
  cur public.documents;
begin
  perform public.require_owner();
  select * into target from public.documents where id = p_version_id;
  if target.id is null then
    raise exception using errcode = 'P0002', message = 'That version is no longer in the history. Reload and try again.';
  end if;
  perform public.document_lock(target.document_type, target.unit_id, target.driver_id);
  select * into target from public.documents where id = p_version_id for update;
  if target.lifecycle_status <> 'superseded' or target.deleted_at is not null then
    raise exception using errcode = 'P0002', message = 'That version is no longer in the history. Reload and try again.';
  end if;
  select * into cur from public.documents
  where document_type = target.document_type and unit_id is not distinct from target.unit_id and driver_id is not distinct from target.driver_id
    and lifecycle_status = 'current' and deleted_at is null
  for update;
  if cur.id is distinct from p_current_id then
    raise exception using errcode = '40001', message = 'This document changed since you opened it. Reload and try again.';
  end if;

  if cur.id is not null then
    update public.documents set lifecycle_status = 'superseded', superseded_at = clock_timestamp(), superseded_by_id = target.id where id = cur.id
    returning * into cur;
  end if;
  if target.document_type = 'driver_license' then
    perform public.document_set_license_date(target.driver_id, target.expires_on);
  end if;
  update public.documents set lifecycle_status = 'current', superseded_at = null, superseded_by_id = null where id = target.id
  returning * into target;
  perform public.document_log_event('restored', target, cur,
    case when cur.id is null then 'Restored {a}.' else 'Restored {a}. {b} moved to history.' end);
  return jsonb_build_object('version_id', target.id, 'moved_id', cur.id);
end;
$$;

-- 7. Bring back a reverted file ------------------------------------------------------------------------

create or replace function public.bring_back_document_version(p_version_id uuid, p_current_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.documents;
  cur public.documents;
begin
  perform public.require_owner();
  select * into target from public.documents where id = p_version_id;
  if target.id is null then
    raise exception using errcode = 'P0002', message = 'This file is no longer in Reverted uploads. Reload and try again.';
  end if;
  perform public.document_lock(target.document_type, target.unit_id, target.driver_id);
  select * into target from public.documents where id = p_version_id for update;
  if target.lifecycle_status <> 'reverted' or target.deleted_at is not null then
    raise exception using errcode = 'P0002', message = 'This file is no longer in Reverted uploads. Reload and try again.';
  end if;
  if target.file_deleted_at is not null or target.purge_after <= now() then
    raise exception using errcode = 'P0001', message = 'This file was deleted after 30 days and can''t be brought back.';
  end if;
  if target.unit_id is not null and not exists (select 1 from public.units where id = target.unit_id and deleted_at is null and not archived) then
    raise exception using errcode = 'P0001', message = 'This unit is archived. Restore the unit before bringing back its documents.';
  end if;
  if target.driver_id is not null and not exists (select 1 from public.drivers where id = target.driver_id and deleted_at is null) then
    raise exception using errcode = 'P0001', message = 'This driver was deleted, so the license can''t be brought back.';
  end if;
  select * into cur from public.documents
  where document_type = target.document_type and unit_id is not distinct from target.unit_id and driver_id is not distinct from target.driver_id
    and lifecycle_status = 'current' and deleted_at is null
  for update;
  if cur.id is distinct from p_current_id then
    raise exception using errcode = '40001', message = 'This document changed since you opened it. Reload and try again.';
  end if;

  if cur.id is not null then
    update public.documents set lifecycle_status = 'superseded', superseded_at = clock_timestamp(), superseded_by_id = target.id where id = cur.id
    returning * into cur;
  end if;
  if target.document_type = 'driver_license' then
    perform public.document_set_license_date(target.driver_id, target.expires_on);
  end if;
  update public.documents
  set lifecycle_status = 'current', reverted_at = null, reverted_by = null, purge_after = null, superseded_at = null, superseded_by_id = null
  where id = target.id
  returning * into target;
  perform public.document_log_event('brought_back', target, cur,
    case when cur.id is null then 'Brought back {a}.' else 'Brought back {a}. {b} moved to history.' end);
  return jsonb_build_object('result', case when cur.id is null then 'recreated' else 'swapped' end, 'version_id', target.id, 'moved_id', cur.id);
end;
$$;

-- 8. Retention bookkeeping (service role only) ----------------------------------------------------

-- Security invoker: only service_role may execute it, and service_role bypasses RLS, so no definer
-- rights or caller check are needed (CLAUDE.md). It only touches past-due reverted rows.
create or replace function public.mark_document_files_deleted(p_ids uuid[])
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare marked integer;
begin
  update public.documents set file_deleted_at = now()
  where id = any(p_ids) and lifecycle_status = 'reverted' and purge_after <= now() and file_deleted_at is null;
  get diagnostics marked = row_count;
  return marked;
end;
$$;

-- 9. Inactive drivers: accept license-date changes made by the document functions (R6) ---------------

create or replace function public.lock_inactive_driver_details()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if old.is_active then
    return new;
  end if;
  if new.full_name is distinct from old.full_name
     or new.license_number is distinct from old.license_number
     or new.phone is distinct from old.phone
     or new.address is distinct from old.address
     or new.notes is distinct from old.notes
     or (new.license_expiry_date is distinct from old.license_expiry_date
       and coalesce(current_setting('rolnet.document_license_sync', true), '') <> 'on'
       and not exists (
         select 1 from public.documents
         where driver_id = new.id
           and document_type = 'driver_license'
           and lifecycle_status = 'superseded'
           and superseded_by_id is null
           and deleted_at is null
           and updated_at = now()
       ))
  then
    raise exception using errcode = '23514',
      message = 'This driver is Inactive. Set the driver to Active before editing their details';
  end if;
  return new;
end;
$$;

-- 10. The 7-day status rule everywhere (FR-011a, R11) ----------------------------------------------

create or replace function public.expiring_documents(as_of date default (now() at time zone 'Asia/Manila')::date)
returns table(id uuid, document_type public.document_type, unit_id uuid, driver_id uuid, expires_on date, bucket text)
language sql stable security definer set search_path = public as $$
  select id, document_type, unit_id, driver_id, expires_on,
    case when expires_on < as_of then 'expired' else 'due_7' end
  from public.documents
  where lifecycle_status = 'current' and deleted_at is null and expires_on <= as_of + 7 and public.is_owner()
  order by expires_on
$$;

-- 11. Grants -------------------------------------------------------------------------------------------

revoke execute on function public.document_lock(public.document_type, uuid, uuid) from public, anon, authenticated;
revoke execute on function public.document_shown_name(public.documents) from public, anon, authenticated;
revoke execute on function public.document_set_license_date(uuid, date) from public, anon, authenticated;
revoke execute on function public.document_log_event(public.document_event_kind, public.documents, public.documents, text) from public, anon, authenticated;
revoke execute on function public.save_compliance_document(jsonb) from public, anon, authenticated;
revoke execute on function public.revert_document_upload(uuid) from public, anon, authenticated;
revoke execute on function public.restore_document_version(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.bring_back_document_version(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.mark_document_files_deleted(uuid[]) from public, anon, authenticated;
revoke execute on function public.lock_inactive_driver_details() from public, anon, authenticated;

grant execute on function public.save_compliance_document(jsonb) to authenticated;
grant execute on function public.revert_document_upload(uuid) to authenticated;
grant execute on function public.restore_document_version(uuid, uuid) to authenticated;
grant execute on function public.bring_back_document_version(uuid, uuid) to authenticated;
grant execute on function public.mark_document_files_deleted(uuid[]) to service_role;
grant execute on function public.renew_compliance_document(uuid, jsonb) to authenticated;
grant execute on function public.expiring_documents(date) to authenticated;
