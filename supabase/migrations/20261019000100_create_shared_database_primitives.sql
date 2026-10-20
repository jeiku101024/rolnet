create extension if not exists pgcrypto;
create extension if not exists btree_gist;

create type public.app_role as enum ('owner', 'staff');
create type public.profile_status as enum ('pending', 'approved', 'rejected', 'deactivated');
create type public.audit_action as enum ('insert', 'update', 'soft_delete', 'restore', 'reverse');

create or replace function public.set_audit_fields()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := coalesce(new.created_at, now());
    new.created_by := coalesce(new.created_by, auth.uid());
  end if;
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

create or replace function public.reject_hard_delete()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  raise exception using errcode = '23514', message = 'Business records must be soft-deleted';
end;
$$;

create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.profiles
  where user_id = auth.uid()
    and account_status = 'approved'
    and deleted_at is null
  limit 1;
$$;

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$ select public.current_app_role() = 'owner'::public.app_role; $$;

create or replace function public.is_approved_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$ select public.current_app_role() is not null; $$;

create or replace function public.require_owner()
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_owner() then
    raise exception using errcode = '42501', message = 'Owner access is required';
  end if;
end;
$$;

create or replace function public.write_audit_event(
  p_entity_type text,
  p_entity_id uuid,
  p_action public.audit_action,
  p_changed_fields jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_events (actor_user_id, entity_type, entity_id, action, changed_fields)
  values (auth.uid(), p_entity_type, p_entity_id, p_action, coalesce(p_changed_fields, '{}'::jsonb));
end;
$$;
