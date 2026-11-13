begin;
select plan(18);

-- Feature 015 (20261113000100_sinking_fund_tables.sql): constraints per transaction type, centavo math,
-- unique active names and driver links, the audit trigger, no hard deletes, and the derived views.

insert into public.drivers (id, full_name, license_number, license_expiry_date, phone)
values ('00000000-0000-0000-0000-000000410201', 'SF Table Driver', 'SF-410-L1', '2035-12-31', '09170000410');

insert into public.sf_participants (id, name, driver_id) values ('00000000-0000-0000-0000-000000410101', 'Ana', '00000000-0000-0000-0000-000000410201');

select throws_ok($$insert into public.sf_participants (name) values ('  ANA ')$$, '23505', null,
  'an active participant name is unique, ignoring case and spaces');
update public.sf_participants set archived_at = now() where id = '00000000-0000-0000-0000-000000410101';
select lives_ok($$insert into public.sf_participants (id, name) values ('00000000-0000-0000-0000-000000410102', 'Ana')$$,
  'an archived participant''s name can be reused');
select throws_ok($$insert into public.sf_participants (name, driver_id) values ('Driver Twin', '00000000-0000-0000-0000-000000410201')$$, '23505', null,
  'a driver can be linked to one participant only');

insert into public.sf_transactions (participant_id, type, amount_centavos, tx_date)
values ('00000000-0000-0000-0000-000000410102', 'deposit', 1000000, '2026-01-05');

select throws_ok($$insert into public.sf_transactions (participant_id, type, amount_centavos, tx_date, loan_id)
  values ('00000000-0000-0000-0000-000000410102', 'deposit', 100, '2026-01-06', gen_random_uuid())$$, '23514', null,
  'a deposit cannot carry a loan id (per-type shape)');
select throws_ok($$insert into public.sf_transactions (participant_id, type, amount_centavos, tx_date, interest_rate_bp, interest_centavos, amount_due_centavos, due_date)
  values ('00000000-0000-0000-0000-000000410102', 'loan', 15000, '2026-01-06', 500, 750, 15750, '2026-02-06')$$, '23514', null,
  'a loan must be a multiple of 10,000 centavos (₱100)');
select lives_ok($$insert into public.sf_transactions (id, participant_id, type, amount_centavos, tx_date, interest_rate_bp, interest_centavos, amount_due_centavos, due_date)
  values ('00000000-0000-0000-0000-000000410301', '00000000-0000-0000-0000-000000410102', 'loan', 200000, '2026-01-06', 500, 10000, 210000, '2026-02-06')$$,
  'a ₱2,000 loan stores 5% interest of ₱100 and ₱2,100 due');
select throws_ok($$insert into public.sf_transactions (participant_id, type, amount_centavos, tx_date, interest_rate_bp, interest_centavos, amount_due_centavos, due_date)
  values ('00000000-0000-0000-0000-000000410102', 'loan', 200000, '2026-01-07', 500, 9999, 209999, '2026-02-07')$$, '23514', null,
  'loan interest must equal principal times the stored rate');
select lives_ok($$insert into public.sf_transactions (participant_id, type, amount_centavos, tx_date, loan_id, interest_part_centavos, principal_part_centavos, interest_set_by)
  values ('00000000-0000-0000-0000-000000410102', 'payment', 50000, '2026-01-10', '00000000-0000-0000-0000-000000410301', 10000, 40000, 'owner')$$,
  'a payment stores its interest and principal parts');
select throws_ok($$insert into public.sf_transactions (participant_id, type, amount_centavos, tx_date, loan_id, interest_part_centavos, principal_part_centavos, interest_set_by)
  values ('00000000-0000-0000-0000-000000410102', 'payment', 50000, '2026-01-11', '00000000-0000-0000-0000-000000410301', 10000, 30000, 'owner')$$, '23514', null,
  'the two parts of a payment must add up to the amount');
select throws_ok($$delete from public.sf_transactions where id = '00000000-0000-0000-0000-000000410301'$$, '23514', 'Business records must be soft-deleted',
  'ledger rows cannot be hard-deleted');
select ok((select count(*) from public.audit_events where entity_type = 'sf_transactions' and entity_id = '00000000-0000-0000-0000-000000410301' and action = 'insert') >= 1,
  'a ledger insert is audited');

select is((select array[balance_centavos, unpaid_interest_centavos, unpaid_principal_centavos]
  from public.sf_loans_v where id = '00000000-0000-0000-0000-000000410301'), array[160000, 0, 160000]::bigint[],
  'the loan view derives balance and unpaid parts from payments');

insert into public.sf_transactions (id, participant_id, type, amount_centavos, tx_date, interest_rate_bp, interest_centavos, amount_due_centavos, due_date)
values ('00000000-0000-0000-0000-000000410302', '00000000-0000-0000-0000-000000410102', 'loan', 200000, public.sf_today() - 90, 500, 10000, 210000, public.sf_today() - 60);
select ok((select overdue from public.sf_loans_v where id = '00000000-0000-0000-0000-000000410302'), 'a loan past its due date with a balance is overdue');

insert into public.sf_transactions (participant_id, type, amount_centavos, tx_date, loan_id, interest_waived_centavos)
values ('00000000-0000-0000-0000-000000410102', 'loan_withdrawal', 210000, public.sf_today(), '00000000-0000-0000-0000-000000410302', 10000);
select is((select array[balance_centavos::text, status, overdue::text] from public.sf_loans_v where id = '00000000-0000-0000-0000-000000410302'),
  array['0', 'withdrawn', 'false'], 'a withdrawn loan has balance 0 and is not overdue');
select throws_ok($$insert into public.sf_transactions (participant_id, type, amount_centavos, tx_date, loan_id, interest_waived_centavos)
  values ('00000000-0000-0000-0000-000000410102', 'loan_withdrawal', 210000, public.sf_today(), '00000000-0000-0000-0000-000000410302', 10000)$$, '23505', null,
  'a loan can be closed as a withdrawal only once');

select is((select savings_after_centavos from public.sf_ledger_v where participant_id = '00000000-0000-0000-0000-000000410102' and type = 'deposit'),
  1000000::bigint, 'the ledger view shows savings after the deposit');

select throws_ok($$insert into public.sf_settings default values$$, '23505', null, 'there is only one settings row');
update public.sf_settings set default_interest_prefill = 'last';
select ok((select count(*) from public.audit_events where entity_type = 'sf_settings' and action = 'update') >= 1,
  'a settings change is audited (fixed uuid entity id)');

select * from finish();
rollback;
