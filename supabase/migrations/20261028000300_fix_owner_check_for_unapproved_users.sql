-- current_app_role() is NULL for any signed-in user without an approved profile (pending,
-- rejected, deactivated, or deleted). is_owner() therefore returned NULL instead of false,
-- and require_owner()'s `if not public.is_owner()` treated NULL as "not denied", letting
-- such users run owner-only functions (for example approving their own registration).
-- is_owner() now always returns true or false, and require_owner() denies anything but true.

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$ select coalesce(public.current_app_role() = 'owner'::public.app_role, false); $$;

create or replace function public.require_owner()
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if public.is_owner() is not true then
    raise exception using errcode = '42501', message = 'Owner access is required';
  end if;
end;
$$;
