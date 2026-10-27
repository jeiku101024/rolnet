create or replace function public.recalculate_unit_mileage(p_unit_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare next_mileage integer;
begin
  select coalesce(max(mileage), 0) into next_mileage from public.mileage_readings where unit_id = p_unit_id and deleted_at is null;
  update public.units set current_mileage = next_mileage where id = p_unit_id and deleted_at is null;
  return next_mileage;
end;
$$;

create or replace function public.recalculate_mileage_after_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.recalculate_unit_mileage(coalesce(new.unit_id, old.unit_id));
  return coalesce(new, old);
end; $$;

create trigger mileage_recalculate_after_change after insert or update on public.mileage_readings
for each row execute function public.recalculate_mileage_after_change();

create or replace function public.replace_tire_installation(p_current_id uuid, p_replacement jsonb)
returns public.tire_installations
language plpgsql security invoker set search_path = public as $$
declare current_row public.tire_installations; replacement public.tire_installations;
begin
  select * into current_row from public.tire_installations where id=p_current_id and deleted_at is null and replaced_by_id is null for update;
  if current_row.id is null then raise exception using errcode='P0002', message='Current tire was not found'; end if;
  insert into public.tire_installations(unit_id,position,brand,installed_on,installed_mileage,cost_centavos,next_due_date,next_due_mileage)
  values(current_row.unit_id,current_row.position,p_replacement->>'brand',(p_replacement->>'installed_on')::date,nullif(p_replacement->>'installed_mileage','')::integer,(p_replacement->>'cost_centavos')::bigint,nullif(p_replacement->>'next_due_date','')::date,nullif(p_replacement->>'next_due_mileage','')::integer)
  returning * into replacement;
  update public.tire_installations set replaced_by_id=replacement.id where id=current_row.id;
  return replacement;
end; $$;
