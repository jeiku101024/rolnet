-- FR-021 / FR-023 / Constitution III: replacing a tire and renewing a document always failed with
-- 23505. Both functions inserted the new current row while the old one was still current, and the
-- partial unique indexes (current_tire_position_unique, documents_current_unit_unique,
-- documents_current_driver_unique) are checked immediately. Both now retire the current row first,
-- inside the same function call (one transaction), and keep the old row as history.

-- Tires: the old row stops being current by pointing replaced_by_id at the new row, so the new id
-- is chosen up front and the self-referencing foreign key is made deferrable (still checked
-- immediately unless a transaction defers it; replace_tire_installation() defers it until commit).
alter table public.tire_installations
  alter constraint tire_installations_replaced_by_id_fkey deferrable initially immediate;

create or replace function public.replace_tire_installation(p_current_id uuid, p_replacement jsonb)
returns public.tire_installations
language plpgsql security invoker set search_path = public as $$
declare current_row public.tire_installations; replacement public.tire_installations; replacement_id uuid := gen_random_uuid();
begin
  select * into current_row from public.tire_installations
  where id = p_current_id and deleted_at is null and replaced_by_id is null
  for update;
  if current_row.id is null then raise exception using errcode = 'P0002', message = 'Current tire was not found'; end if;
  set constraints public.tire_installations_replaced_by_id_fkey deferred;
  update public.tire_installations set replaced_by_id = replacement_id where id = current_row.id;
  insert into public.tire_installations(id, unit_id, position, brand, installed_on, installed_mileage, cost_centavos, next_due_date, next_due_mileage)
  values (
    replacement_id, current_row.unit_id, current_row.position, p_replacement->>'brand',
    (p_replacement->>'installed_on')::date, nullif(p_replacement->>'installed_mileage', '')::integer,
    (p_replacement->>'cost_centavos')::bigint, nullif(p_replacement->>'next_due_date', '')::date,
    nullif(p_replacement->>'next_due_mileage', '')::integer
  )
  returning * into replacement;
  set constraints public.tire_installations_replaced_by_id_fkey immediate;
  return replacement;
end; $$;

-- Documents: mark the previous row superseded, insert the renewal, then link it. For a driver
-- license the driver profile's expiry is updated first, so the renewed document matches the
-- authoritative profile date (validate_license_document_expiry) and both change together.
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
  if previous.document_type = 'driver_license' then
    update public.drivers set license_expiry_date = (p_document->>'expires_on')::date
    where id = previous.driver_id and deleted_at is null;
  end if;
  update public.documents set lifecycle_status = 'superseded' where id = previous.id;
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
