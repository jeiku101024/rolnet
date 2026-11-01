-- Feature 010 follow-up: record_unit_status_change() stamped changed_at with now(), which is fixed
-- for the whole transaction. A unit created and then changed in one transaction got two rows with the
-- same time, so "the latest change" was ambiguous and unit_status_on() could return the creation
-- status (caught by 290_unit_status_blocking.sql). clock_timestamp() gives each row its own time.
-- The body is otherwise unchanged from 20261101000200.

create or replace function public.record_unit_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare stamped timestamptz := clock_timestamp();
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return null;
  end if;
  insert into public.unit_status_changes (unit_id, from_status, to_status, changed_at, effective_on, changed_by)
  values (
    new.id,
    case when tg_op = 'UPDATE' then old.status end,
    new.status,
    stamped,
    (stamped at time zone 'Asia/Manila')::date,
    auth.uid()
  );
  return null;
end;
$$;

revoke execute on function public.record_unit_status_change() from public, anon, authenticated;
