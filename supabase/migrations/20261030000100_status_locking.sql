-- Feature 005 (specs/005-status-locking): status toggles with edit locking.
--
-- * A driver cannot be set Inactive while they have a current or upcoming assignment (FR-006).
-- * While a driver is Inactive, their details cannot change (FR-007). The license expiry may still
--   change during a license renewal: renew_compliance_document() supersedes the old license, then
--   updates the profile, then inserts the renewal (the new document must match the profile, see
--   20261029000300), so at that moment the driver has a license document superseded in this
--   transaction with no replacement linked yet. A direct edit has no such document and is refused.
-- * While a unit is In repair or Retired, its details cannot change (FR-008).
--
-- The lock is decided by the row's old state, so status changes, archive/restore, mileage
-- (current_mileage) and the system columns stay allowed (research.md R2-R4). Daily operations are
-- separate tables and are not affected (FR-009).

create or replace function public.reject_driver_deactivation_with_assignments()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if old.is_active and not new.is_active and exists (
    select 1 from public.driver_assignments
    where driver_id = new.id
      and deleted_at is null
      and coalesce(ends_on, 'infinity'::date) >= (now() at time zone 'Asia/Manila')::date
  ) then
    raise exception using errcode = '23503',
      message = 'This driver still has current or upcoming assignments. End or remove them before setting the driver to Inactive';
  end if;
  return new;
end;
$$;

create trigger drivers_reject_deactivation_with_assignments
  before update of is_active on public.drivers
  for each row execute function public.reject_driver_deactivation_with_assignments();

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
     or new.driver_kind is distinct from old.driver_kind
     or new.license_number is distinct from old.license_number
     or new.phone is distinct from old.phone
     or new.address is distinct from old.address
     or (new.license_expiry_date is distinct from old.license_expiry_date and not exists (
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

create trigger drivers_lock_inactive_details
  before update on public.drivers
  for each row execute function public.lock_inactive_driver_details();

create or replace function public.lock_out_of_service_unit_details()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if old.status not in ('in_repair', 'retired') then
    return new;
  end if;
  if new.body_number is distinct from old.body_number
     or new.plate_number is distinct from old.plate_number
     or new.make_model is distinct from old.make_model
  then
    raise exception using errcode = '23514',
      message = format('This unit is %s. Set the unit to Active before editing its details',
        case old.status when 'in_repair' then 'In repair' else 'Retired' end);
  end if;
  return new;
end;
$$;

create trigger units_lock_out_of_service_details
  before update on public.units
  for each row execute function public.lock_out_of_service_unit_details();

-- Trigger functions only; nothing calls them directly.
revoke execute on function public.reject_driver_deactivation_with_assignments() from public, anon, authenticated;
revoke execute on function public.lock_inactive_driver_details() from public, anon, authenticated;
revoke execute on function public.lock_out_of_service_unit_details() from public, anon, authenticated;
