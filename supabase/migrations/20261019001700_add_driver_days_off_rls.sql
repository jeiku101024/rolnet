alter table public.driver_days_off enable row level security;

create policy driver_days_off_staff_read_policy on public.driver_days_off for select to authenticated
  using (deleted_at is null and public.is_approved_user());
create policy driver_days_off_owner_insert_policy on public.driver_days_off for insert to authenticated
  with check (public.is_owner());
create policy driver_days_off_owner_update_policy on public.driver_days_off for update to authenticated
  using (public.is_owner()) with check (public.is_owner());
