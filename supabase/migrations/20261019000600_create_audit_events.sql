create table public.audit_events (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  actor_user_id uuid references auth.users(id),
  entity_type text not null check (length(trim(entity_type)) between 1 and 100),
  entity_id uuid not null,
  action public.audit_action not null,
  changed_fields jsonb not null default '{}'::jsonb
);

create index audit_events_entity_idx on public.audit_events (entity_type, entity_id, occurred_at desc);
create index audit_events_actor_idx on public.audit_events (actor_user_id, occurred_at desc);

create trigger audit_events_no_update
  before update on public.audit_events
  for each row execute function public.reject_hard_delete();

create trigger audit_events_no_delete
  before delete on public.audit_events
  for each row execute function public.reject_hard_delete();
