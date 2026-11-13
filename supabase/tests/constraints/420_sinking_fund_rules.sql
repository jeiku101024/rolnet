begin;
select no_plan();

-- Feature 015 (20261113000200_sinking_fund_rules.sql): worked examples A and B from the spec, the
-- allowed interest range, default prefill, back-dating, savings withdrawal, loan Withdrawal, distribution,
-- every void rule, idempotency, and the owner-only checks. Dates are relative to sf_today().
-- (select id from sf_t where k = 'k') below expands to the id saved under that key in the temp table sf_t.

insert into auth.users (id, email, aud, role)
values
  ('00000000-0000-0000-0000-000000420001', 'sf-owner@rolnet.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000420002', 'sf-staff@rolnet.test', 'authenticated', 'authenticated');
update public.profiles
set role = 'owner', account_status = 'approved', approved_at = now(), approved_by = user_id
where user_id = '00000000-0000-0000-0000-000000420001';
update public.profiles
set account_status = 'approved', approved_at = now(), approved_by = '00000000-0000-0000-0000-000000420001'
where user_id = '00000000-0000-0000-0000-000000420002';

create temp table sf_t (k text primary key, id uuid);
grant all on sf_t to authenticated;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000420001","role":"authenticated"}', true);

-- Participants (owner) --------------------------------------------------------------------------------------
insert into sf_t select 'a', public.sf_add_participant('Ana', null, null);
insert into sf_t select 'b', public.sf_add_participant('Ben', null, 'second participant');
insert into sf_t select 'c', public.sf_add_participant('Cy', null, null);
insert into sf_t select 'd', public.sf_add_participant('Dee', null, null);
insert into sf_t select 'e', public.sf_add_participant('Eve', null, null);
insert into sf_t select 'f', public.sf_add_participant('Fay', null, null);
select throws_ok($$select public.sf_add_participant('ANA', null, null)$$, 'P0001', 'A participant named ANA already exists.', 'a duplicate name is refused');

-- Worked example A: owner deposit and loan, staff payments with the default (take interest first) -------------
insert into sf_t select 'a_dep', public.sf_record_deposit((select id from sf_t where k = 'a'), public.sf_today() - 30, 1000000, 'opening savings', null);
insert into sf_t select 'a_loan', public.sf_record_loan((select id from sf_t where k = 'a'), public.sf_today() - 5, 200000, null, null);
select is(public.sf_savings_at((select id from sf_t where k = 'a')), 800000::bigint, 'A2: after a ₱2,000 loan savings are ₱8,000');
select is((select array[interest_centavos, amount_due_centavos] from public.sf_transactions where id = (select id from sf_t where k = 'a_loan')), array[10000, 210000]::bigint[],
  'A2: the loan stores ₱100 interest and ₱2,100 due');
select is((select due_date from public.sf_transactions where id = (select id from sf_t where k = 'a_loan')), (public.sf_today() - 5 + interval '1 month')::date, 'the due date is one month after the loan date');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000420002","role":"authenticated"}', true);
insert into sf_t select 'a_p1', public.sf_record_payment((select id from sf_t where k = 'a_loan'), public.sf_today() - 4, 50000, 99999, null, null);
select is((select array[interest_part_centavos, principal_part_centavos] from public.sf_transactions where id = (select id from sf_t where k = 'a_p1')), array[10000, 40000]::bigint[],
  'A3: staff payments use the default (interest first); the interest part they sent is ignored');
select is((select interest_set_by::text from public.sf_transactions where id = (select id from sf_t where k = 'a_p1')), 'default', 'A3: the part is marked as set by the default');
select is(public.sf_savings_at((select id from sf_t where k = 'a')), 840000::bigint, 'A3: savings are ₱8,400');
select is((select balance_centavos from public.sf_loans_v where id = (select id from sf_t where k = 'a_loan')), 160000::bigint, 'A3: the loan balance is ₱1,600');
select is((select interest_available_centavos from public.sf_fund_summary()), 10000::bigint, 'A3: the Interest fund holds ₱100');
insert into sf_t select 'a_p2', public.sf_record_payment((select id from sf_t where k = 'a_loan'), public.sf_today() - 3, 160000, null, null, null);
select is((select array[balance_centavos::text, status] from public.sf_loans_v where id = (select id from sf_t where k = 'a_loan')), array['0', 'paid'], 'A4a: the loan is paid');
select is(public.sf_savings_at((select id from sf_t where k = 'a')), 1000000::bigint, 'A4a: savings are back to ₱10,000');

