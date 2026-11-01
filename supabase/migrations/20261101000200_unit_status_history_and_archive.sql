-- Feature 010 (specs/010-units-daily-assignment), migration 2 of 3: unit status history, archive,
-- and releasing assignments.
--
-- * unit_status_changes records every status change (R3). Staff need "status on a date" for the
--   blocked cards, and the audit trail is owner-only, so the history gets its own readable table.
--   It is written only by the trigger on units, and backfilled from the audit trail. Units that are
--   In repair or Retired without a matching entry are treated as changed today (FR-025), so no past
--   date becomes blocked.
-- * units.archived replaces deleting a unit (R12). soft_delete_record() now refuses units.
-- * Setting a unit In repair or Retired, archiving it, or deactivating or archiving a driver releases
--   the matching assignments dated today or later that have no remittance (FR-029, FR-029b, R8).
--   Feature 005's rule that refused to deactivate a driver with assignments is replaced by this.

-- Status history ---------------------------------------------------------------------------------

create table public.unit_status_changes (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id),
  from_status public.unit_status,
  to_status public.unit_status not null,
  changed_at timestamptz not null default now(),
  effective_on date not null,
  changed_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id)
);

create index unit_status_changes_unit_idx on public.unit_status_changes (unit_id, effective_on desc, changed_at desc)
  where deleted_at is null;

create trigger unit_status_changes_audit_fields before insert or update on public.unit_status_changes
  for each row execute function public.set_audit_fields();
create trigger unit_status_changes_no_hard_delete before delete on public.unit_status_changes
  for each row execute function public.reject_hard_delete();

alter table public.unit_status_changes enable row level security;
create policy unit_status_changes_read_policy on public.unit_status_changes for select to authenticated
  using (deleted_at is null and public.is_approved_user());
-- No insert or update policy: only record_unit_status_change() writes rows.

-- Backfill 1: creation and change rows from the audit trail, with their original time and actor.
insert into public.unit_status_changes (unit_id, from_status, to_status, changed_at, effective_on, changed_by, created_by)
select
  e.entity_id,
  case when e.action = 'insert' then null else (e.changed_fields->'before'->>'status')::public.unit_status end,
  (e.changed_fields->'after'->>'status')::public.unit_status,
  e.occurred_at,
  (e.occurred_at at time zone 'Asia/Manila')::date,
  e.actor_user_id,
  e.actor_user_id
from public.audit_events e
join public.units u on u.id = e.entity_id
where e.entity_type = 'units'
  and e.changed_fields->'after'->>'status' is not null
  and (
    e.action = 'insert'
    or (e.changed_fields->'before'->>'status') is distinct from (e.changed_fields->'after'->>'status')
  );

-- Backfill 2 (FR-025): an out-of-service unit whose latest entry doesn't end in its current status
-- (or that has none) is treated as changed on the release date, so earlier dates stay unblocked.
insert into public.unit_status_changes (unit_id, from_status, to_status, changed_at, effective_on)
select u.id, 'active', u.status, now(), (now() at time zone 'Asia/Manila')::date
from public.units u
where u.deleted_at is null
  and u.status <> 'active'
  and u.status is distinct from (
    select c.to_status from public.unit_status_changes c
    where c.unit_id = u.id
    order by c.changed_at desc
    limit 1
  );

create or replace function public.record_unit_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return null;
  end if;
  insert into public.unit_status_changes (unit_id, from_status, to_status, changed_at, effective_on, changed_by)
  values (
    new.id,
    case when tg_op = 'UPDATE' then old.status end,
    new.status,
    now(),
    (now() at time zone 'Asia/Manila')::date,
    auth.uid()
  );
  return null;
end;
$$;

create trigger units_record_status_change after insert or update of status on public.units
  for each row execute function public.record_unit_status_change();

-- Status in effect on a date (FR-024): the latest change on or before it; before the first change,
-- that change's previous status; with no history, Active. Mirrors statusOn() in lib/units/status-on.ts.
create or replace function public.unit_status_on(p_unit_id uuid, p_date date)
returns public.unit_status
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select c.to_status from public.unit_status_changes c
      where c.unit_id = p_unit_id and c.deleted_at is null and c.effective_on <= p_date
      order by c.effective_on desc, c.changed_at desc
      limit 1),
    (select c.from_status from public.unit_status_changes c
      where c.unit_id = p_unit_id and c.deleted_at is null
      order by c.effective_on, c.changed_at
      limit 1),
    'active'::public.unit_status
  )
$$;

-- Archive ----------------------------------------------------------------------------------------

