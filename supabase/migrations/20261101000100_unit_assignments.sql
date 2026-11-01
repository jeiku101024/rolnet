-- Feature 010 (specs/010-units-daily-assignment), migration 1 of 3: daily unit assignments.
--
-- One driver on one unit for one date (research R1). Two partial unique indexes make the 1:1-per-day
-- rule a database guarantee, even when two people save at the same moment (FR-013). Rows are only
-- ever soft-deleted (released, R8). An assignment whose unit and date already have a remittance is
-- locked (FR-019a, R7).
--
-- unit_status_on() is created here as a stub that returns the unit's current status, because the
-- validation trigger needs it; migration 2 replaces it with the status-history version (R3).

create table public.unit_assignments (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id),
  driver_id uuid not null references public.drivers(id),
  service_date date not null,
  notes text check (notes is null or length(trim(notes)) <= 500),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id)
);

create unique index unit_assignments_unit_date_unique on public.unit_assignments (unit_id, service_date) where deleted_at is null;
create unique index unit_assignments_driver_date_unique on public.unit_assignments (driver_id, service_date) where deleted_at is null;
create index unit_assignments_date_idx on public.unit_assignments (service_date) where deleted_at is null;

create or replace function public.unit_status_on(p_unit_id uuid, p_date date)
returns public.unit_status
language sql
stable
security definer
set search_path = public
as $$
  select status from public.units where id = p_unit_id
$$;

create or replace function public.validate_unit_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  unit_row public.units;
  driver_row public.drivers;
  status_then public.unit_status;
begin
  -- BEFORE triggers run before RLS. For a signed-in user who isn't approved, do nothing so no rule
  -- message leaks; the RLS policies then reject the row (20261031000200 explains the pattern).
  if auth.uid() is not null and not public.is_approved_user() then
    return new;
  end if;
  if tg_op = 'UPDATE' then
    if exists (
      select 1 from public.remittances
      where unit_id = old.unit_id and service_date = old.service_date and deleted_at is null
    ) then
      raise exception using errcode = '23514',
        message = 'A remittance is already recorded for this day. The assignment can''t be changed.';
    end if;
    if new.unit_id is distinct from old.unit_id or new.service_date is distinct from old.service_date then
      raise exception using errcode = '23514',
        message = 'An assignment''s unit and date can''t change. Release it and save a new one.';
    end if;
  end if;

  if new.deleted_at is not null then
    return new;
  end if;

  select * into unit_row from public.units where id = new.unit_id;
  if unit_row.id is null or unit_row.deleted_at is not null or unit_row.archived then
    raise exception using errcode = '23514', message = 'This unit is archived. Restore it to assign a driver.';
  end if;
  if (unit_row.created_at at time zone 'Asia/Manila')::date > new.service_date then
    raise exception using errcode = '23514', message = 'This unit wasn''t in the fleet on this date.';
  end if;
  status_then := public.unit_status_on(new.unit_id, new.service_date);
  if status_then in ('in_repair', 'retired') then
    raise exception using errcode = '23514',
      message = format('This unit is %s on this date. Set it to Active to assign a driver.',
        case status_then when 'in_repair' then 'In repair' else 'Retired' end);
  end if;

  select * into driver_row from public.drivers where id = new.driver_id;
  if driver_row.id is null or driver_row.deleted_at is not null or not driver_row.is_active
     or driver_row.license_expiry_date < new.service_date then
    raise exception using errcode = '23514',
      message = 'This driver can''t be assigned on this date. Check that they''re active and their licence is valid.';
  end if;
  return new;
end;
$$;

create trigger unit_assignments_validate before insert or update on public.unit_assignments
  for each row execute function public.validate_unit_assignment();
create trigger unit_assignments_audit_fields before insert or update on public.unit_assignments
  for each row execute function public.set_audit_fields();
create trigger unit_assignments_no_hard_delete before delete on public.unit_assignments
  for each row execute function public.reject_hard_delete();
create trigger unit_assignments_business_audit after insert or update on public.unit_assignments
  for each row execute function public.audit_business_change();

alter table public.unit_assignments enable row level security;

-- Owner and staff both assign drivers (FR-056).
create policy unit_assignments_read_policy on public.unit_assignments for select to authenticated
  using (deleted_at is null and public.is_approved_user());
create policy unit_assignments_insert_policy on public.unit_assignments for insert to authenticated
  with check (public.is_approved_user());
create policy unit_assignments_update_policy on public.unit_assignments for update to authenticated
  using (deleted_at is null and public.is_approved_user()) with check (public.is_approved_user());

-- Insert when the card was unsaved; update (overwrite) only when the card showed this row's
-- updated_at (R2). Runs as the caller, so RLS applies.
create or replace function public.save_unit_assignment(
  p_unit_id uuid,
  p_service_date date,
  p_driver_id uuid,
  p_notes text,
  p_expected_updated_at timestamptz default null
)
returns public.unit_assignments
language plpgsql
security invoker
set search_path = public
as $$
declare
  saved public.unit_assignments;
  clean_notes text := nullif(trim(coalesce(p_notes, '')), '');
begin
  if p_driver_id is null then
    raise exception using errcode = '22023', message = 'Choose a driver first';
  end if;
  if p_expected_updated_at is null then
    if exists (
      select 1 from public.unit_assignments
      where unit_id = p_unit_id and service_date = p_service_date and deleted_at is null
    ) then
      raise exception using errcode = 'P0001', message = 'This unit was just assigned by someone else. Reload to see it.';
    end if;
    insert into public.unit_assignments (unit_id, service_date, driver_id, notes)
    values (p_unit_id, p_service_date, p_driver_id, clean_notes)
    returning * into saved;
  else
    update public.unit_assignments
    set driver_id = p_driver_id, notes = clean_notes
    where unit_id = p_unit_id and service_date = p_service_date and deleted_at is null
      and updated_at = p_expected_updated_at
    returning * into saved;
    if saved.id is null then
      raise exception using errcode = 'P0001', message = 'This assignment was changed by someone else. Reload to see it.';
    end if;
  end if;
  return saved;
end;
$$;

-- Pre-fill for future dates (R11): each unit's latest saved assignment before the date.
create or replace function public.latest_unit_assignments_before(p_date date)
returns table(unit_id uuid, driver_id uuid, service_date date)
language sql
stable
security invoker
set search_path = public
as $$
  select distinct on (a.unit_id) a.unit_id, a.driver_id, a.service_date
  from public.unit_assignments a
  where a.deleted_at is null and a.service_date < p_date
  order by a.unit_id, a.service_date desc
$$;

revoke execute on function public.unit_status_on(uuid, date) from public, anon, authenticated;
revoke execute on function public.validate_unit_assignment() from public, anon, authenticated;
revoke execute on function public.save_unit_assignment(uuid, date, uuid, text, timestamptz) from public, anon, authenticated;
revoke execute on function public.latest_unit_assignments_before(date) from public, anon, authenticated;
grant execute on function public.save_unit_assignment(uuid, date, uuid, text, timestamptz) to authenticated;
grant execute on function public.latest_unit_assignments_before(date) to authenticated;

revoke all on public.unit_assignments from anon;
