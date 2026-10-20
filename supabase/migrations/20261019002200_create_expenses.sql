create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id),
  category_id uuid not null references public.expense_categories(id),
  expense_date date not null,
  amount_centavos bigint not null check (amount_centavos > 0),
  notes text,
  receipt_object_path text,
  receipt_mime_type text,
  receipt_size_bytes integer,
  receipt_sha256 text,
  idempotency_key uuid not null unique,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id),
  constraint receipt_metadata_check check (
    (receipt_object_path is null and receipt_mime_type is null and receipt_size_bytes is null and receipt_sha256 is null)
    or (receipt_object_path is not null and receipt_mime_type in ('image/jpeg', 'image/png', 'image/webp') and receipt_size_bytes between 1 and 512000 and receipt_sha256 is not null)
  )
);

create index expenses_unit_date_idx on public.expenses (unit_id, expense_date desc) where deleted_at is null;
create index expenses_category_idx on public.expenses (category_id) where deleted_at is null;

create trigger expenses_audit_fields before insert or update on public.expenses
  for each row execute function public.set_audit_fields();
create trigger expenses_no_hard_delete before delete on public.expenses
  for each row execute function public.reject_hard_delete();
