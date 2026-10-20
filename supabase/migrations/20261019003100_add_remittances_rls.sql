alter table public.remittances enable row level security;

create policy remittances_staff_read_policy on public.remittances for select to authenticated
  using (deleted_at is null and public.is_approved_user());
create policy remittances_operational_insert_policy on public.remittances for insert to authenticated
  with check (public.is_approved_user());
create policy remittances_operational_update_policy on public.remittances for update to authenticated
  using (public.is_approved_user()) with check (public.is_approved_user());

revoke all on function public.reverse_remittance(uuid, text) from public, anon, authenticated;
grant execute on function public.reverse_remittance(uuid, text) to authenticated;
