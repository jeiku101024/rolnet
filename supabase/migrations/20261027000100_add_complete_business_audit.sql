create or replace function public.audit_business_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  old_row jsonb := case when tg_op = 'INSERT' then '{}'::jsonb else to_jsonb(old) end;
  new_row jsonb := case when tg_op = 'DELETE' then '{}'::jsonb else to_jsonb(new) end;
  entity_uuid uuid;
  audit_kind public.audit_action := 'update';
  safe_old jsonb;
  safe_new jsonb;
begin
  entity_uuid := case
    when tg_table_name = 'profiles' then (coalesce(new_row, old_row)->>'user_id')::uuid
    when tg_table_name = 'fleet_settings' then '00000000-0000-0000-0000-000000000001'::uuid
    else (coalesce(nullif(new_row, '{}'::jsonb), old_row)->>'id')::uuid
  end;
  if tg_op = 'INSERT' then audit_kind := 'insert';
  elsif old_row->>'deleted_at' is null and new_row->>'deleted_at' is not null then audit_kind := 'soft_delete';
  elsif old_row->>'deleted_at' is not null and new_row->>'deleted_at' is null then audit_kind := 'restore';
  end if;
  safe_old := old_row - array['object_path','receipt_object_path','sha256','receipt_sha256','idempotency_key','receipt_finalize_key','created_by','updated_by','deleted_by'];
  safe_new := new_row - array['object_path','receipt_object_path','sha256','receipt_sha256','idempotency_key','receipt_finalize_key','created_by','updated_by','deleted_by'];
  insert into public.audit_events(actor_user_id, entity_type, entity_id, action, changed_fields)
  values (auth.uid(), tg_table_name, entity_uuid, audit_kind, jsonb_build_object('before', safe_old, 'after', safe_new));
  return null;
end;
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array['profiles','fleet_settings','units','drivers','driver_assignments','driver_days_off','mileage_readings','expense_categories','expenses','remittances','remittance_payments','part_replacements','tire_installations','documents']
  loop
    execute format('drop trigger if exists %I_business_audit on public.%I', table_name, table_name);
    execute format('create trigger %I_business_audit after insert or update on public.%I for each row execute function public.audit_business_change()', table_name, table_name);
  end loop;
end;
$$;
