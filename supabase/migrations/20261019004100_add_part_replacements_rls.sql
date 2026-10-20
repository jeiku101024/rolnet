alter table public.part_replacements enable row level security;
create policy parts_staff_read on public.part_replacements for select to authenticated using (deleted_at is null and public.is_approved_user());
create policy parts_operational_insert on public.part_replacements for insert to authenticated with check (public.is_approved_user());
create policy parts_operational_update on public.part_replacements for update to authenticated using (public.is_approved_user()) with check (public.is_approved_user());
