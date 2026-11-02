-- Feature 012 (specs/012-drivers-absences-roles), migration 1 of 2: dated driver absences.
--
-- A Day-off covers one date; an On-leave covers a date range or is open-ended (research R1–R3).
-- Status today (Active, Day-off, On-leave, Inactive) is derived from these rows and drivers.is_active;
-- nothing is stored on the driver and nothing runs on a schedule. An exclusion constraint guarantees
-- that one driver's absences never cover the same date (R2). The feature-010 assignment trigger now
-- refuses a driver who is absent on the date (R4).
--
-- Saving an absence that newly covers today-or-later saved assignments releases them in the same
-- transaction, after the caller confirms the exact list (R5). Cancel, end early, and "Still on leave"
-- mark rows; nothing is hard-deleted (R6). Stale-leave thresholds are fleet settings (R13).

create type public.driver_absence_type as enum ('day_off', 'on_leave');
create type public.driver_absence_reason as enum ('sick', 'vacation', 'family_emergency', 'personal', 'other');

alter table public.drivers
  add column notes text check (notes is null or length(trim(notes)) <= 1000);

alter table public.fleet_settings
  add column stale_leave_amber_days smallint not null default 14 check (stale_leave_amber_days > 0),
  add column stale_leave_red_days smallint not null default 30,
  add column stale_leave_snooze_days smallint not null default 7 check (stale_leave_snooze_days > 0),
  add constraint fleet_settings_stale_leave_order check (stale_leave_red_days > stale_leave_amber_days);

create table public.driver_absences (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.drivers(id),
  absence_type public.driver_absence_type not null,
  start_date date not null,
  end_date date,
  reason public.driver_absence_reason not null,
  note text check (note is null or length(trim(note)) <= 500),
  cancelled_at timestamptz,
  cancelled_by uuid references auth.users(id),
  ended_early_on date,
  ended_early_at timestamptz,
  ended_early_by uuid references auth.users(id),
  snoozed_until date,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id),
  constraint driver_absences_date_order check (end_date is null or end_date >= start_date),
  constraint driver_absences_day_off_one_date check (absence_type = 'on_leave' or end_date = start_date),
  constraint driver_absences_ended_early_order check (ended_early_on is null or ended_early_on >= start_date),
  constraint driver_absences_cancel_or_end check (cancelled_at is null or ended_early_on is null),
  -- Effective coverage is [start_date, least(end_date + 1, ended_early_on)); least() ignores nulls, so
  -- an open-ended leave that hasn't been ended early is unbounded (R2).
  constraint driver_absences_no_overlap exclude using gist (
    driver_id with =,
    daterange(start_date, least(end_date + 1, ended_early_on), '[)') with &&
  ) where (cancelled_at is null and deleted_at is null)
);

create index driver_absences_driver_dates_idx on public.driver_absences (driver_id, start_date, end_date) where deleted_at is null;

create table public.driver_absence_confirmations (
  id uuid primary key default gen_random_uuid(),
  absence_id uuid not null references public.driver_absences(id),
  confirmed_by uuid not null references auth.users(id),
  confirmed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id)
);

create index driver_absence_confirmations_absence_idx on public.driver_absence_confirmations (absence_id, confirmed_at desc);

-- Coverage rule shared with lib/drivers/absences.ts covers() (R3).
create or replace function public.driver_absent_on(p_driver_id uuid, p_date date)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.driver_absences a
    where a.driver_id = p_driver_id
      and a.cancelled_at is null and a.deleted_at is null
      and p_date >= a.start_date
      and (a.end_date is null or p_date <= a.end_date)
      and (a.ended_early_on is null or p_date < a.ended_early_on)
  )
$$;

create or replace function public.validate_driver_absence()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  today date := (now() at time zone 'Asia/Manila')::date;
  driver_row public.drivers;
  dates_changed boolean;
