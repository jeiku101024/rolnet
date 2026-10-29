-- FR-008: dated mileage history must never decrease over time. validate_mileage_reading() only
-- compared a reading with the latest earlier one, so a back-dated reading higher than a later
-- reading was accepted. It now also compares with the next later reading. Both lookups ignore the
-- row being updated, and soft-deleting a reading is not re-validated (the after-change trigger
-- recalculates the unit's current mileage).

create or replace function public.validate_mileage_reading()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare previous_mileage integer; next_mileage integer;
begin
  if new.deleted_at is not null then
    return new;
  end if;
  select mileage into previous_mileage from public.mileage_readings
  where unit_id = new.unit_id and id <> new.id and deleted_at is null and reading_date < new.reading_date
  order by reading_date desc limit 1;
  if previous_mileage is not null and new.mileage < previous_mileage then
    raise exception using errcode = '23514', message = 'Mileage cannot decrease from the previous reading';
  end if;
  select mileage into next_mileage from public.mileage_readings
  where unit_id = new.unit_id and id <> new.id and deleted_at is null and reading_date > new.reading_date
  order by reading_date asc limit 1;
  if next_mileage is not null and new.mileage > next_mileage then
    raise exception using errcode = '23514', message = 'Mileage cannot be higher than a later reading';
  end if;
  update public.units set current_mileage = greatest(current_mileage, new.mileage), updated_at = now(), updated_by = auth.uid()
  where id = new.unit_id and deleted_at is null;
  return new;
end;
$$;