-- Worked example B: the owner takes the interest on the second payment ---------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000420001","role":"authenticated"}', true);
insert into sf_t select 'b_dep', public.sf_record_deposit((select id from sf_t where k = 'b'), public.sf_today() - 30, 1000000, null, null);
insert into sf_t select 'b_loan', public.sf_record_loan((select id from sf_t where k = 'b'), public.sf_today() - 5, 200000, null, null);
insert into sf_t select 'b_p1', public.sf_record_payment((select id from sf_t where k = 'b_loan'), public.sf_today() - 4, 50000, 0, null, null);
select is(public.sf_savings_at((select id from sf_t where k = 'b')), 850000::bigint, 'B3: owner sets interest 0, savings are ₱8,500');
select is((select interest_available_centavos from public.sf_fund_summary()), 10000::bigint, 'B3: the Interest fund is unchanged');
insert into sf_t select 'b_p2', public.sf_record_payment((select id from sf_t where k = 'b_loan'), public.sf_today() - 3, 100000, 10000, null, null);
select is(public.sf_savings_at((select id from sf_t where k = 'b')), 940000::bigint, 'B4: owner sets interest 100, savings are ₱9,400');
select is((select interest_available_centavos from public.sf_fund_summary()), 20000::bigint, 'B4: the Interest fund is ₱200');
select throws_ok($$select public.sf_record_payment((select id from sf_t where k = 'b_loan'), public.sf_today() - 2, 60000, 10, null, null)$$,
  'P0001', 'Interest part must be between ₱0.00 and ₱0.00 for this payment.', 'B5: no interest is left, so the allowed range is zero');
insert into sf_t select 'b_p3', public.sf_record_payment((select id from sf_t where k = 'b_loan'), public.sf_today() - 2, 60000, null, null, null);
select is(public.sf_savings_at((select id from sf_t where k = 'b')), 1000000::bigint, 'B5: savings are back to ₱10,000');
select is((select status from public.sf_loans_v where id = (select id from sf_t where k = 'b_loan')), 'paid', 'B5: the loan is paid');

-- Back-dating: savings must stay at or above zero on every date --------------------------------------------------
insert into sf_t select 'c_dep1', public.sf_record_deposit((select id from sf_t where k = 'c'), public.sf_today() - 40, 100000, null, null);
insert into sf_t select 'c_dep2', public.sf_record_deposit((select id from sf_t where k = 'c'), public.sf_today() - 20, 500000, null, null);
select throws_like($$select public.sf_record_loan((select id from sf_t where k = 'c'), public.sf_today() - 35, 300000, null, null)$$,
  'Cy only had ₱1,000.00 on %', 'a ₱3,000 loan dated before the second deposit is blocked and names the amount and date');
select lives_ok($$insert into sf_t select 'c_loan', public.sf_record_loan((select id from sf_t where k = 'c'), public.sf_today() - 35, 80000, null, null)$$,
  'an ₱800 loan on the same date is allowed');
select is(public.sf_savings_at((select id from sf_t where k = 'c')), 520000::bigint, 'Cy''s savings are ₱5,200');
select is((select overdue from public.sf_loans_v where id = (select id from sf_t where k = 'c_loan')), true, 'a loan whose due date has passed is overdue');

-- Loan, payment, and date rules -----------------------------------------------------------------------------------
insert into sf_t select 'd_dep', public.sf_record_deposit((select id from sf_t where k = 'd'), public.sf_today() - 30, 1000000, null, null);
insert into sf_t select 'd_loan', public.sf_record_loan((select id from sf_t where k = 'd'), public.sf_today() - 5, 100000, null, null);
select throws_ok($$select public.sf_record_loan((select id from sf_t where k = 'a'), public.sf_today(), 15000, null, null)$$,
  'P0001', 'Loans must be in steps of ₱100 (₱100, ₱200, ₱300...).', 'a loan must be in steps of ₱100');
