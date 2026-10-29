-- FR-022 / FR-025: "today" is the fleet's local calendar date (Asia/Manila), not the database
-- server's current_date (UTC), which is a day behind between 00:00 and 08:00 Manila time.
-- The as_of defaults of expiring_documents() and due_maintenance() now use the Manila date; the
-- bodies are unchanged (including their is_owner() filters), and create or replace keeps the
-- existing EXECUTE grants. driver_outstanding_balances() got the same default in
-- 20261029001000_fix_driver_outstanding_balances.sql.

create or replace function public.expiring_documents(as_of date default (now() at time zone 'Asia/Manila')::date)
returns table(id uuid, document_type public.document_type, unit_id uuid, driver_id uuid, expires_on date, bucket text)
language sql stable security definer set search_path=public as $$ select id,document_type,unit_id,driver_id,expires_on,case when expires_on<as_of then 'expired' when expires_on<=as_of+7 then 'due_7' when expires_on<=as_of+30 then 'due_30' else 'valid' end from public.documents where lifecycle_status='current' and deleted_at is null and expires_on<=as_of+30 and public.is_owner() order by expires_on $$;

create or replace function public.due_maintenance(as_of date default (now() at time zone 'Asia/Manila')::date) returns table(item_type text,item_id uuid,unit_id uuid,due_date date,due_mileage integer) language sql stable security definer set search_path=public as $$ select 'part'::text,id,unit_id,next_due_date,next_due_mileage from part_replacements where deleted_at is null and public.is_owner() and (next_due_date<=as_of or next_due_mileage<=(select current_mileage from units where units.id=part_replacements.unit_id)) union all select 'tire'::text,id,unit_id,next_due_date,next_due_mileage from tire_installations where deleted_at is null and replaced_by_id is null and public.is_owner() and (next_due_date<=as_of or next_due_mileage<=(select current_mileage from units where units.id=tire_installations.unit_id)) $$;
