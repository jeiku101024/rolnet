alter table public.drivers enable row level security;

create policy drivers_staff_read_policy on public.drivers for select to authenticated
  using (deleted_at is null and public.is_approved_user());
create policy drivers_owner_insert_policy on public.drivers for insert to authenticated
  with check (public.is_owner());
create policy drivers_owner_update_policy on public.drivers for update to authenticated
  using (public.is_owner()) with check (public.is_owner());
