begin;
select no_plan();

-- Feature 019 (20261119000100_sf_standings.sql): the monthly standings read. Savings, open loans and the unpaid
-- balance are as the ledger stood at the end of the chosen date; archived and later-joined participants, voided
-- rows and loans closed by then are left out; overdue is judged on the chosen date; only the owner may call it.

insert into auth.users (id, email, aud, role)
values
  ('00000000-0000-0000-0000-000000450001', 'sf-standings-owner@rolnet.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000450002', 'sf-standings-staff@rolnet.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000450003', 'sf-standings-pending@rolnet.test', 'authenticated', 'authenticated');
update public.profiles
set role = 'owner', account_status = 'approved', approved_at = now(), approved_by = user_id
where user_id = '00000000-0000-0000-0000-000000450001';
update public.profiles
set account_status = 'approved', approved_at = now(), approved_by = '00000000-0000-0000-0000-000000450001'
where user_id = '00000000-0000-0000-0000-000000450002';

-- Ana: deposit, a loan that is overdue on Feb 15, a partial payment on Mar 1.
-- Bo: a loan withdrawn on Feb 1.  Cy: joined Feb 20.  Dee: archived Mar 1.  Eve: one voided deposit.
-- Flo: a loan repaid in full on Feb 5.
insert into public.sf_participants (id, name, created_at, archived_at) values
  ('00000000-0000-0000-0000-000000450101', 'Ana', '2026-01-01 12:00+00', null),
  ('00000000-0000-0000-0000-000000450102', 'Bo', '2026-01-01 12:00+00', null),
  ('00000000-0000-0000-0000-000000450103', 'Cy', '2026-02-20 12:00+00', null),
  ('00000000-0000-0000-0000-000000450104', 'Dee', '2026-01-01 12:00+00', '2026-03-01 12:00+00'),
  ('00000000-0000-0000-0000-000000450105', 'Eve', '2026-01-01 12:00+00', null),
  ('00000000-0000-0000-0000-000000450106', 'Flo', '2026-01-01 12:00+00', null);

insert into public.sf_transactions (id, participant_id, type, amount_centavos, tx_date) values
  ('00000000-0000-0000-0000-000000450201', '00000000-0000-0000-0000-000000450101', 'deposit', 1000000, '2026-01-05'),
  ('00000000-0000-0000-0000-000000450202', '00000000-0000-0000-0000-000000450102', 'deposit', 500000, '2026-01-05'),
  ('00000000-0000-0000-0000-000000450203', '00000000-0000-0000-0000-000000450103', 'deposit', 1000, '2026-02-21'),
  ('00000000-0000-0000-0000-000000450204', '00000000-0000-0000-0000-000000450104', 'deposit', 9000, '2026-01-05'),
  ('00000000-0000-0000-0000-000000450205', '00000000-0000-0000-0000-000000450105', 'deposit', 50000, '2026-01-06'),
  ('00000000-0000-0000-0000-000000450206', '00000000-0000-0000-0000-000000450106', 'deposit', 300000, '2026-01-05');
insert into public.sf_transactions (id, participant_id, type, amount_centavos, tx_date, voided_at, void_reason)
values ('00000000-0000-0000-0000-000000450207', '00000000-0000-0000-0000-000000450105', 'deposit', 100000, '2026-01-07', now(), 'Entered twice');

insert into public.sf_transactions (id, participant_id, type, amount_centavos, tx_date, interest_rate_bp, interest_centavos, amount_due_centavos, due_date) values
  ('00000000-0000-0000-0000-000000450301', '00000000-0000-0000-0000-000000450101', 'loan', 200000, '2026-01-10', 500, 10000, 210000, '2026-02-10'),
  ('00000000-0000-0000-0000-000000450302', '00000000-0000-0000-0000-000000450102', 'loan', 100000, '2026-01-20', 500, 5000, 105000, '2026-02-20'),
  ('00000000-0000-0000-0000-000000450303', '00000000-0000-0000-0000-000000450106', 'loan', 100000, '2026-01-10', 500, 5000, 105000, '2026-02-10');