select throws_ok($$select public.sf_record_loan((select id from sf_t where k = 'a'), public.sf_today(), 2000000, null, null)$$,
  'P0001', 'Loan cannot be higher than total savings (₱10,000.00).', 'a loan today cannot be higher than total savings');
select throws_ok($$select public.sf_record_payment((select id from sf_t where k = 'd_loan'), public.sf_today(), 200000, null, null, null)$$,
  'P0001', 'Payment cannot be higher than the balance (₱1,050.00).', 'a payment cannot be higher than the loan balance');
select throws_like($$select public.sf_record_payment((select id from sf_t where k = 'd_loan'), public.sf_today() - 6, 10000, null, null, null)$$,
  'Payment date cannot be before the loan date (%', 'a payment cannot be dated before its loan');
select throws_ok($$select public.sf_record_deposit((select id from sf_t where k = 'a'), public.sf_today() + 1, 100, null, null)$$,
  'P0001', 'The date cannot be in the future.', 'future dates are refused');
select throws_ok($$select public.sf_record_deposit((select id from sf_t where k = 'a'), public.sf_today(), 0, null, null)$$,
  'P0001', 'Enter an amount greater than ₱0.00.', 'an amount of zero is refused');
select throws_ok($$select public.sf_mark_loan_withdrawal((select id from sf_t where k = 'd_loan'), 105000)$$,
  'P0001', 'Only an overdue loan can be closed as a withdrawal.', 'an open loan that is not overdue cannot be closed');

-- Idempotency -------------------------------------------------------------------------------------------------------
insert into sf_t select 'idem1', public.sf_record_deposit((select id from sf_t where k = 'a'), public.sf_today(), 100, null, '00000000-0000-0000-0000-000000420901');
insert into sf_t select 'idem2', public.sf_record_deposit((select id from sf_t where k = 'a'), public.sf_today(), 100, null, '00000000-0000-0000-0000-000000420901');
select is((select count(*)::int from public.sf_transactions where idempotency_key = '00000000-0000-0000-0000-000000420901'), 1, 'a retried save with the same key is stored once');
select is((select id from sf_t where k = 'idem1'), (select id from sf_t where k = 'idem2'), 'the retry returns the same row');
-- Remove that ₱1 again so later balances stay round.
select lives_ok($$select public.sf_void_transaction((select id from sf_t where k = 'idem1'), 'test cleanup', (select updated_at from public.sf_transactions where id = (select id from sf_t where k = 'idem1')))$$,
  'the cleanup deposit can be voided');

-- Loan Withdrawal on an overdue loan (worked example A step 4b) ---------------------------------------------------------
insert into sf_t select 'e_dep', public.sf_record_deposit((select id from sf_t where k = 'e'), public.sf_today() - 90, 1000000, null, null);
insert into sf_t select 'e_loan', public.sf_record_loan((select id from sf_t where k = 'e'), public.sf_today() - 70, 200000, null, null);
insert into sf_t select 'e_p1', public.sf_record_payment((select id from sf_t where k = 'e_loan'), public.sf_today() - 60, 50000, null, null, null);
select is(public.sf_savings_at((select id from sf_t where k = 'e')), 840000::bigint, 'Eve: savings are ₱8,400 before the withdrawal');
select throws_ok($$select public.sf_mark_loan_withdrawal((select id from sf_t where k = 'e_loan'), 150000)$$, '40001', null, 'a stale balance is refused');
insert into sf_t select 'e_wd', public.sf_mark_loan_withdrawal((select id from sf_t where k = 'e_loan'), 160000);
select is(public.sf_savings_at((select id from sf_t where k = 'e')), 840000::bigint, '4b: savings are unchanged by the withdrawal');
select is((select array[balance_centavos::text, status] from public.sf_loans_v where id = (select id from sf_t where k = 'e_loan')), array['0', 'withdrawn'], '4b: the loan is withdrawn with balance 0');
select is((select array[amount_centavos, interest_waived_centavos] from public.sf_transactions where id = (select id from sf_t where k = 'e_wd')), array[160000, 0]::bigint[], 'the withdrawal closes ₱1,600 with no interest left to waive');
select throws_ok($$select public.sf_record_payment((select id from sf_t where k = 'e_loan'), public.sf_today(), 100, null, null, null)$$,
  'P0001', 'This loan was closed as a withdrawal.', 'a withdrawn loan takes no payments');
