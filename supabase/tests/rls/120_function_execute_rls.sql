begin;
select plan(16);

-- No project function in public is callable by signed-out visitors.
select is_empty(
  $$select p.oid::regprocedure::text
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
      and has_function_privilege('anon', p.oid, 'execute')$$,
  'no public function is executable by anon'
);

-- Internal helpers are not callable by signed-in users either.
select ok(not has_function_privilege('authenticated', 'public.write_audit_event(text, uuid, public.audit_action, jsonb)', 'execute'), 'signed-in users cannot forge audit events');
select ok(not has_function_privilege('authenticated', 'public.recalculate_unit_mileage(uuid)', 'execute'), 'signed-in users cannot recalculate unit mileage directly');

-- Functions the app calls stay available to signed-in users.
select ok(has_function_privilege('authenticated', 'public.monthly_report(date, uuid)', 'execute'), 'signed-in users can request the monthly report');
select ok(has_function_privilege('authenticated', 'public.is_owner()', 'execute'), 'RLS helper is_owner() stays executable');

set local role anon;
select throws_ok($$select * from public.monthly_report(current_date, null)$$, '42501', null, 'anon cannot run the monthly report');
select throws_ok($$select * from public.expiring_documents(current_date)$$, '42501', null, 'anon cannot list expiring documents');
select throws_ok($$select public.write_audit_event('units', gen_random_uuid(), 'update', '{}'::jsonb)$$, '42501', null, 'anon cannot write audit events');
reset role;

-- A signed-in user who is not an approved owner gets no rows from owner-only queries.
set local role authenticated;
select is_empty($$select * from public.expiring_documents(current_date + 3650)$$, 'non-owners see no expiring documents');
reset role;

-- Feature 011: retired maintenance functions and the new expense helpers are not callable by the app.
select ok(not has_function_privilege('authenticated', 'public.due_maintenance(date)', 'execute'), 'due_maintenance is retired');
select ok(not has_function_privilege('authenticated', 'public.replace_tire_installation(uuid, jsonb)', 'execute'), 'replace_tire_installation is retired');
select ok(not has_function_privilege('authenticated', 'public.normalize_expense()', 'execute'), 'normalize_expense is trigger-only');
select ok(not has_function_privilege('authenticated', 'public.maintenance_category_for(text)', 'execute'), 'maintenance_category_for is migration-only');
select ok(not has_function_privilege('authenticated', 'public.move_maintenance_into_expenses()', 'execute')
  and not has_function_privilege('authenticated', 'public.verify_maintenance_move(uuid)', 'execute'), 'the maintenance move functions are migration-only');

-- Feature 012: the absence and role functions the app calls are granted; the helpers are not.
select ok(has_function_privilege('authenticated', 'public.save_driver_absence(uuid, uuid, public.driver_absence_type, date, date, public.driver_absence_reason, text, uuid[], timestamptz)', 'execute')
  and has_function_privilege('authenticated', 'public.cancel_driver_absence(uuid, timestamptz)', 'execute')
  and has_function_privilege('authenticated', 'public.end_driver_absence(uuid, timestamptz, boolean)', 'execute')
  and has_function_privilege('authenticated', 'public.confirm_driver_leave(uuid)', 'execute')
  and has_function_privilege('authenticated', 'public.set_driver_role(uuid, public.driver_kind, timestamptz)', 'execute')
  and has_function_privilege('authenticated', 'public.undo_driver_role_change(uuid)', 'execute'), 'signed-in users can call the absence and role functions');
select ok(not has_function_privilege('authenticated', 'public.driver_absent_on(uuid, date)', 'execute')
  and not has_function_privilege('authenticated', 'public.validate_driver_absence()', 'execute'), 'the absence helpers are internal');

select finish();
rollback;
