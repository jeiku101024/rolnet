alter table public.notification_outbox enable row level security;
create policy outbox_owner_read on public.notification_outbox for select to authenticated using (public.is_owner());
