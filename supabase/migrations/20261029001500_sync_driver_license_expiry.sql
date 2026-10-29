-- FR-023 / data-model.md drivers.license_expiry_date: the profile expiry "must match the current
-- uploaded driver-license document". 20261029000300 checks this when a license document is written,
-- but the driver profile could still be edited to a different date, leaving the current license out
-- of step. Changing license_expiry_date is now rejected while the driver has a current, non-deleted
-- license document with another expiry; the owner renews the license instead, which changes both.
--
-- renew_compliance_document() (20261029000700) updated the profile before superseding the old
-- license, which this rule would reject. It now supersedes the old document first, then updates the
-- profile, then inserts the renewal, all in the same transaction. Its body is otherwise unchanged.

create or replace function public.validate_driver_license_expiry_change()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.license_expiry_date is not distinct from old.license_expiry_date or new.deleted_at is not null then
    return new;
  end if;
  if exists (
    select 1 from public.documents
    where driver_id = new.id
      and document_type = 'driver_license'
      and lifecycle_status = 'current'
      and deleted_at is null
      and expires_on <> new.license_expiry_date
  ) then
    raise exception using errcode = '23514',
      message = 'The license expiry date must match the driver''s current license document. Renew the license to change it';
  end if;
  return new;
end;
$$;

create trigger drivers_license_expiry_matches_document
  before update of license_expiry_date on public.drivers
  for each row execute function public.validate_driver_license_expiry_change();

create or replace function public.renew_compliance_document(p_previous_id uuid, p_document jsonb)
returns public.documents
language plpgsql security invoker set search_path = public as $$
declare previous public.documents; replacement public.documents;
begin
  perform public.require_owner();
  select * into previous from public.documents
  where id = p_previous_id and deleted_at is null and lifecycle_status = 'current'
  for update;
  if previous.id is null then raise exception using errcode = 'P0002', message = 'Current document was not found'; end if;
  update public.documents set lifecycle_status = 'superseded' where id = previous.id;
  if previous.document_type = 'driver_license' then
    update public.drivers set license_expiry_date = (p_document->>'expires_on')::date
    where id = previous.driver_id and deleted_at is null;
  end if;
  insert into public.documents(document_type, unit_id, driver_id, document_number, issued_on, expires_on, lifecycle_status, object_path, mime_type, size_bytes, sha256, idempotency_key)
  values (
    previous.document_type, previous.unit_id, previous.driver_id, p_document->>'document_number',
    nullif(p_document->>'issued_on', '')::date, (p_document->>'expires_on')::date, 'current',
    p_document->>'object_path', p_document->>'mime_type', (p_document->>'size_bytes')::integer,
    p_document->>'sha256', (p_document->>'idempotency_key')::uuid
  )
  returning * into replacement;
  update public.documents set superseded_by_id = replacement.id where id = previous.id;
  return replacement;
end; $$;
