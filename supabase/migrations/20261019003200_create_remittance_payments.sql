create table public.remittance_payments (
  id uuid primary key default gen_random_uuid(),
  remittance_id uuid not null references public.remittances(id),
  paid_at timestamptz not null default now(),
  amount_centavos bigint not null check (amount_centavos > 0),
  idempotency_key uuid not null unique,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id)
);

create index remittance_payments_remittance_idx on public.remittance_payments (remittance_id, paid_at) where deleted_at is null;

create or replace function public.validate_remittance_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.remittances where id = new.remittance_id and deleted_at is null) then
    raise exception using errcode = '23514', message = 'Payment requires an active remittance';
  end if;
  return new;
end;
$$;

create trigger remittance_payments_validate before insert or update on public.remittance_payments
  for each row execute function public.validate_remittance_payment();
create trigger remittance_payments_audit_fields before insert or update on public.remittance_payments
  for each row execute function public.set_audit_fields();
create trigger remittance_payments_no_hard_delete before delete on public.remittance_payments
  for each row execute function public.reject_hard_delete();
