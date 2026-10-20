create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (length(trim(display_name)) between 1 and 120),
  role public.app_role not null default 'staff',
  account_status public.profile_status not null default 'pending',
  approved_at timestamptz,
  approved_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id),
  constraint profiles_approval_fields_check check (
    (account_status = 'approved' and approved_at is not null and approved_by is not null)
    or account_status <> 'approved'
  ),
  constraint profiles_owner_status_check check (
    role = 'owner' or account_status <> 'approved' or approved_by is not null
  )
);

create index profiles_status_idx on public.profiles (account_status) where deleted_at is null;
create index profiles_role_idx on public.profiles (role) where deleted_at is null;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, display_name, role, account_status)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1)),
    'staff',
    'pending'
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.prevent_last_approved_owner_loss()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  remaining_owners integer;
begin
  if old.role = 'owner'
     and old.account_status = 'approved'
     and (new.role <> 'owner' or new.account_status <> 'approved' or new.deleted_at is not null)
  then
    select count(*) into remaining_owners
    from public.profiles
    where role = 'owner'
      and account_status = 'approved'
      and deleted_at is null
      and user_id <> old.user_id;
    if remaining_owners = 0 then
      raise exception using errcode = '23514', message = 'At least one approved owner must remain';
    end if;
  end if;
  return new;
end;
$$;

create trigger profiles_audit_fields
  before insert or update on public.profiles
  for each row execute function public.set_audit_fields();

create trigger profiles_last_owner_guard
  before update on public.profiles
  for each row execute function public.prevent_last_approved_owner_loss();

create trigger profiles_no_hard_delete
  before delete on public.profiles
  for each row execute function public.reject_hard_delete();
