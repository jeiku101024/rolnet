-- Feature 011, migration 3 of 3: part replacements, tire installations and the old expense
-- categories become read-only (research R9; contracts/database.md "Migration 3").
-- Reads keep working; costs are recorded as expenses from now on.

drop policy if exists parts_operational_insert on public.part_replacements;
drop policy if exists parts_operational_update on public.part_replacements;
drop policy if exists tires_operational_insert on public.tire_installations;
drop policy if exists tires_operational_update on public.tire_installations;
drop policy if exists expense_categories_owner_insert_policy on public.expense_categories;
drop policy if exists expense_categories_owner_update_policy on public.expense_categories;

-- soft_delete_record / restore_record refuse anything not on this list (22023).
create or replace function public.soft_deletable_table(p_table text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select p_table = any (array['units','drivers','driver_assignments','driver_days_off','mileage_readings','expenses']);
$$;

-- Kept for history, no longer callable by the app.
revoke execute on function public.replace_tire_installation(uuid, jsonb) from authenticated;
revoke execute on function public.due_maintenance(date) from authenticated;
