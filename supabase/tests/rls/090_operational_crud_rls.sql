begin;
select plan(2);
select policies_are('public','expenses',array['expenses_staff_read_policy','expenses_operational_insert_policy','expenses_operational_update_policy'],'expense policies remain explicit');
select policies_are('public','remittances',array['remittances_staff_read_policy','remittances_operational_insert_policy','remittances_operational_update_policy'],'remittance policies remain explicit');
select finish();
rollback;
