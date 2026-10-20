begin;

select plan(10);
select has_table('public', 'profiles', 'profiles table exists');
select has_table('public', 'fleet_settings', 'fleet settings table exists');
select has_table('public', 'audit_events', 'audit events table exists');
select has_function('public', 'approve_staff_registration', array['uuid'], 'approval function exists');
select has_function('public', 'reject_staff_registration', array['uuid', 'text'], 'rejection function exists');

set local role anon;
select throws_ok(
  $$select * from public.profiles$$,
  '42501',
  null,
  'anonymous users cannot read profiles'
);
select throws_ok(
  $$select * from public.audit_events$$,
  '42501',
  null,
  'anonymous users cannot read audit events'
);
reset role;

select policies_are('public', 'profiles', array['profiles_select_policy', 'profiles_update_policy'], 'profiles policies exist');
select policies_are('public', 'audit_events', array['audit_events_select_policy'], 'audit policies exist');

select finish();
rollback;
