alter table public.driver_assignments enable row level security;

create policy assignments_staff_read_policy on public.driver_assignments for select to authenticated
  using (deleted_at is null and public.is_approved_user());
create policy assignments_owner_insert_policy on public.driver_assignments for insert to authenticated
  with check (public.is_owner());
create policy assignments_owner_update_policy on public.driver_assignments for update to authenticated
  using (public.is_owner()) with check (public.is_owner());
