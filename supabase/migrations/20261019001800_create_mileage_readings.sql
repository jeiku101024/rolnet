create table public.mileage_readings (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id),
  reading_date date not null,
  mileage integer not null check (mileage >= 0),
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id)
);

create unique index mileage_readings_unit_date_unique on public.mileage_readings (unit_id, reading_date) where deleted_at is null;

create or replace function public.validate_mileage_reading()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare previous_mileage integer;
begin
  select mileage into previous_mileage from public.mileage_readings
  where unit_id = new.unit_id and deleted_at is null and reading_date < new.reading_date
  order by reading_date desc limit 1;
  if previous_mileage is not null and new.mileage < previous_mileage then
    raise exception using errcode = '23514', message = 'Mileage cannot decrease from the previous reading';
  end if;
  update public.units set current_mileage = greatest(current_mileage, new.mileage), updated_at = now(), updated_by = auth.uid()
  where id = new.unit_id and deleted_at is null;
  return new;
end;
$$;

create trigger mileage_readings_validate before insert or update on public.mileage_readings
  for each row execute function public.validate_mileage_reading();
create trigger mileage_readings_audit_fields before insert or update on public.mileage_readings
  for each row execute function public.set_audit_fields();
create trigger mileage_readings_no_hard_delete before delete on public.mileage_readings
  for each row execute function public.reject_hard_delete();
