-- Feature 010 (specs/010-units-daily-assignment), migration 3 of 3: remittances follow the daily
-- unit assignment, the old assignment model becomes read-only, and release day is seeded.
--
-- * A new remittance must match that unit's saved assignment for its date (same driver), and the
--   unit must not be archived, blocked, or newer than the date (R6, FR-044, FR-046, FR-011a). The
--   link is stored in unit_assignment_id; existing remittances keep their assignment_id.
--   validate_remittance() runs on insert only (20261029000100), so legacy rows keep accepting
--   payment changes.
-- * Primary assignments, days off, and backup coverage can no longer be created or changed (FR-049).
-- * Release day (FR-053, R13): each available unit gets its current driver as a saved assignment
--   for today's fleet date, so remittances can be recorded straight away. Apply this migration on
--   the morning the app is deployed.

alter table public.remittances
  alter column assignment_id drop not null,
  add column unit_assignment_id uuid references public.unit_assignments(id),
  add constraint remittances_one_assignment_link check (num_nonnulls(assignment_id, unit_assignment_id) = 1);

create index remittances_unit_assignment_idx on public.remittances (unit_assignment_id) where unit_assignment_id is not null;

create or replace function public.validate_remittance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  unit_row public.units;
  daily public.unit_assignments;
  status_then public.unit_status;
begin
  -- BEFORE triggers run before RLS: an unapproved signed-in user gets no rule message; the insert
  -- policy rejects the row (same pattern as 20261031000200).
  if auth.uid() is not null and not public.is_approved_user() then
    return new;
  end if;
  if new.assignment_id is not null then
    raise exception using errcode = '23514', message = 'Driver assignments are now recorded per day on the Units page.';
  end if;
  select * into unit_row from public.units where id = new.unit_id;
  if unit_row.id is null or unit_row.deleted_at is not null or unit_row.archived then
    raise exception using errcode = '23514', message = 'This unit is archived.';
  end if;
  if (unit_row.created_at at time zone 'Asia/Manila')::date > new.service_date then
    raise exception using errcode = '23514', message = 'This unit wasn''t in the fleet on this date.';
  end if;
  status_then := public.unit_status_on(new.unit_id, new.service_date);
  if status_then in ('in_repair', 'retired') then
    raise exception using errcode = '23514',
      message = format('This unit is %s on this date. No remittance for this date.',
        case status_then when 'in_repair' then 'In repair' else 'Retired' end);
  end if;
  select * into daily from public.unit_assignments
  where unit_id = new.unit_id and service_date = new.service_date and deleted_at is null;
  if daily.id is null then
    raise exception using errcode = '23514', message = 'Assign a driver to this unit for this date first.';
  end if;
  if daily.driver_id <> new.driver_id then
    raise exception using errcode = '23514', message = 'This unit is assigned to another driver on this date. Reload the page.';
  end if;
  new.unit_assignment_id := daily.id;
  new.amount_due_centavos := case when new.disposition = 'overnight_overtime' then 30000 else 18000 end;
  return new;
end;
$$;

-- Same as 20261031000100, plus the daily assignment link.
create or replace function public.lock_remittance_financial_facts()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.service_date is distinct from old.service_date
     or new.disposition is distinct from old.disposition
     or new.amount_due_centavos is distinct from old.amount_due_centavos
     or new.allowance_centavos is distinct from old.allowance_centavos
     or new.unit_id is distinct from old.unit_id
     or new.driver_id is distinct from old.driver_id
     or new.assignment_id is distinct from old.assignment_id
     or new.unit_assignment_id is distinct from old.unit_assignment_id
  then
    raise exception using errcode = '23514',
      message = 'A saved remittance''s date, disposition, amount due, allowance, unit, driver and assignment cannot be changed. Reverse it and record a replacement entry.';
  end if;
  return new;
end;
$$;

-- The old assignment model is read-only from now on (FR-049).
drop policy if exists assignments_owner_insert_policy on public.driver_assignments;
drop policy if exists assignments_owner_update_policy on public.driver_assignments;
drop policy if exists driver_days_off_owner_insert_policy on public.driver_days_off;
drop policy if exists driver_days_off_owner_update_policy on public.driver_days_off;

-- Release-day seed (FR-053, R13): the primary covering today; if that primary has a day off today,
-- the backup covering it, or nobody when there is no backup. Only eligible drivers and units that
-- are active today. Runs with triggers on, so every row is validated and audited.
with today as (
  select (now() at time zone 'Asia/Manila')::date as day
),
primaries as (
  select a.* from public.driver_assignments a, today
  where a.assignment_type = 'primary' and a.deleted_at is null
    and a.starts_on <= today.day and (a.ends_on is null or a.ends_on >= today.day)
),
operators as (
  select p.unit_id,
    case when off.id is null then p.driver_id else backup.driver_id end as driver_id
  from primaries p
  cross join today
  left join public.driver_days_off off
    on off.primary_assignment_id = p.id and off.day_off_date = today.day and off.deleted_at is null
  left join public.driver_assignments backup
    on off.id is not null and backup.assignment_type = 'backup' and backup.covered_primary_assignment_id = p.id
    and backup.starts_on = today.day and backup.deleted_at is null
)
insert into public.unit_assignments (unit_id, service_date, driver_id)
select o.unit_id, today.day, o.driver_id
from operators o
cross join today
join public.units u on u.id = o.unit_id
join public.drivers d on d.id = o.driver_id
where o.driver_id is not null
  and u.deleted_at is null and not u.archived
  and (u.created_at at time zone 'Asia/Manila')::date <= today.day
  and public.unit_status_on(u.id, today.day) = 'active'
  and d.deleted_at is null and d.is_active and d.license_expiry_date >= today.day
on conflict do nothing;

revoke execute on function public.validate_remittance() from public, anon, authenticated;
revoke execute on function public.lock_remittance_financial_facts() from public, anon, authenticated;