select throws_ok($$select public.sf_change_interest_part((select id from sf_t where k = 'e_p1'), 0, (select updated_at from public.sf_transactions where id = (select id from sf_t where k = 'e_p1')))$$,
  'P0001', 'This loan was closed as a withdrawal, so its payments cannot change.', 'a payment on a withdrawn loan cannot change');
select throws_ok($$select public.sf_void_transaction((select id from sf_t where k = 'e_p1'), 'wrong entry', (select updated_at from public.sf_transactions where id = (select id from sf_t where k = 'e_p1')))$$,
  'P0001', 'Void the Withdrawal first.', 'a payment on a withdrawn loan cannot be voided first');
select throws_ok($$select public.sf_void_transaction((select id from sf_t where k = 'e_loan'), 'wrong entry', (select updated_at from public.sf_transactions where id = (select id from sf_t where k = 'e_loan')))$$,
  'P0001', 'This loan has payments or a withdrawal. Void them first.', 'a loan with payments cannot be voided');
select lives_ok($$select public.sf_void_transaction((select id from sf_t where k = 'e_wd'), 'closed by mistake', (select updated_at from public.sf_transactions where id = (select id from sf_t where k = 'e_wd')))$$,
  'voiding a withdrawal is allowed');
select is((select array[balance_centavos::text, status] from public.sf_loans_v where id = (select id from sf_t where k = 'e_loan')), array['160000', 'open'], 'voiding the withdrawal reopens the loan with its previous balance');

-- Change interest part, default prefill ------------------------------------------------------------------------------------
insert into sf_t select 'f_dep', public.sf_record_deposit((select id from sf_t where k = 'f'), public.sf_today() - 30, 1000000, null, null);
insert into sf_t select 'f_loan', public.sf_record_loan((select id from sf_t where k = 'f'), public.sf_today() - 5, 200000, null, null);
select throws_ok($$select public.sf_record_payment((select id from sf_t where k = 'f_loan'), public.sf_today() - 4, 50000, 20000, null, null)$$,
  'P0001', 'Interest part must be between ₱0.00 and ₱100.00 for this payment.', 'the owner cannot set more interest than is unpaid');
insert into sf_t select 'f_p1', public.sf_record_payment((select id from sf_t where k = 'f_loan'), public.sf_today() - 4, 50000, 0, null, null);
select is(public.sf_savings_at((select id from sf_t where k = 'f')), 850000::bigint, 'Fay: savings after an interest-free payment');
select lives_ok($$select public.sf_change_interest_part((select id from sf_t where k = 'f_p1'), 10000, (select updated_at from public.sf_transactions where id = (select id from sf_t where k = 'f_p1')))$$,
  'the owner can change the interest part later');
select is(public.sf_savings_at((select id from sf_t where k = 'f')), 840000::bigint, 'moving ₱100 to the Interest fund lowers savings by ₱100');
select throws_ok($$select public.sf_change_interest_part((select id from sf_t where k = 'f_p1'), 60000, (select updated_at from public.sf_transactions where id = (select id from sf_t where k = 'f_p1')))$$,
  'P0001', 'Interest part must be between ₱0.00 and ₱100.00 for this payment.', 'a changed interest part must stay in range');
select is((select interest_available_centavos from public.sf_fund_summary()), 40000::bigint, 'the Interest fund now holds ₱400 (Ana, Ben, Eve, Fay)');

select lives_ok($$select public.sf_set_default_prefill('last')$$, 'the owner can switch the default to take interest last');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000420002","role":"authenticated"}', true);
insert into sf_t select 'd_p1', public.sf_record_payment((select id from sf_t where k = 'd_loan'), public.sf_today() - 3, 20000, null, null, null);
select is((select interest_part_centavos from public.sf_transactions where id = (select id from sf_t where k = 'd_p1')), 0::bigint, 'take interest last prefills the smallest allowed part (0 until principal is repaid) for staff');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000420001","role":"authenticated"}', true);
select lives_ok($$select public.sf_set_default_prefill('first')$$, 'and back to first');