begin
  -- BEFORE triggers run before RLS; stay silent for signed-in users who aren't approved so the RLS
  -- policies reject the row without leaking a rule message (20261031000200).
  if auth.uid() is not null and not public.is_approved_user() then
    return new;
  end if;

  if new.end_date is not null and new.end_date < new.start_date then
    raise exception using errcode = '23514', message = 'The To date must be on or after the From date.';
  end if;
  if new.absence_type = 'day_off' and new.end_date is distinct from new.start_date then
    raise exception using errcode = '23514', message = 'A day-off covers one date.';
  end if;

  dates_changed := tg_op = 'INSERT'
    or new.start_date is distinct from old.start_date
    or new.end_date is distinct from old.end_date
    or new.absence_type is distinct from old.absence_type;

  if tg_op = 'UPDATE' then
    -- A finished absence (cancelled, ended early, or past its last date) is read-only.
    if (old.cancelled_at is not null or old.ended_early_on is not null or (old.end_date is not null and old.end_date < today))
       and (dates_changed
         or new.reason is distinct from old.reason
         or new.note is distinct from old.note
         or new.cancelled_at is distinct from old.cancelled_at
         or new.ended_early_on is distinct from old.ended_early_on) then
      raise exception using errcode = '23514', message = 'This absence is finished and can''t be edited.';
    end if;
    -- An absence that has started can't be shortened to before today; End early stops it today.
    if old.start_date <= today and new.end_date is not null and new.end_date < today
       and new.end_date is distinct from old.end_date then
      raise exception using errcode = '23514', message = 'The end date can''t be before today. Use End early to stop the leave today.';
    end if;
  end if;

  if dates_changed then
    select * into driver_row from public.drivers where id = new.driver_id;
    if driver_row.id is null or driver_row.deleted_at is not null or not driver_row.is_active then
      raise exception using errcode = '23514', message = 'Inactive drivers cannot have absences';
    end if;
  end if;
  return new;
end;
$$;

create trigger driver_absences_validate before insert or update on public.driver_absences
  for each row execute function public.validate_driver_absence();
create trigger driver_absences_audit_fields before insert or update on public.driver_absences
  for each row execute function public.set_audit_fields();
create trigger driver_absences_no_hard_delete before delete on public.driver_absences
  for each row execute function public.reject_hard_delete();
create trigger driver_absences_business_audit after insert or update on public.driver_absences
  for each row execute function public.audit_business_change();

create trigger driver_absence_confirmations_audit_fields before insert or update on public.driver_absence_confirmations
  for each row execute function public.set_audit_fields();
create trigger driver_absence_confirmations_no_hard_delete before delete on public.driver_absence_confirmations
  for each row execute function public.reject_hard_delete();
create trigger driver_absence_confirmations_business_audit after insert or update on public.driver_absence_confirmations
  for each row execute function public.audit_business_change();

-- Feature 010's validation, plus the absence refusal (R4). Everything else is unchanged.
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
  if public.driver_absent_on(new.driver_id, new.service_date) then
    raise exception using errcode = '23514', message = 'This driver is absent on this date. Choose another driver.';
  end if;
  return new;
end;
$$;

alter table public.driver_absences enable row level security;
alter table public.driver_absence_confirmations enable row level security;

-- Owner and staff both manage absences (FR-050).
create policy driver_absences_read_policy on public.driver_absences for select to authenticated
  using (deleted_at is null and public.is_approved_user());
create policy driver_absences_insert_policy on public.driver_absences for insert to authenticated
  with check (public.is_approved_user());
create policy driver_absences_update_policy on public.driver_absences for update to authenticated
  using (deleted_at is null and public.is_approved_user()) with check (public.is_approved_user());

create policy driver_absence_confirmations_read_policy on public.driver_absence_confirmations for select to authenticated
  using (deleted_at is null and public.is_approved_user());
create policy driver_absence_confirmations_insert_policy on public.driver_absence_confirmations for insert to authenticated
  with check (public.is_approved_user());

-- Adds (p_id null) or edits an absence and releases the today-and-later assignments it newly covers,
-- in one transaction (R5). p_release_ids must be exactly the assignments the caller confirmed.
-- Security definer because a released (soft-deleted) assignment no longer passes the read policy, so
-- an RLS-bound update can't release it (feature 010's release_unit_assignments is definer for the
-- same reason). It checks that the caller is an approved user (owner or staff, FR-050) first.
create or replace function public.save_driver_absence(
  p_id uuid,
  p_driver_id uuid,
  p_type public.driver_absence_type,
  p_start date,
  p_end date,
  p_reason public.driver_absence_reason,
  p_note text,
  p_release_ids uuid[],
  p_expected_updated_at timestamptz default null
)
returns public.driver_absences
language plpgsql
security definer
set search_path = public
as $$
declare
  today date := (now() at time zone 'Asia/Manila')::date;
  clean_note text := nullif(trim(coalesce(p_note, '')), '');
  new_end date := case when p_type = 'day_off' then p_start else p_end end;
  old_row public.driver_absences;
  saved public.driver_absences;
  conflict public.driver_absences;
  driver_name text;
  expected uuid[];
  given uuid[];
  locked record;
