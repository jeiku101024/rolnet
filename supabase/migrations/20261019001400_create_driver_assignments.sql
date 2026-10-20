create type public.assignment_type as enum ('primary', 'backup');

create table public.driver_assignments (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id),
  driver_id uuid not null references public.drivers(id),
  assignment_type public.assignment_type not null,
  starts_on date not null,
  ends_on date,
  covered_primary_assignment_id uuid references public.driver_assignments(id),
  reason text not null default 'day_off',
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id),
  constraint assignment_dates_check check (ends_on is null or ends_on >= starts_on),
  constraint backup_shape_check check (
    (assignment_type = 'primary' and covered_primary_assignment_id is null and ends_on is null)
    or (assignment_type = 'backup' and covered_primary_assignment_id is not null and ends_on = starts_on)
  )
);

alter table public.driver_assignments
  add constraint primary_unit_date_exclusion exclude using gist (
    unit_id with =,
    daterange(starts_on, coalesce(ends_on, 'infinity'::date), '[]') with &&
  ) where (assignment_type = 'primary' and deleted_at is null);

alter table public.driver_assignments
  add constraint primary_driver_date_exclusion exclude using gist (
    driver_id with =,
    daterange(starts_on, coalesce(ends_on, 'infinity'::date), '[]') with &&
  ) where (assignment_type = 'primary' and deleted_at is null);

create unique index backup_unit_date_unique on public.driver_assignments (unit_id, starts_on)
  where assignment_type = 'backup' and deleted_at is null;
create unique index backup_driver_date_unique on public.driver_assignments (driver_id, starts_on)
  where assignment_type = 'backup' and deleted_at is null;

create or replace function public.validate_driver_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare unit_state public.unit_status; driver_expiry date; driver_active boolean; primary_row public.driver_assignments;
begin
  select status into unit_state from public.units where id = new.unit_id and deleted_at is null;
  select license_expiry_date, is_active into driver_expiry, driver_active from public.drivers where id = new.driver_id and deleted_at is null;
  if unit_state is null or unit_state = 'retired' then
    raise exception using errcode = '23514', message = 'Assignments require a non-retired unit';
  end if;
  if not coalesce(driver_active, false) or driver_expiry < new.starts_on then
    raise exception using errcode = '23514', message = 'Driver license is expired or driver is inactive';
  end if;
  if new.assignment_type = 'backup' then
    select * into primary_row from public.driver_assignments
    where id = new.covered_primary_assignment_id and assignment_type = 'primary' and deleted_at is null;
    if primary_row.id is null or new.starts_on < primary_row.starts_on or (primary_row.ends_on is not null and new.starts_on > primary_row.ends_on) then
      raise exception using errcode = '23514', message = 'Backup coverage must fall inside its primary assignment';
    end if;
    if exists (select 1 from public.driver_assignments where driver_id = new.driver_id and starts_on = new.starts_on and deleted_at is null) then
      raise exception using errcode = '23P01', message = 'Driver already operates another unit on this date';
    end if;
  end if;
  return new;
end;
$$;

create trigger assignments_validate before insert or update on public.driver_assignments
  for each row execute function public.validate_driver_assignment();
create trigger assignments_audit_fields before insert or update on public.driver_assignments
  for each row execute function public.set_audit_fields();
create trigger assignments_no_hard_delete before delete on public.driver_assignments
  for each row execute function public.reject_hard_delete();
