-- Functions in the public schema are callable through the API (/rest/v1/rpc/<name>), and
-- security definer functions bypass RLS. PostgreSQL grants EXECUTE to PUBLIC by default and
-- Supabase also grants it to anon and authenticated, so every function was callable by
-- signed-out visitors. From here on, EXECUTE is granted only where a signed-in caller needs it.

-- 1. Owner-only dashboard queries filter on is_owner(), like dashboard_monthly_unit_summary
--    and driver_outstanding_balances already do.
create or replace function public.expiring_documents(as_of date default current_date)
returns table(id uuid, document_type public.document_type, unit_id uuid, driver_id uuid, expires_on date, bucket text)
language sql stable security definer set search_path=public as $$ select id,document_type,unit_id,driver_id,expires_on,case when expires_on<as_of then 'expired' when expires_on<=as_of+7 then 'due_7' when expires_on<=as_of+30 then 'due_30' else 'valid' end from public.documents where lifecycle_status='current' and deleted_at is null and expires_on<=as_of+30 and public.is_owner() order by expires_on $$;

create or replace function public.due_maintenance(as_of date default current_date) returns table(item_type text,item_id uuid,unit_id uuid,due_date date,due_mileage integer) language sql stable security definer set search_path=public as $$ select 'part'::text,id,unit_id,next_due_date,next_due_mileage from part_replacements where deleted_at is null and public.is_owner() and (next_due_date<=as_of or next_due_mileage<=(select current_mileage from units where units.id=part_replacements.unit_id)) union all select 'tire'::text,id,unit_id,next_due_date,next_due_mileage from tire_installations where deleted_at is null and replaced_by_id is null and public.is_owner() and (next_due_date<=as_of or next_due_mileage<=(select current_mileage from units where units.id=tire_installations.unit_id)) $$;

-- 2. Revoke EXECUTE on every project function in public (extension functions are left alone).
--    Trigger functions need no grant: EXECUTE is checked when a trigger is created, not when it fires.
do $$
declare fn regprocedure;
begin
  for fn in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind in ('f', 'p')
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', fn);
  end loop;
end;
$$;

-- Functions created by later migrations start with no EXECUTE for public, anon, or authenticated;
-- each migration must grant what it needs (see CLAUDE.md).
alter default privileges for role postgres revoke execute on functions from public;
alter default privileges for role postgres in schema public revoke execute on functions from anon, authenticated;

-- 3. Signed-in callers. Each function enforces its own role rules (require_owner(), is_owner()
--    filters, or RLS for security invoker functions).

-- RLS policy helpers, evaluated as the querying user; require_owner() is also called by the
-- security invoker function renew_compliance_document().
grant execute on function public.current_app_role() to authenticated;
grant execute on function public.is_owner() to authenticated;
grant execute on function public.is_approved_user() to authenticated;
grant execute on function public.require_owner() to authenticated;

-- Staff approval (app/actions/auth.ts).
grant execute on function public.approve_staff_registration(uuid) to authenticated;
grant execute on function public.reject_staff_registration(uuid, text) to authenticated;
grant execute on function public.set_staff_account_status(uuid, public.profile_status) to authenticated;

-- Corrections and replacements (app/actions/remittance-corrections.ts, app/api/v1).
grant execute on function public.reverse_remittance(uuid, text) to authenticated;
grant execute on function public.correct_remittance_payment(uuid, text) to authenticated;
grant execute on function public.replace_tire_installation(uuid, jsonb) to authenticated;
grant execute on function public.renew_compliance_document(uuid, jsonb) to authenticated;

-- Dashboard and reports (lib/dashboard/queries.ts, app/api/reports/monthly).
grant execute on function public.dashboard_monthly_unit_summary(date) to authenticated;
grant execute on function public.driver_outstanding_balances(date) to authenticated;
grant execute on function public.due_maintenance(date) to authenticated;
grant execute on function public.expiring_documents(date) to authenticated;
grant execute on function public.monthly_report(date, uuid) to authenticated;

-- Not granted, internal only: write_audit_event() and recalculate_unit_mileage() are called
-- from security definer functions and triggers, which run as the function owner.
