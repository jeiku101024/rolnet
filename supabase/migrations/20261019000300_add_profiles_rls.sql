alter table public.profiles enable row level security;

create policy profiles_select_policy
  on public.profiles for select to authenticated
  using (public.is_owner() or user_id = auth.uid());

create policy profiles_update_policy
  on public.profiles for update to authenticated
  using (public.is_owner())
  with check (public.is_owner());

create or replace function public.approve_staff_registration(p_user_id uuid)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare result public.profiles;
begin
  perform public.require_owner();
  update public.profiles
  set account_status = 'approved', approved_at = now(), approved_by = auth.uid()
  where user_id = p_user_id and role = 'staff' and account_status = 'pending' and deleted_at is null
  returning * into result;
  if result.user_id is null then
    raise exception using errcode = 'P0002', message = 'Pending staff account was not found';
  end if;
  perform public.write_audit_event(p_user_id::text, p_user_id, 'update', jsonb_build_object('account_status', 'approved'));
  return result;
end;
$$;

create or replace function public.reject_staff_registration(p_user_id uuid, p_reason text default null)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare result public.profiles;
begin
  perform public.require_owner();
  update public.profiles
  set account_status = 'rejected', updated_at = now(), updated_by = auth.uid()
  where user_id = p_user_id and role = 'staff' and account_status = 'pending' and deleted_at is null
  returning * into result;
  if result.user_id is null then
    raise exception using errcode = 'P0002', message = 'Pending staff account was not found';
  end if;
  perform public.write_audit_event(p_user_id::text, p_user_id, 'update', jsonb_build_object('account_status', 'rejected', 'reason', p_reason));
  return result;
end;
$$;

create or replace function public.set_staff_account_status(p_user_id uuid, p_status public.profile_status)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare result public.profiles;
begin
  perform public.require_owner();
  if p_status not in ('approved', 'deactivated') then
    raise exception using errcode = '22023', message = 'Staff status must be approved or deactivated';
  end if;
  update public.profiles
  set account_status = p_status,
      approved_at = case when p_status = 'approved' then coalesce(approved_at, now()) else approved_at end,
      approved_by = case when p_status = 'approved' then coalesce(approved_by, auth.uid()) else approved_by end,
      updated_at = now(), updated_by = auth.uid()
  where user_id = p_user_id and role = 'staff' and deleted_at is null
  returning * into result;
  if result.user_id is null then
    raise exception using errcode = 'P0002', message = 'Staff account was not found';
  end if;
  perform public.write_audit_event(p_user_id::text, p_user_id, 'update', jsonb_build_object('account_status', p_status));
  return result;
end;
$$;

revoke all on function public.approve_staff_registration(uuid) from public, anon, authenticated;
revoke all on function public.reject_staff_registration(uuid, text) from public, anon, authenticated;
revoke all on function public.set_staff_account_status(uuid, public.profile_status) from public, anon, authenticated;
grant execute on function public.approve_staff_registration(uuid) to authenticated;
grant execute on function public.reject_staff_registration(uuid, text) to authenticated;
grant execute on function public.set_staff_account_status(uuid, public.profile_status) to authenticated;
