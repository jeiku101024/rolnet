create type public.unit_status as enum ('active', 'in_repair', 'retired');

create table public.units (
  id uuid primary key default gen_random_uuid(),
  body_number text not null check (length(trim(body_number)) between 1 and 40),
  plate_number text not null check (length(trim(plate_number)) between 1 and 20),
  make_model text not null check (length(trim(make_model)) between 1 and 120),
  status public.unit_status not null default 'active',
  current_mileage integer not null default 0 check (current_mileage >= 0),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id)
);

create unique index units_body_number_unique on public.units (lower(trim(body_number))) where deleted_at is null;
create unique index units_plate_number_unique on public.units (upper(trim(plate_number))) where deleted_at is null;

create trigger units_audit_fields before insert or update on public.units
  for each row execute function public.set_audit_fields();
create trigger units_no_hard_delete before delete on public.units
  for each row execute function public.reject_hard_delete();
