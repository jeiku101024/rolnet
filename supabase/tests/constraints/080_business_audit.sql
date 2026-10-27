begin;
select plan(2);
select has_function('public','audit_business_change',array[]::text[],'business audit trigger function exists');
select has_trigger('public','expenses','expenses_business_audit','expenses are fully audited');
select finish();
rollback;
