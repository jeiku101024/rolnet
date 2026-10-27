begin;
select plan(2);
select has_function('public','correct_remittance_payment',array['uuid','text'],'payment correction requires a function');
select has_trigger('public','remittance_payments','remittance_payments_no_hard_delete','payment hard deletes remain blocked');
select finish();
rollback;
