create table public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 80),
  system_key text,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id),
  constraint system_category_key_check check ((is_system and system_key is not null) or not is_system)
);

create unique index expense_categories_name_unique on public.expense_categories (lower(trim(name))) where deleted_at is null;
create unique index expense_categories_system_key_unique on public.expense_categories (system_key) where is_system and deleted_at is null;

insert into public.expense_categories (name, system_key, is_system)
values ('Fuel', 'fuel', true), ('Repairs', 'repairs', true), ('Registration', 'registration', true), ('Insurance', 'insurance', true);

create trigger expense_categories_audit_fields before insert or update on public.expense_categories
  for each row execute function public.set_audit_fields();
create trigger expense_categories_no_hard_delete before delete on public.expense_categories
  for each row execute function public.reject_hard_delete();
