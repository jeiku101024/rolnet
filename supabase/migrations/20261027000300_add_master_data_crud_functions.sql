alter table public.documents add column if not exists idempotency_key uuid;
create unique index if not exists documents_idempotency_key_unique on public.documents(idempotency_key) where idempotency_key is not null;

create or replace function public.renew_compliance_document(p_previous_id uuid, p_document jsonb)
returns public.documents
language plpgsql security invoker set search_path = public as $$
declare previous public.documents; replacement public.documents;
begin
  perform public.require_owner();
  select * into previous from public.documents where id=p_previous_id and deleted_at is null and lifecycle_status='current' for update;
  if previous.id is null then raise exception using errcode='P0002', message='Current document was not found'; end if;
  insert into public.documents(document_type,unit_id,driver_id,document_number,issued_on,expires_on,lifecycle_status,object_path,mime_type,size_bytes,sha256,idempotency_key)
  values(previous.document_type,previous.unit_id,previous.driver_id,p_document->>'document_number',nullif(p_document->>'issued_on','')::date,(p_document->>'expires_on')::date,'current',p_document->>'object_path',p_document->>'mime_type',(p_document->>'size_bytes')::integer,p_document->>'sha256',(p_document->>'idempotency_key')::uuid)
  returning * into replacement;
  update public.documents set lifecycle_status='superseded', superseded_by_id=replacement.id where id=previous.id;
  if previous.document_type='driver_license' then update public.drivers set license_expiry_date=replacement.expires_on where id=previous.driver_id; end if;
  return replacement;
end; $$;
