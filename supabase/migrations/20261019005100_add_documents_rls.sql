alter table public.documents enable row level security;
create policy documents_owner_select on public.documents for select to authenticated using (public.is_owner());
create policy documents_owner_insert on public.documents for insert to authenticated with check (public.is_owner());
create policy documents_owner_update on public.documents for update to authenticated using (public.is_owner()) with check (public.is_owner());
