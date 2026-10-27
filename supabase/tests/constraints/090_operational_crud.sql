begin;
select plan(3);
select has_function('public','recalculate_unit_mileage',array['uuid'],'mileage recalculation is transactional');
select has_function('public','replace_tire_installation',array['uuid','jsonb'],'tire replacement is transactional');
select has_column('public','expenses','idempotency_key','expenses retain durable idempotency');
select finish();
rollback;
