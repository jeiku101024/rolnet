-- contracts/actions.md softDeleteUnit: "reject active dependencies requiring resolution".
-- soft_delete_record() (20261029000900) deleted a unit even while drivers were still assigned to it,
-- leaving open assignments, and remittances recorded against them, pointing at a hidden unit.
-- A unit now cannot be deleted while it has a non-deleted assignment that ends on or after the
-- fleet date (Asia/Manila), or has no end date; the owner ends or removes those assignments first.
-- The rest of the function is unchanged; create or replace keeps the EXECUTE grant.

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
  if p_table = 'units'
     and exists (
       select 1 from public.driver_assignments
       where unit_id = p_id
         and deleted_at is null
         and coalesce(ends_on, 'infinity'::date) >= (now() at time zone 'Asia/Manila')::date
     ) then
    raise exception using errcode = '23503',
      message = 'This unit still has current or upcoming driver assignments. End or remove them before deleting the unit';
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
