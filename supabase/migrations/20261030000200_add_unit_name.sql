-- Feature 007 (specs/007-unit-name-columns): each unit gets a fleet name ("ROLNET-1") alongside its
-- body number ("0633"). Existing units, deleted ones included, start with their body number as the
-- name. Names are 1–40 characters and unique among non-deleted units, ignoring case and surrounding
-- spaces. An insert or update that leaves the name null or blank gets the body number (research R2),
-- so callers that predate the name keep working. The name is a unit detail, so it is locked with
-- the others while a unit is In repair or Retired (feature 005).

alter table public.units add column name text;

-- Runs before the lock below covers the name, so out-of-service units are backfilled too. The
-- audit trigger records the change like any other update.
update public.units set name = trim(body_number);

alter table public.units alter column name set not null;
alter table public.units add constraint units_name_length check (length(trim(name)) between 1 and 40);
create unique index units_name_unique on public.units (lower(trim(name))) where deleted_at is null;

create or replace function public.units_default_name()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.name is null or length(trim(new.name)) = 0 then
    new.name := trim(new.body_number);
  end if;
  return new;
end;
$$;

-- Before-triggers fire in name order: units_audit_fields, units_default_name, then
-- units_lock_out_of_service_details, so the lock sees the defaulted name.
create trigger units_default_name
  before insert or update on public.units
  for each row execute function public.units_default_name();

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
  if new.name is distinct from old.name
     or new.body_number is distinct from old.body_number
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

-- Trigger functions only; nothing calls them directly. create or replace keeps the earlier revoke
-- on lock_out_of_service_unit_details; repeat it so this file stands on its own.
revoke execute on function public.units_default_name() from public, anon, authenticated;
revoke execute on function public.lock_out_of_service_unit_details() from public, anon, authenticated;
