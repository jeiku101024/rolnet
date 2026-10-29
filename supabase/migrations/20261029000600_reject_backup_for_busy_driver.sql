-- FR-012: a driver cannot operate more than one unit on a calendar date. The backup check only
-- looked for assignments starting on the same date, so a driver whose primary assignment on one
-- unit covers the date could still be booked as backup on another unit. It also matched the row
-- itself, so a saved backup could not be edited.
--
-- Now:
-- * a backup is rejected when any other active assignment of that driver (primary range or another
--   backup) covers its date;
-- * a primary assignment is rejected when its range covers a date on which the driver is already
--   booked as backup elsewhere;
-- * eligibility (non-retired unit, valid license, active driver) is checked for new assignments and
--   when the unit, driver, type, start date or covered assignment changes or a row is restored, but
--   not when an existing assignment is only ended, annotated or soft-deleted. Otherwise an owner
--   could not end the primary assignment of a driver whose license has since expired (FR-011).

create or replace function public.validate_driver_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  unit_state public.unit_status;
  driver_expiry date;
  driver_active boolean;
  primary_row public.driver_assignments;
  identity_changed boolean;
begin
  if new.deleted_at is not null then
    return new;
  end if;

  identity_changed := tg_op = 'INSERT'
    or old.deleted_at is not null
    or new.unit_id is distinct from old.unit_id
    or new.driver_id is distinct from old.driver_id
    or new.assignment_type is distinct from old.assignment_type
    or new.starts_on is distinct from old.starts_on
    or new.covered_primary_assignment_id is distinct from old.covered_primary_assignment_id;

  if identity_changed then
    select status into unit_state from public.units where id = new.unit_id and deleted_at is null;
    select license_expiry_date, is_active into driver_expiry, driver_active
    from public.drivers where id = new.driver_id and deleted_at is null;
    if unit_state is null or unit_state = 'retired' then
      raise exception using errcode = '23514', message = 'Assignments require a non-retired unit';
    end if;
    if not coalesce(driver_active, false) or driver_expiry < new.starts_on then
      raise exception using errcode = '23514', message = 'Driver license is expired or driver is inactive';
    end if;
  end if;

  if new.assignment_type = 'backup' then
    if identity_changed then
      select * into primary_row from public.driver_assignments
      where id = new.covered_primary_assignment_id and assignment_type = 'primary' and deleted_at is null;
      if primary_row.id is null or new.starts_on < primary_row.starts_on
         or (primary_row.ends_on is not null and new.starts_on > primary_row.ends_on) then
        raise exception using errcode = '23514', message = 'Backup coverage must fall inside its primary assignment';
      end if;
    end if;
    if exists (
      select 1 from public.driver_assignments a
      where a.driver_id = new.driver_id
        and a.id <> new.id
        and a.deleted_at is null
        and new.starts_on between a.starts_on and coalesce(a.ends_on, 'infinity'::date)
    ) then
      raise exception using errcode = '23P01', message = 'Driver already operates another unit on this date';
    end if;
  elsif identity_changed or new.ends_on is distinct from old.ends_on then
    if exists (
      select 1 from public.driver_assignments a
      where a.driver_id = new.driver_id
        and a.id <> new.id
        and a.assignment_type = 'backup'
        and a.deleted_at is null
        and a.starts_on between new.starts_on and coalesce(new.ends_on, 'infinity'::date)
    ) then
      raise exception using errcode = '23P01', message = 'Driver is already booked as backup on another unit during this period';
    end if;
  end if;

  return new;
end;
$$;
