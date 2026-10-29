-- FR-005 / FR-030 / Constitution III: owners soft-delete records; staff never delete.
--
-- Problem: on fleet_settings, units, drivers, driver_assignments, driver_days_off, mileage_readings,
-- expense_categories, expenses, remittances, remittance_payments, part_replacements and
-- tire_installations the only SELECT policy is `deleted_at is null`. PostgreSQL checks an updated
-- row against the SELECT policies, so every UPDATE that sets deleted_at failed with 42501 for
-- everyone, including the owner. Staff were kept from deleting only by that side effect.
--
-- Design (chosen so current views keep excluding deleted rows without touching SELECT policies):
-- 1. The SELECT policies stay as they are, so no app query or view starts seeing deleted rows.
-- 2. Owners soft-delete and restore through two security definer functions that call
--    require_owner(), accept only an allow-listed table, and optionally check the expected
--    updated_at (optimistic concurrency for /api/v1 If-Match). They return the changed row as JSON,
--    or NULL when no matching row was found (missing, already deleted/restored, or stale).
--    Remittances and payments are excluded: they are corrected with the audited, reason-bearing
--    reverse_remittance() and correct_remittance_payment(). fleet_settings is excluded too: it is a
--    single required row, not a deletable record. Documents keep their existing owner-only policies.
-- 3. A BEFORE UPDATE trigger on all twelve tables rejects any change to deleted_at or deleted_by
--    made directly by a signed-in non-owner (anon/authenticated), so staff are denied by an explicit
--    owner-only rule rather than by accident. Security definer functions (which run as their owner
--    and do their own role checks, e.g. reverse_remittance) are unaffected.

create or replace function public.guard_soft_delete_columns()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if (new.deleted_at is distinct from old.deleted_at or new.deleted_by is distinct from old.deleted_by)
     and current_user in ('anon', 'authenticated')
     and public.is_owner() is not true
  then
    raise exception using errcode = '42501', message = 'Only the owner can delete or restore records';
  end if;
  return new;
end;
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array['fleet_settings','units','drivers','driver_assignments','driver_days_off','mileage_readings','expense_categories','expenses','remittances','remittance_payments','part_replacements','tire_installations']
  loop
    execute format('create trigger %I_guard_soft_delete before update on public.%I for each row execute function public.guard_soft_delete_columns()', table_name, table_name);
  end loop;
end;
$$;

create or replace function public.soft_deletable_table(p_table text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select p_table = any (array['units','drivers','driver_assignments','driver_days_off','mileage_readings','expense_categories','expenses','part_replacements','tire_installations']);
$$;

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
  execute format(
    'update public.%I set deleted_at = now(), deleted_by = auth.uid()
     where id = $1 and deleted_at is null and ($2::timestamptz is null or updated_at = $2)
     returning to_jsonb(%I.*)',
    p_table, p_table
  ) into result using p_id, p_expected_updated_at;
  return result;
end;
$$;

create or replace function public.restore_record(p_table text, p_id uuid, p_expected_updated_at timestamptz default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare result jsonb;
begin
  perform public.require_owner();
  if not public.soft_deletable_table(p_table) then
    raise exception using errcode = '22023', message = 'This kind of record cannot be restored here';
  end if;
  execute format(
    'update public.%I set deleted_at = null, deleted_by = null
     where id = $1 and deleted_at is not null and ($2::timestamptz is null or updated_at = $2)
     returning to_jsonb(%I.*)',
    p_table, p_table
  ) into result using p_id, p_expected_updated_at;
  return result;
end;
$$;

-- Called by the app (app/actions/*.ts, lib/domain/crud.ts); each checks require_owner().
-- soft_deletable_table() and guard_soft_delete_columns() stay internal.
grant execute on function public.soft_delete_record(text, uuid, timestamptz) to authenticated;
grant execute on function public.restore_record(text, uuid, timestamptz) to authenticated;