-- Savings withdrawal and archive ---------------------------------------------------------------------------------------------
select throws_ok($$select public.sf_record_savings_withdrawal((select id from sf_t where k = 'a'), public.sf_today(), 1500000, null, null)$$,
  'P0001', 'Withdrawal cannot be higher than total savings (₱10,000.00).', 'a savings withdrawal cannot exceed savings');
insert into sf_t select 'a_sw', public.sf_record_savings_withdrawal((select id from sf_t where k = 'a'), public.sf_today(), 1000000, 'leaving', null);
select is(public.sf_savings_at((select id from sf_t where k = 'a')), 0::bigint, 'withdrawing all savings leaves ₱0');
select throws_like($$select public.sf_archive_participant((select id from sf_t where k = 'd'), (select updated_at from public.sf_participants where id = (select id from sf_t where k = 'd')))$$,
  '%open or overdue loan%', 'a participant with an open loan cannot be archived');
select lives_ok($$select public.sf_archive_participant((select id from sf_t where k = 'a'), (select updated_at from public.sf_participants where id = (select id from sf_t where k = 'a')))$$,
  'a participant with ₱0 savings and no open loans can be archived');
select throws_ok($$select public.sf_record_deposit((select id from sf_t where k = 'a'), public.sf_today(), 100, null, null)$$,
  'P0002', 'This participant was not found or is archived.', 'an archived participant takes no new transactions');
select lives_ok($$select public.sf_add_participant('Ana', null, null)$$, 'an archived participant''s name can be used again');

-- Distribution of ₱400.00 among three: ₱133.33 each, ₱0.01 stays ------------------------------------------------------------------
select throws_ok($$select public.sf_distribute_interest(public.sf_today(), array[(select id from sf_t where k = 'a')], null, null)$$,
  'P0001', 'Only active participants can receive a share.', 'archived participants cannot receive a share');
insert into sf_t select 'dist1', public.sf_distribute_interest(public.sf_today(), array[(select id from sf_t where k = 'b'), (select id from sf_t where k = 'c'), (select id from sf_t where k = 'd')], '2026 year-end', null);
select is((select array[available_before_centavos, per_participant_centavos, total_distributed_centavos, remainder_centavos]
  from public.sf_distributions where id = (select id from sf_t where k = 'dist1')), array[40000, 13333, 39999, 1]::bigint[], 'the fund is divided in whole centavos and ₱0.01 remains');
select is((select count(*)::int from public.sf_transactions where distribution_id = (select id from sf_t where k = 'dist1') and type = 'interest_share'), 3, 'one interest share per participant');
select is(public.sf_savings_at((select id from sf_t where k = 'b')), 1013333::bigint, 'the share is added to savings');
select is((select interest_available_centavos from public.sf_fund_summary()), 1::bigint, 'only the remainder stays in the fund');
select throws_like($$select public.sf_distribute_interest(public.sf_today(), array[(select id from sf_t where k = 'b'), (select id from sf_t where k = 'c'), (select id from sf_t where k = 'd')], null, null)$$,
  '%too little%', 'a fund too small to split three ways is refused');
select throws_like($$select public.sf_change_interest_part((select id from sf_t where k = 'f_p1'), 0, (select updated_at from public.sf_transactions where id = (select id from sf_t where k = 'f_p1')))$$,
  'The Interest fund only had%', 'interest that was already distributed cannot be moved back to savings');
select throws_like($$select public.sf_void_transaction((select id from sf_t where k = 'b_p2'), 'wrong entry', (select updated_at from public.sf_transactions where id = (select id from sf_t where k = 'b_p2')))$$,
  'The Interest fund only had%', 'a payment whose interest was distributed cannot be voided');
select throws_ok($$select public.sf_void_transaction((select id from public.sf_transactions where distribution_id = (select id from sf_t where k = 'dist1') order by id limit 1), 'wrong entry',
  (select updated_at from public.sf_transactions where distribution_id = (select id from sf_t where k = 'dist1') order by id limit 1))$$,
  'P0001', 'An interest share is voided with its distribution. Void the distribution instead.', 'a share cannot be voided alone');