begin
  if not public.is_approved_user() then
    raise exception using errcode = '42501', message = 'Only approved users can record absences';
  end if;
  if p_driver_id is null or p_type is null or p_start is null or p_reason is null then
    raise exception using errcode = '22023', message = 'Fill in the type, date, and reason.';
  end if;
  if new_end is not null and new_end < p_start then
    raise exception using errcode = '23514', message = 'The To date must be on or after the From date.';
  end if;

  if p_id is not null then
    select * into old_row from public.driver_absences where id = p_id and deleted_at is null;
    if old_row.id is null or old_row.driver_id <> p_driver_id then
      raise exception using errcode = 'P0002', message = 'This absence was not found.';
    end if;
    if old_row.updated_at is distinct from p_expected_updated_at then
      raise exception using errcode = 'P0001', message = 'This absence was changed by someone else. Reload to see it.';
    end if;
  end if;

  -- Friendly overlap check naming the conflict (the exclusion constraint is the race-proof backstop).
  select * into conflict from public.driver_absences a
  where a.driver_id = p_driver_id and a.cancelled_at is null and a.deleted_at is null
    and a.id is distinct from p_id
    and daterange(a.start_date, least(a.end_date + 1, a.ended_early_on), '[)')
        && daterange(p_start, case when new_end is null then null else new_end + 1 end, '[)')
  order by a.start_date
  limit 1;
  if conflict.id is not null then
    select full_name into driver_name from public.drivers where id = p_driver_id;
    raise exception using errcode = '23514', message = case
      when conflict.absence_type = 'day_off' then format('%s is already on day-off %s.', driver_name, to_char(conflict.start_date, 'Mon FMDD'))
      when conflict.end_date is null then format('%s is already on leave from %s (no end date).', driver_name, to_char(conflict.start_date, 'Mon FMDD'))
      else format('%s is already on leave %s to %s.', driver_name, to_char(conflict.start_date, 'Mon FMDD'), to_char(conflict.end_date, 'Mon FMDD'))
    end;
  end if;

  -- Assignments to release: today or later, covered by the new range, not already covered by the old one.
  select coalesce(array_agg(ua.id order by ua.id), '{}') into expected
  from public.unit_assignments ua
  where ua.driver_id = p_driver_id and ua.deleted_at is null
    and ua.service_date >= today
    and ua.service_date >= p_start and (new_end is null or ua.service_date <= new_end)
    and not (old_row.id is not null
      and ua.service_date >= old_row.start_date
      and (old_row.end_date is null or ua.service_date <= old_row.end_date)
      and (old_row.ended_early_on is null or ua.service_date < old_row.ended_early_on));
  select coalesce(array_agg(x order by x), '{}') into given from unnest(coalesce(p_release_ids, '{}')) as x;
  if expected <> given then
    raise exception using errcode = 'P0001', message = 'Assignments for these dates changed. Review them again.';
  end if;

  -- Safeguard (FR-044): an assignment with a recorded remittance is locked and can't be released.
  select coalesce(u.name, u.body_number) as unit_name, ua.service_date into locked
  from public.unit_assignments ua
  join public.units u on u.id = ua.unit_id
  where ua.id = any(expected)
    and exists (select 1 from public.remittances r where r.unit_id = ua.unit_id and r.service_date = ua.service_date and r.deleted_at is null)
  order by ua.service_date
  limit 1;
  if found then
    raise exception using errcode = '23514',
      message = format('%s on %s already has a remittance, so this assignment can''t be released.', locked.unit_name, to_char(locked.service_date, 'Mon FMDD'));
  end if;

  if p_id is null then
    insert into public.driver_absences (driver_id, absence_type, start_date, end_date, reason, note)
    values (p_driver_id, p_type, p_start, new_end, p_reason, clean_note)
    returning * into saved;
  else
    update public.driver_absences
    set absence_type = p_type, start_date = p_start, end_date = new_end, reason = p_reason, note = clean_note,
        -- A new end date clears a stale-flag snooze; it no longer applies.
        snoozed_until = case when new_end is null then snoozed_until else null end
    where id = p_id and updated_at = p_expected_updated_at
    returning * into saved;
    if saved.id is null then
      raise exception using errcode = 'P0001', message = 'This absence was changed by someone else. Reload to see it.';
    end if;
  end if;

  update public.unit_assignments
  set deleted_at = now(), deleted_by = auth.uid()
  where id = any(expected) and deleted_at is null;

  return saved;
end;
$$;

-- Upcoming absences only (R6).
create or replace function public.cancel_driver_absence(p_id uuid, p_expected_updated_at timestamptz)
returns public.driver_absences
language plpgsql
security invoker
set search_path = public
as $$
declare
  today date := (now() at time zone 'Asia/Manila')::date;
  row_now public.driver_absences;
  saved public.driver_absences;
