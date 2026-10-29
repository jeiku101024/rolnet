-- FR-023: the driver profile's license_expiry_date is authoritative, and a current driver-license
-- document must carry the same expiry date. This was only checked in finalizeDocumentUpload, so
-- direct REST inserts/updates and /api/v1 could save a mismatched license. The trigger enforces it
-- for every write path. renew_compliance_document() updates the driver profile before inserting the
-- renewed license (see 20261029000700), so renewal keeps both records in step in one transaction.
--
-- Only rows that are, or become, the current non-deleted license are checked, and on update only
-- when a column that affects the rule changes, so archiving or superseding an older document and
-- editing its number still work.

create or replace function public.validate_license_document_expiry()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare profile_expiry date;
begin
  if new.document_type <> 'driver_license' or new.lifecycle_status <> 'current' or new.deleted_at is not null then
    return new;
  end if;
  if tg_op = 'UPDATE'
     and new.expires_on is not distinct from old.expires_on
     and new.driver_id is not distinct from old.driver_id
     and new.document_type is not distinct from old.document_type
     and new.lifecycle_status is not distinct from old.lifecycle_status
     and new.deleted_at is not distinct from old.deleted_at
  then
    return new;
  end if;
  select license_expiry_date into profile_expiry
  from public.drivers
  where id = new.driver_id and deleted_at is null;
  if profile_expiry is null or profile_expiry <> new.expires_on then
    raise exception using errcode = '23514',
      message = 'A driver license document must expire on the same date as the driver profile''s license expiry date';
  end if;
  return new;
end;
$$;

create trigger documents_license_expiry_matches_profile
  before insert or update on public.documents
  for each row execute function public.validate_license_document_expiry();
