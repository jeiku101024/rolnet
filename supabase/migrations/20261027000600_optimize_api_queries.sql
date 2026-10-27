create index if not exists assignments_updated_idx on public.driver_assignments(updated_at desc,id) where deleted_at is null;
create index if not exists mileage_updated_idx on public.mileage_readings(updated_at desc,id) where deleted_at is null;
create index if not exists expenses_updated_idx on public.expenses(updated_at desc,id) where deleted_at is null;
create index if not exists remittances_updated_idx on public.remittances(updated_at desc,id) where deleted_at is null;
create index if not exists payments_updated_idx on public.remittance_payments(updated_at desc,id) where deleted_at is null;
create index if not exists documents_updated_idx on public.documents(updated_at desc,id) where deleted_at is null;
