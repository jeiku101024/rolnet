create table public.part_replacements (
  id uuid primary key default gen_random_uuid(), unit_id uuid not null references public.units(id),
  part_name text not null check (length(trim(part_name)) between 1 and 120),
  cost_centavos bigint not null check (cost_centavos >= 0), replaced_on date not null,
  replacement_mileage integer check (replacement_mileage is null or replacement_mileage >= 0),
  next_due_date date, next_due_mileage integer check (next_due_mileage is null or next_due_mileage >= 0), notes text,
  created_at timestamptz not null default now(), created_by uuid references auth.users(id), updated_at timestamptz not null default now(), updated_by uuid references auth.users(id), deleted_at timestamptz, deleted_by uuid references auth.users(id),
  constraint part_due_check check (next_due_date is not null or next_due_mileage is not null),
  constraint part_date_order_check check (next_due_date is null or next_due_date > replaced_on),
  constraint part_mileage_order_check check (next_due_mileage is null or replacement_mileage is null or next_due_mileage > replacement_mileage)
);
create index part_replacements_unit_idx on public.part_replacements (unit_id, replaced_on desc) where deleted_at is null;
create trigger part_replacements_audit_fields before insert or update on public.part_replacements for each row execute function public.set_audit_fields();
create trigger part_replacements_no_hard_delete before delete on public.part_replacements for each row execute function public.reject_hard_delete();
