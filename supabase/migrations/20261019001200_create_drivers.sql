create type public.driver_kind as enum ('primary', 'backup');

create table public.drivers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (length(trim(full_name)) between 1 and 160),
  driver_kind public.driver_kind not null default 'primary',
  license_number text not null check (length(trim(license_number)) between 1 and 80),
  license_expiry_date date not null,
  phone text not null check (length(trim(phone)) between 3 and 40),
  address text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id)
);

create unique index drivers_license_unique on public.drivers (upper(trim(license_number))) where deleted_at is null;
create index drivers_expiry_idx on public.drivers (license_expiry_date) where deleted_at is null;

create trigger drivers_audit_fields before insert or update on public.drivers
  for each row execute function public.set_audit_fields();
create trigger drivers_no_hard_delete before delete on public.drivers
  for each row execute function public.reject_hard_delete();
