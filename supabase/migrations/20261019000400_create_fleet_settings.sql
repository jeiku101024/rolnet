create table public.fleet_settings (
  id boolean primary key default true check (id = true),
  fleet_name text not null check (length(trim(fleet_name)) between 1 and 160),
  timezone text not null default 'Asia/Manila',
  standard_remittance_centavos bigint not null default 18000 check (standard_remittance_centavos > 0),
  overnight_remittance_centavos bigint not null default 30000 check (overnight_remittance_centavos > standard_remittance_centavos),
  document_warning_days smallint[] not null default '{30,7}' check (document_warning_days = '{30,7}'),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id)
);

insert into public.fleet_settings (fleet_name)
values ('Tricycle Fleet');

create trigger fleet_settings_audit_fields
  before insert or update on public.fleet_settings
  for each row execute function public.set_audit_fields();

create trigger fleet_settings_no_hard_delete
  before delete on public.fleet_settings
  for each row execute function public.reject_hard_delete();
