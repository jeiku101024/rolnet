alter table public.expenses enable row level security;

create policy expenses_staff_read_policy on public.expenses for select to authenticated
  using (deleted_at is null and public.is_approved_user());
create policy expenses_operational_insert_policy on public.expenses for insert to authenticated
  with check (public.is_approved_user());
create policy expenses_operational_update_policy on public.expenses for update to authenticated
  using (public.is_approved_user()) with check (public.is_approved_user());
