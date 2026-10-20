alter table public.units enable row level security;

create policy units_staff_read_policy on public.units for select to authenticated
  using (deleted_at is null and public.is_approved_user());
create policy units_owner_insert_policy on public.units for insert to authenticated
  with check (public.is_owner());
create policy units_owner_update_policy on public.units for update to authenticated
  using (public.is_owner()) with check (public.is_owner());
