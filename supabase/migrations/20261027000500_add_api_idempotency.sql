alter table public.expenses add column if not exists receipt_finalize_key uuid;
create unique index if not exists expenses_receipt_finalize_key_unique on public.expenses(receipt_finalize_key) where receipt_finalize_key is not null;
alter table public.documents add column if not exists idempotency_key uuid;
create unique index if not exists documents_idempotency_key_unique on public.documents(idempotency_key) where idempotency_key is not null;
