alter table public.fleet_settings enable row level security;

create policy fleet_settings_select_policy
  on public.fleet_settings for select to authenticated
  using (deleted_at is null and public.is_approved_user());

create policy fleet_settings_update_policy
  on public.fleet_settings for update to authenticated
  using (public.is_owner() and deleted_at is null)
  with check (public.is_owner() and id = true and standard_remittance_centavos = 18000 and overnight_remittance_centavos = 30000 and document_warning_days = '{30,7}');
