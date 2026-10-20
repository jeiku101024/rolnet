create table public.driver_days_off (
  id uuid primary key default gen_random_uuid(),
  primary_assignment_id uuid not null references public.driver_assignments(id),
  day_off_date date not null,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id)
);

create unique index driver_days_off_unique on public.driver_days_off (primary_assignment_id, day_off_date) where deleted_at is null;
create trigger driver_days_off_audit_fields before insert or update on public.driver_days_off
  for each row execute function public.set_audit_fields();
create trigger driver_days_off_no_hard_delete before delete on public.driver_days_off
  for each row execute function public.reject_hard_delete();
