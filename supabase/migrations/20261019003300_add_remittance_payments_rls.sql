alter table public.remittance_payments enable row level security;

create policy remittance_payments_staff_read_policy on public.remittance_payments for select to authenticated
  using (deleted_at is null and public.is_approved_user());
create policy remittance_payments_operational_insert_policy on public.remittance_payments for insert to authenticated
  with check (public.is_approved_user());
create policy remittance_payments_owner_update_policy on public.remittance_payments for update to authenticated
  using (public.is_owner()) with check (public.is_owner());