insert into public.sf_transactions (participant_id, type, amount_centavos, tx_date, loan_id, interest_part_centavos, principal_part_centavos, interest_set_by) values
  ('00000000-0000-0000-0000-000000450101', 'payment', 50000, '2026-03-01', '00000000-0000-0000-0000-000000450301', 10000, 40000, 'owner'),
  ('00000000-0000-0000-0000-000000450106', 'payment', 105000, '2026-02-05', '00000000-0000-0000-0000-000000450303', 5000, 100000, 'owner');
insert into public.sf_transactions (participant_id, type, amount_centavos, tx_date, loan_id, interest_waived_centavos)
values ('00000000-0000-0000-0000-000000450102', 'loan_withdrawal', 105000, '2026-02-01', '00000000-0000-0000-0000-000000450302', 5000);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000450001","role":"authenticated"}', true);

-- Jan 31: Ana's loan is open and not yet overdue; Flo's loan is open (repaid later); Cy has not joined.
select is((select array_agg(name order by name) from public.sf_standings('2026-01-31')), array['Ana', 'Bo', 'Eve', 'Flo'], 'Jan 31: archived and later-joined participants are left out');
select is((select array[savings_centavos, loans_centavos, balance_to_pay_centavos]::bigint[] from public.sf_standings('2026-01-31') where name = 'Ana'),
  array[800000, 200000, 210000]::bigint[], 'Jan 31: Ana saved 10,000 and borrowed 2,000, owing 2,100');
select is((select has_overdue from public.sf_standings('2026-01-31') where name = 'Ana'), false, 'Jan 31: a loan not yet due is not overdue');
select is((select array[loans_centavos, balance_to_pay_centavos]::bigint[] from public.sf_standings('2026-01-31') where name = 'Flo'),
  array[100000, 105000]::bigint[], 'Jan 31: a loan repaid later still counts on the earlier date');
select is((select savings_centavos from public.sf_standings('2026-01-31') where name = 'Eve'), 50000::bigint, 'a voided deposit is never counted');

-- Feb 15: Ana is overdue, Bo's loan was withdrawn on Feb 1, Flo repaid on Feb 5, Cy still not joined.
select is((select has_overdue from public.sf_standings('2026-02-15') where name = 'Ana'), true, 'Feb 15: Ana has a loan past its due date');
select is((select array[loans_centavos, balance_to_pay_centavos]::bigint[] from public.sf_standings('2026-02-15') where name = 'Bo'),
  array[0, 0]::bigint[], 'Feb 15: a loan withdrawn on Feb 1 no longer counts');
select is((select savings_centavos from public.sf_standings('2026-02-15') where name = 'Bo'), 400000::bigint, 'Feb 15: a withdrawn loan already left the savings');
select is((select array[loans_centavos, balance_to_pay_centavos, savings_centavos]::bigint[] from public.sf_standings('2026-02-15') where name = 'Flo'),
  array[0, 0, 300000]::bigint[], 'Feb 15: a loan repaid on Feb 5 no longer counts and the principal is back in savings');
select is((select count(*)::int from public.sf_standings('2026-02-15') where name = 'Cy'), 0, 'Feb 15: Cy joined on Feb 20');

-- Mar 15: Cy is in; Ana has paid part of her loan.
select is((select array_agg(name order by name) from public.sf_standings('2026-03-15')), array['Ana', 'Bo', 'Cy', 'Eve', 'Flo'], 'Mar 15: Cy is listed and Dee stays archived');
select is((select array[savings_centavos, loans_centavos, balance_to_pay_centavos]::bigint[] from public.sf_standings('2026-03-15') where name = 'Ana'),
  array[840000, 200000, 160000]::bigint[], 'Mar 15: a partial payment lowers the balance and returns principal to savings');

select throws_ok($$select * from public.sf_standings(null)$$, 'P0001', null, 'a date is required');
select is((select count(*)::int from public.sf_standings('2025-12-31')), 0, 'before anyone joined, nothing is listed');
reset role;

-- Staff, unapproved users and signed-out callers get nothing.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000450002","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$select * from public.sf_standings('2026-03-15')$$, '42501', null, 'approved staff cannot read the standings');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000450003","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$select * from public.sf_standings('2026-03-15')$$, '42501', null, 'a user waiting for approval cannot read the standings');
reset role;
set local role anon;
select throws_ok($$select * from public.sf_standings('2026-03-15')$$, '42501', null, 'anon cannot call the standings function');
reset role;

select * from finish();
rollback;
