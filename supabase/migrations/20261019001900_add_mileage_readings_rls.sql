alter table public.mileage_readings enable row level security;

create policy mileage_readings_staff_read_policy on public.mileage_readings for select to authenticated
  using (deleted_at is null and public.is_approved_user());
create policy mileage_readings_operational_insert_policy on public.mileage_readings for insert to authenticated
  with check (public.is_approved_user());
create policy mileage_readings_operational_update_policy on public.mileage_readings for update to authenticated
  using (public.is_approved_user()) with check (public.is_approved_user());