alter table public.units
  add column archived boolean not null default false,
  add column archived_at timestamptz,
  add column archived_by uuid references auth.users(id),
  add constraint units_archived_fields_check check (archived = (archived_at is not null));

create index units_archived_idx on public.units (archived) where deleted_at is null;

create or replace function public.set_unit_archive_fields()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.archived and not old.archived then
    new.archived_at := now();
    new.archived_by := auth.uid();
  elsif not new.archived then
    new.archived_at := null;
    new.archived_by := null;
  else
    new.archived_at := old.archived_at;
    new.archived_by := old.archived_by;
  end if;
  return new;
end;
$$;

create trigger units_set_archive_fields before update of archived, archived_at, archived_by on public.units
  for each row execute function public.set_unit_archive_fields();

-- Releasing assignments ----------------------------------------------------------------------------

-- Soft-deletes active assignments dated today (fleet date) or later for a unit or a driver, except
-- days that already have a remittance (FR-019a). Returns how many were released.
create or replace function public.release_unit_assignments(p_unit_id uuid default null, p_driver_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare released integer;
begin
  if not public.is_owner() then
    raise exception using errcode = '42501', message = 'Only the owner can release assignments';
  end if;
  update public.unit_assignments a
  set deleted_at = now(), deleted_by = auth.uid()
  where a.deleted_at is null
    and a.service_date >= (now() at time zone 'Asia/Manila')::date
    and ((p_unit_id is not null and a.unit_id = p_unit_id) or (p_driver_id is not null and a.driver_id = p_driver_id))
    and not exists (
      select 1 from public.remittances r
      where r.unit_id = a.unit_id and r.service_date = a.service_date and r.deleted_at is null
    );
  get diagnostics released = row_count;
  return released;
end;
$$;

-- AFTER triggers: RLS has already let the caller change the row. They act only for the owner (the
-- only role RLS lets update units and drivers), so a migration or unapproved session does nothing.
create or replace function public.release_on_unit_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_owner() then
    return null;
  end if;
  if (new.status in ('in_repair', 'retired') and new.status is distinct from old.status)
     or (new.archived and not old.archived) then
    perform public.release_unit_assignments(p_unit_id => new.id);
  end if;
  return null;
end;
$$;

create trigger units_release_assignments after update of status, archived on public.units
  for each row execute function public.release_on_unit_change();

create or replace function public.release_on_driver_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_owner() then
    return null;
  end if;
  if (old.is_active and not new.is_active) or (old.deleted_at is null and new.deleted_at is not null) then
    perform public.release_unit_assignments(p_driver_id => new.id);
  end if;
  return null;
end;
$$;

create trigger drivers_release_assignments after update of is_active, deleted_at on public.drivers
  for each row execute function public.release_on_driver_change();

-- Feature 005 refused to deactivate a driver with current or upcoming assignments. Daily assignments
-- are released instead (FR-029b), and legacy open-ended primaries would block every deactivation.
drop trigger if exists drivers_reject_deactivation_with_assignments on public.drivers;
drop function if exists public.reject_driver_deactivation_with_assignments();

-- Units are archived, never deleted (FR-008, FR-032). The rest of the function is unchanged from
-- 20261029001400; create or replace keeps the EXECUTE grant.
create or replace function public.soft_delete_record(p_table text, p_id uuid, p_expected_updated_at timestamptz default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare result jsonb;
begin
  perform public.require_owner();
  if not public.soft_deletable_table(p_table) then
    raise exception using errcode = '22023', message = 'This kind of record cannot be deleted here';
  end if;
  if p_table = 'expense_categories'
     and exists (select 1 from public.expense_categories where id = p_id and is_system) then
    raise exception using errcode = '23514', message = 'Built-in expense categories cannot be deleted';
  end if;
  if p_table = 'units' then
    raise exception using errcode = '22023', message = 'Units are archived, not deleted. Use Archive.';
  end if;
  execute format(
    'update public.%I set deleted_at = now(), deleted_by = auth.uid()
     where id = $1 and deleted_at is null and ($2::timestamptz is null or updated_at = $2)
     returning to_jsonb(%I.*)',
    p_table, p_table
  ) into result using p_id, p_expected_updated_at;
  return result;
end;
$$;

revoke execute on function public.record_unit_status_change() from public, anon, authenticated;
revoke execute on function public.unit_status_on(uuid, date) from public, anon, authenticated;
revoke execute on function public.set_unit_archive_fields() from public, anon, authenticated;
revoke execute on function public.release_unit_assignments(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.release_on_unit_change() from public, anon, authenticated;
revoke execute on function public.release_on_driver_change() from public, anon, authenticated;
