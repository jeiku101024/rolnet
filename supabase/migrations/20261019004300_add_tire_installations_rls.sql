alter table public.tire_installations enable row level security;
create policy tires_staff_read on public.tire_installations for select to authenticated using (deleted_at is null and public.is_approved_user());
create policy tires_operational_insert on public.tire_installations for insert to authenticated with check (public.is_approved_user());
create policy tires_operational_update on public.tire_installations for update to authenticated using (public.is_approved_user()) with check (public.is_approved_user());
