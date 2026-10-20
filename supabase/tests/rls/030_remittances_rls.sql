begin;
select plan(4);
select policies_are('public', 'remittances', array['remittances_staff_read_policy', 'remittances_operational_insert_policy', 'remittances_operational_update_policy'], 'remittance RLS policies exist');
select policies_are('public', 'remittance_payments', array['remittance_payments_staff_read_policy', 'remittance_payments_operational_insert_policy', 'remittance_payments_owner_update_policy'], 'payment RLS policies exist');
select has_function('public', 'reverse_remittance', array['uuid', 'text'], 'reversal is a database function');
select has_table('public', 'remittances', 'remittances protected by RLS');
select finish();
rollback;
