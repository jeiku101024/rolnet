alter table public.expense_categories enable row level security;

create policy expense_categories_staff_read_policy on public.expense_categories for select to authenticated
  using (deleted_at is null and public.is_approved_user());
create policy expense_categories_owner_insert_policy on public.expense_categories for insert to authenticated
  with check (public.is_owner());
create policy expense_categories_owner_update_policy on public.expense_categories for update to authenticated
  using (public.is_owner() and not is_system) with check (public.is_owner() and not is_system);