insert into sf_t select 'b_sw', public.sf_record_savings_withdrawal((select id from sf_t where k = 'b'), public.sf_today(), 1013333, null, null);
select throws_like($$select public.sf_void_distribution((select id from sf_t where k = 'dist1'), 'wrong year', (select updated_at from public.sf_distributions where id = (select id from sf_t where k = 'dist1')))$$,
  'Ben only had%', 'a distribution cannot be voided if a participant already took the money out');
select lives_ok($$select public.sf_void_transaction((select id from sf_t where k = 'b_sw'), 'entered twice', (select updated_at from public.sf_transactions where id = (select id from sf_t where k = 'b_sw')))$$,
  'a savings withdrawal can be voided and the savings return');
select lives_ok($$select public.sf_void_distribution((select id from sf_t where k = 'dist1'), 'wrong year', (select updated_at from public.sf_distributions where id = (select id from sf_t where k = 'dist1')))$$,
  'the distribution can be voided as a whole');
select is((select count(*)::int from public.sf_transactions where distribution_id = (select id from sf_t where k = 'dist1') and voided_at is not null), 3, 'all of its shares are voided together');
select is((select interest_available_centavos from public.sf_fund_summary()), 40000::bigint, 'the Interest fund is back to ₱400');
select is(public.sf_savings_at((select id from sf_t where k = 'b')), 1000000::bigint, 'Ben''s savings no longer include the share');

-- Voids -----------------------------------------------------------------------------------------------------------------------------
select throws_like($$select public.sf_void_transaction((select id from sf_t where k = 'd_dep'), 'wrong entry', (select updated_at from public.sf_transactions where id = (select id from sf_t where k = 'd_dep')))$$,
  'Dee only had%', 'a deposit that a later loan depends on cannot be voided');
select throws_ok($$select public.sf_void_transaction((select id from sf_t where k = 'c_dep2'), 'xx', (select updated_at from public.sf_transactions where id = (select id from sf_t where k = 'c_dep2')))$$,
  'P0001', 'Give a reason of 3 to 300 characters.', 'a void needs a reason');
select throws_ok($$select public.sf_void_transaction((select id from sf_t where k = 'c_dep2'), 'wrong entry', '2000-01-01 00:00+00')$$, '40001', null, 'a stale void is refused');
select ok((select count(*) from public.audit_events where entity_type = 'sf_transactions' and action = 'reverse') >= 2, 'voids are audited with their reason');

-- Owner-only checks (staff) -------------------------------------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000420002","role":"authenticated"}', true);
select lives_ok($$select public.sf_record_deposit((select id from sf_t where k = 'b'), public.sf_today(), 100, null, null)$$, 'staff can record a deposit');
select lives_ok($$select public.sf_add_participant('Gus', null, null)$$, 'staff can add a participant');
select throws_ok($$select public.sf_record_savings_withdrawal((select id from sf_t where k = 'b'), public.sf_today(), 100, null, null)$$, '42501', null, 'staff cannot record a savings withdrawal');
select throws_ok($$select public.sf_mark_loan_withdrawal((select id from sf_t where k = 'c_loan'), 84000)$$, '42501', null, 'staff cannot close a loan');
select throws_ok($$select public.sf_distribute_interest(public.sf_today(), array[(select id from sf_t where k = 'b')], null, null)$$, '42501', null, 'staff cannot distribute');
select throws_ok($$select public.sf_set_default_prefill('last')$$, '42501', null, 'staff cannot change Fund settings');
select throws_ok($$select public.sf_void_transaction((select id from sf_t where k = 'c_dep2'), 'wrong entry', (select updated_at from public.sf_transactions where id = (select id from sf_t where k = 'c_dep2')))$$, '42501', null, 'staff cannot void');
select throws_ok($$select public.sf_archive_participant((select id from sf_t where k = 'c'), now())$$, '42501', null, 'staff cannot archive');
select throws_ok($$select public.sf_change_interest_part((select id from sf_t where k = 'f_p1'), 0, now())$$, '42501', null, 'staff cannot change an interest part');

select * from finish();
rollback;
