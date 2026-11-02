-- Feature 012 (specs/012-drivers-absences-roles), migration 2 of 2: Primary/Backup role history.
--
-- Every switch of drivers.driver_kind is logged in driver_role_changes, written in the same
-- transaction by set_driver_role (research R7). The role a driver had on a past date is computed
-- from this log in the app (R8), so switching never rewrites old records. Existing drivers get no
-- history rows: their current role applies to all past dates until their first logged change (FR-062).
--
-- Owner and staff can switch roles (FR-050), but drivers updates are owner-only under RLS, so the
-- switch is a narrow security definer function that checks is_approved_user() and changes only
-- driver_kind. Undo withdraws the change (soft delete) and keeps it in the audit log (FR-025).

create table public.driver_role_changes (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.drivers(id),
  from_role public.driver_kind not null,
  to_role public.driver_kind not null,
  changed_by uuid not null references auth.users(id),
  changed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id),
  constraint driver_role_changes_roles_differ check (from_role <> to_role)
);

create index driver_role_changes_driver_idx on public.driver_role_changes (driver_id, changed_at) where deleted_at is null;

create trigger driver_role_changes_audit_fields before insert or update on public.driver_role_changes
  for each row execute function public.set_audit_fields();
create trigger driver_role_changes_no_hard_delete before delete on public.driver_role_changes
  for each row execute function public.reject_hard_delete();
create trigger driver_role_changes_business_audit after insert or update on public.driver_role_changes
  for each row execute function public.audit_business_change();

alter table public.driver_role_changes enable row level security;

-- Read for approved users; writes only through the functions below.
create policy driver_role_changes_read_policy on public.driver_role_changes for select to authenticated
  using (deleted_at is null and public.is_approved_user());

-- Switches a driver's role and logs it. Returns the change id, or null when the role is already p_to_role.
create or replace function public.set_driver_role(p_driver_id uuid, p_to_role public.driver_kind, p_expected_updated_at timestamptz)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  driver_row public.drivers;
  change_id uuid;
begin
  if not public.is_approved_user() then
    raise exception using errcode = '42501', message = 'Only approved users can change a driver''s role';
  end if;
  select * into driver_row from public.drivers where id = p_driver_id and deleted_at is null for update;
  if driver_row.id is null then
    raise exception using errcode = 'P0002', message = 'This driver was not found.';
  end if;
  if driver_row.driver_kind = p_to_role then
    return null;
  end if;
  if driver_row.updated_at is distinct from p_expected_updated_at then
    raise exception using errcode = 'P0001', message = 'This driver was changed by someone else. Reload to see it.';
  end if;
  update public.drivers set driver_kind = p_to_role where id = p_driver_id;
  insert into public.driver_role_changes (driver_id, from_role, to_role, changed_by)
  values (p_driver_id, driver_row.driver_kind, p_to_role, auth.uid())
  returning id into change_id;
  return change_id;
end;
$$;

-- Undo: only the caller's own latest change for that driver, within 60 seconds (the toast shows 5 s;
-- the server allows longer for network delay).
create or replace function public.undo_driver_role_change(p_change_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  change_row public.driver_role_changes;
begin
  if not public.is_approved_user() then
    raise exception using errcode = '42501', message = 'Only approved users can change a driver''s role';
  end if;
  select * into change_row from public.driver_role_changes where id = p_change_id and deleted_at is null for update;
  if change_row.id is null
     or change_row.changed_by is distinct from auth.uid()
     or change_row.changed_at < now() - interval '60 seconds'
     or exists (
       select 1 from public.driver_role_changes later
       where later.driver_id = change_row.driver_id and later.deleted_at is null
         and later.id <> change_row.id
         and (later.changed_at, later.id) > (change_row.changed_at, change_row.id)
     ) then
    raise exception using errcode = 'P0001', message = 'This change can no longer be undone.';
  end if;
  update public.drivers set driver_kind = change_row.from_role where id = change_row.driver_id;
  update public.driver_role_changes set deleted_at = now(), deleted_by = auth.uid() where id = p_change_id;
end;
$$;

-- Feature 005's inactive-details lock, without driver_kind (roles may change while a driver is
-- Inactive) and with the new notes column.
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
     or new.license_number is distinct from old.license_number
     or new.phone is distinct from old.phone
     or new.address is distinct from old.address
     or new.notes is distinct from old.notes
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

revoke execute on function public.set_driver_role(uuid, public.driver_kind, timestamptz) from public, anon, authenticated;
revoke execute on function public.undo_driver_role_change(uuid) from public, anon, authenticated;
revoke execute on function public.lock_inactive_driver_details() from public, anon, authenticated;
grant execute on function public.set_driver_role(uuid, public.driver_kind, timestamptz) to authenticated;
grant execute on function public.undo_driver_role_change(uuid) to authenticated;

revoke all on public.driver_role_changes from anon;