begin
  select * into row_now from public.driver_absences where id = p_id and deleted_at is null;
  if row_now.id is null then
    raise exception using errcode = 'P0002', message = 'This absence was not found.';
  end if;
  if row_now.updated_at is distinct from p_expected_updated_at then
    raise exception using errcode = 'P0001', message = 'This absence was changed by someone else. Reload to see it.';
  end if;
  if row_now.cancelled_at is not null or row_now.ended_early_on is not null or row_now.start_date <= today then
    raise exception using errcode = '23514', message = 'Only upcoming absences can be cancelled. Use End early for one that has started.';
  end if;
  update public.driver_absences
  set cancelled_at = now(), cancelled_by = auth.uid()
  where id = p_id and updated_at = p_expected_updated_at
  returning * into saved;
  return saved;
end;
$$;

-- Ends an absence that covers today, so the driver is available today (R3, R6). Optionally cancels
-- the driver's upcoming absences in the same transaction ("Return to Active").
create or replace function public.end_driver_absence(p_id uuid, p_expected_updated_at timestamptz, p_cancel_upcoming boolean default false)
returns public.driver_absences
language plpgsql
security invoker
set search_path = public
as $$
declare
  today date := (now() at time zone 'Asia/Manila')::date;
  row_now public.driver_absences;
  saved public.driver_absences;
begin
  select * into row_now from public.driver_absences where id = p_id and deleted_at is null;
  if row_now.id is null then
    raise exception using errcode = 'P0002', message = 'This absence was not found.';
  end if;
  if row_now.updated_at is distinct from p_expected_updated_at then
    raise exception using errcode = 'P0001', message = 'This absence was changed by someone else. Reload to see it.';
  end if;
  if row_now.cancelled_at is not null or row_now.ended_early_on is not null
     or row_now.start_date > today or (row_now.end_date is not null and row_now.end_date < today) then
    raise exception using errcode = '23514', message = 'Only an absence that covers today can be ended early.';
  end if;
  update public.driver_absences
  set ended_early_on = today, ended_early_at = now(), ended_early_by = auth.uid()
  where id = p_id and updated_at = p_expected_updated_at
  returning * into saved;
  if coalesce(p_cancel_upcoming, false) then
    update public.driver_absences
    set cancelled_at = now(), cancelled_by = auth.uid()
    where driver_id = row_now.driver_id and id <> p_id and deleted_at is null
      and cancelled_at is null and ended_early_on is null and start_date > today;
  end if;
  return saved;
end;
$$;

-- "Still on leave": logs the confirmation and snoozes the stale flag (R6, FR-055).
create or replace function public.confirm_driver_leave(p_id uuid)
returns public.driver_absences
language plpgsql
security invoker
set search_path = public
as $$
declare
  today date := (now() at time zone 'Asia/Manila')::date;
  row_now public.driver_absences;
  saved public.driver_absences;
  snooze_days smallint;
begin
  select * into row_now from public.driver_absences where id = p_id and deleted_at is null;
  if row_now.id is null or row_now.absence_type <> 'on_leave' or row_now.end_date is not null
     or row_now.cancelled_at is not null or row_now.ended_early_on is not null or row_now.start_date > today then
    raise exception using errcode = '23514', message = 'Only a current open-ended leave can be marked as still on leave.';
  end if;
  select stale_leave_snooze_days into snooze_days from public.fleet_settings where id = true;
  insert into public.driver_absence_confirmations (absence_id, confirmed_by) values (p_id, auth.uid());
  update public.driver_absences
  set snoozed_until = today + coalesce(snooze_days, 7)
  where id = p_id
  returning * into saved;
  return saved;
end;
$$;

revoke execute on function public.driver_absent_on(uuid, date) from public, anon, authenticated;
revoke execute on function public.validate_driver_absence() from public, anon, authenticated;
revoke execute on function public.validate_unit_assignment() from public, anon, authenticated;
revoke execute on function public.save_driver_absence(uuid, uuid, public.driver_absence_type, date, date, public.driver_absence_reason, text, uuid[], timestamptz) from public, anon, authenticated;
revoke execute on function public.cancel_driver_absence(uuid, timestamptz) from public, anon, authenticated;
revoke execute on function public.end_driver_absence(uuid, timestamptz, boolean) from public, anon, authenticated;
revoke execute on function public.confirm_driver_leave(uuid) from public, anon, authenticated;
grant execute on function public.save_driver_absence(uuid, uuid, public.driver_absence_type, date, date, public.driver_absence_reason, text, uuid[], timestamptz) to authenticated;
grant execute on function public.cancel_driver_absence(uuid, timestamptz) to authenticated;
grant execute on function public.end_driver_absence(uuid, timestamptz, boolean) to authenticated;
grant execute on function public.confirm_driver_leave(uuid) to authenticated;

revoke all on public.driver_absences from anon;
revoke all on public.driver_absence_confirmations from anon;
