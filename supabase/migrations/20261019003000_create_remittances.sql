create type public.remittance_disposition as enum ('returned', 'overnight_overtime');

create table public.remittances (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.driver_assignments(id),
  unit_id uuid not null references public.units(id),
  driver_id uuid not null references public.drivers(id),
  service_date date not null,
  disposition public.remittance_disposition not null,
  amount_due_centavos bigint not null check (amount_due_centavos > 0),
  notes text,
  idempotency_key uuid not null unique,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id)
);

create unique index remittances_unit_date_unique on public.remittances (unit_id, service_date) where deleted_at is null;
create unique index remittances_driver_date_unique on public.remittances (driver_id, service_date) where deleted_at is null;
create index remittances_assignment_idx on public.remittances (assignment_id, service_date desc) where deleted_at is null;

create or replace function public.validate_remittance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare assignment_row public.driver_assignments; backup_row public.driver_assignments;
begin
  select * into assignment_row from public.driver_assignments where id = new.assignment_id and deleted_at is null;
  if assignment_row.id is null or new.service_date < assignment_row.starts_on or (assignment_row.ends_on is not null and new.service_date > assignment_row.ends_on) then
    raise exception using errcode = '23514', message = 'Remittance requires an assignment active on the service date';
  end if;
  if assignment_row.unit_id <> new.unit_id or assignment_row.driver_id <> new.driver_id then
    raise exception using errcode = '23514', message = 'Remittance driver and unit must match the assignment';
  end if;
  select * into backup_row from public.driver_assignments
  where unit_id = assignment_row.unit_id and assignment_type = 'backup' and starts_on = new.service_date and deleted_at is null;
  if backup_row.id is not null and backup_row.id <> assignment_row.id then
    raise exception using errcode = '23514', message = 'Backup driver is the actual operating driver for this date';
  end if;
  new.amount_due_centavos := case when new.disposition = 'overnight_overtime' then 30000 else 18000 end;
  return new;
end;
$$;

create trigger remittances_validate before insert or update on public.remittances
  for each row execute function public.validate_remittance();
create trigger remittances_audit_fields before insert or update on public.remittances
  for each row execute function public.set_audit_fields();
create trigger remittances_no_hard_delete before delete on public.remittances
  for each row execute function public.reject_hard_delete();

create or replace function public.reverse_remittance(p_remittance_id uuid, p_reason text)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare deleted_time timestamptz := now();
begin
  perform public.require_owner();
  update public.remittances set deleted_at = deleted_time, deleted_by = auth.uid(), updated_at = deleted_time, updated_by = auth.uid()
  where id = p_remittance_id and deleted_at is null;
  if not found then raise exception using errcode = 'P0002', message = 'Remittance was not found or already reversed'; end if;
  perform public.write_audit_event('remittances', p_remittance_id, 'reverse', jsonb_build_object('reason', p_reason));
  return deleted_time;
end;
$$;
