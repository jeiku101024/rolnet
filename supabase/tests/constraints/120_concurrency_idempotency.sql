begin;
select plan(4);
select has_index('public','expenses','expenses_idempotency_key_key','expense create retries are durable');
select has_index('public','remittances','remittances_idempotency_key_key','remittance retries are durable');
select has_index('public','remittance_payments','remittance_payments_idempotency_key_key','payment retries are durable');
select has_index('public','documents','documents_idempotency_key_unique','document retries are durable');
select finish();
rollback;
