alter table public.audit_events enable row level security;

create policy audit_events_select_policy
  on public.audit_events for select to authenticated
  using (public.is_owner());

revoke insert, update, delete on public.audit_events from anon, authenticated;
grant insert on public.audit_events to authenticated;
