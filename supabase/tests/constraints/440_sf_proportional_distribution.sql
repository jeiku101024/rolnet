begin;
select no_plan();

-- Feature 016 (20261114000200_sf_proportional_distribution.sql): the Interest fund is shared in proportion to
-- savings, a distribution closes the year (ended totals saved, savings back to zero), it is refused while a ticked
-- participant has an unpaid loan, and the guards keep the saved ended totals true. Dates are relative to sf_today().
-- (select id from sf_t where k = 'k') expands to the id saved under that key in the temp table sf_t.

insert into auth.users (id, email, aud, role)
values
  ('00000000-0000-0000-0000-000000440001', 'sf-prop-owner@rolnet.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000440002', 'sf-prop-staff@rolnet.test', 'authenticated', 'authenticated');
update public.profiles
set role = 'owner', account_status = 'approved', approved_at = now(), approved_by = user_id
where user_id = '00000000-0000-0000-0000-000000440001';
update public.profiles
set account_status = 'approved', approved_at = now(), approved_by = '00000000-0000-0000-0000-000000440001'
where user_id = '00000000-0000-0000-0000-000000440002';

-- A distribution made before the year-end close: equal shares, no saved ended totals (a voided one keeps the fund figures clean).
insert into public.sf_participants (id, name) values ('00000000-0000-0000-0000-000000440101', 'Old Timer');
insert into public.sf_distributions (id, dist_date, available_before_centavos, per_participant_centavos, participant_count, total_distributed_centavos, remainder_centavos, voided_at, void_reason)
values ('00000000-0000-0000-0000-000000440201', '2020-12-31', 1000, 1000, 1, 1000, 0, now(), 'legacy test row');
insert into public.sf_transactions (participant_id, type, amount_centavos, tx_date, distribution_id, voided_at, void_reason)
values ('00000000-0000-0000-0000-000000440101', 'interest_share', 1000, '2020-12-31', '00000000-0000-0000-0000-000000440201', now(), 'legacy test row');

create temp table sf_t (k text primary key, id uuid);
grant all on sf_t to authenticated;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000440001","role":"authenticated"}', true);

-- Participants and savings -----------------------------------------------------------------------------------------
insert into sf_t select 'p1', public.sf_add_participant('P1', null, null);
insert into sf_t select 'p2', public.sf_add_participant('P2', null, null);
insert into sf_t select 'p3', public.sf_add_participant('P3', null, null);
insert into sf_t select 'p4', public.sf_add_participant('P4', null, null);   -- no savings
insert into sf_t select 'p5', public.sf_add_participant('P5', null, null);   -- has an open loan
insert into sf_t select 'p6', public.sf_add_participant('P6', null, null);   -- paid loan, supplies the interest
insert into sf_t select 'p1_dep', public.sf_record_deposit((select id from sf_t where k = 'p1'), public.sf_today() - 20, 100000, null, null);
insert into sf_t select 'p2_dep', public.sf_record_deposit((select id from sf_t where k = 'p2'), public.sf_today() - 20, 200000, null, null);
insert into sf_t select 'p3_dep', public.sf_record_deposit((select id from sf_t where k = 'p3'), public.sf_today() - 20, 300000, null, null);
insert into sf_t select 'p5_dep', public.sf_record_deposit((select id from sf_t where k = 'p5'), public.sf_today() - 20, 100000, null, null);
insert into sf_t select 'p5_loan', public.sf_record_loan((select id from sf_t where k = 'p5'), public.sf_today() - 10, 50000, null, null);
insert into sf_t select 'p6_dep', public.sf_record_deposit((select id from sf_t where k = 'p6'), public.sf_today() - 40, 1000000, null, null);
insert into sf_t select 'p6_loan', public.sf_record_loan((select id from sf_t where k = 'p6'), public.sf_today() - 35, 600000, null, null);
insert into sf_t select 'p6_pay', public.sf_record_payment((select id from sf_t where k = 'p6_loan'), public.sf_today() - 30, 630000, null, null, null);
select is((select interest_available_centavos from public.sf_fund_summary()), 30000::bigint, 'setup: the Interest fund holds ₱300.00');

-- Refusals before anything is written ------------------------------------------------------------------------------
select throws_like($$select public.sf_distribute_interest(public.sf_today() - 1, array[(select id from sf_t where k = 'p1'), (select id from sf_t where k = 'p5')], null, null)$$,
  'P5 still has an unpaid loan. Pay it or mark it as a withdrawal first.', 'a ticked participant with an open loan blocks the distribution');
select throws_like($$select public.sf_distribute_interest(public.sf_today() - 25, array[(select id from sf_t where k = 'p1')], null, null)$$,
  'The distribution date cannot be before%P1 last had activity.', 'the date cannot be earlier than a ticked participant''s last activity');
select throws_ok($$select public.sf_distribute_interest(public.sf_today() - 1, array[]::uuid[], null, null)$$, 'P0001', 'Tick at least one participant.', 'nothing ticked is refused');
select throws_ok($$select public.sf_distribute_interest(public.sf_today() - 1, array[(select id from sf_t where k = 'p4')], null, null)$$, 'P0001', 'No ticked participant has savings.', 'ticked participants without savings are refused');
select throws_ok($$select public.sf_distribute_interest(public.sf_today() - 1, array[(select id from sf_t where k = 'p1'), (select id from sf_t where k = 'p2'), (select id from sf_t where k = 'p3')], null, null, 29999)$$,
  'P0001', 'The figures changed. Review them and confirm again.', 'a total that differs from what the owner saw is refused');
select is((select count(*)::int from public.sf_distributions where voided_at is null), 0, 'a refused distribution writes nothing');

-- A: ₱300.00 shared by savings of ₱1,000 / ₱2,000 / ₱3,000 (P4 has none) -----------------------------------------------
insert into sf_t select 'dist_a', public.sf_distribute_interest(public.sf_today() - 1,
  array[(select id from sf_t where k = 'p1'), (select id from sf_t where k = 'p2'), (select id from sf_t where k = 'p3'), (select id from sf_t where k = 'p4')],
  '2026 year-end', '00000000-0000-0000-0000-000000440901', 30000);
select is((select array_agg(share_centavos order by participant_name) from public.sf_distribution_participants where distribution_id = (select id from sf_t where k = 'dist_a')),
  array[5000, 10000, 15000, 0]::bigint[], 'A: the shares follow savings: ₱50.00, ₱100.00, ₱150.00, and none for P4');
select is((select array_agg(ended_total_centavos order by participant_name) from public.sf_distribution_participants where distribution_id = (select id from sf_t where k = 'dist_a')),
  array[105000, 210000, 315000, 0]::bigint[], 'A: the ended totals (savings plus share) are saved');
select is((select array[available_before_centavos, total_distributed_centavos, remainder_centavos, participant_count::bigint] from public.sf_distributions where id = (select id from sf_t where k = 'dist_a')),
  array[30000, 30000, 0, 4]::bigint[], 'A: the whole fund is shared and nothing is left');
select is((select per_participant_centavos from public.sf_distributions where id = (select id from sf_t where k = 'dist_a')), null::bigint, 'A: there is no equal per-participant amount');
select is((select count(*)::int from public.sf_transactions where distribution_id = (select id from sf_t where k = 'dist_a') and type = 'interest_share'), 3, 'A: no interest share for the participant with no share');
select is((select count(*)::int from public.sf_transactions where distribution_id = (select id from sf_t where k = 'dist_a') and type = 'cycle_close'), 3, 'A: no year-end close row for the participant with nothing to close');
select is((select array_agg(public.sf_savings_at(id) order by k) from sf_t where k in ('p1', 'p2', 'p3', 'p4')), array[0, 0, 0, 0]::bigint[], 'A: every ticked participant is back to ₱0.00');
select is((select array[public.sf_savings_at((select id from sf_t where k = 'p5')), public.sf_savings_at((select id from sf_t where k = 'p6'))]), array[50000, 1000000]::bigint[], 'A: unticked participants are unchanged');
select is((select interest_available_centavos from public.sf_fund_summary()), 0::bigint, 'A: the fund is empty');
select is((select array[payments_received_centavos, interest_collected_centavos] from public.sf_fund_summary()), array[0, 0]::bigint[], 'A: payments received and interest collected start again after the close');
select is((select cycle_start from public.sf_fund_summary()), public.sf_today() - 1, 'A: the cycle starts at the close date');
select is((select amount_centavos from public.sf_ranking('deposits') where name = 'P1'), 0::bigint, 'A: the deposits ranking counts the new cycle');
select is((select array[total_distributed_centavos, remainder_centavos, participant_count::bigint, share_count::bigint, year::bigint] from public.sf_distribution_history() where id = (select id from sf_t where k = 'dist_a')),
  array[30000, 0, 4, 3, extract(year from public.sf_today() - 1)::bigint]::bigint[], 'A: the history lists the year, who took part, and who received a share');
select is((select array_agg(participant_name) from public.sf_distribution_details((select id from sf_t where k = 'dist_a'))), array['P3', 'P2', 'P1', 'P4'], 'A: the details are sorted from the highest ended total to the lowest');
select is((select sum(ended_total_centavos)::bigint from public.sf_distribution_details((select id from sf_t where k = 'dist_a'))), 630000::bigint, 'A: the Sinking fund total for the year is the sum of the ended totals');
select is(public.sf_distribute_interest(public.sf_today() - 1, array[(select id from sf_t where k = 'p1')], null, '00000000-0000-0000-0000-000000440901'), (select id from sf_t where k = 'dist_a'),
  'A: the same key returns the same distribution');
select is((select count(*)::int from public.sf_distributions where voided_at is null), 1, 'A: a retry stores one distribution');
select ok((select count(*) from public.audit_events where entity_type = 'sf_distributions' and entity_id = (select id from sf_t where k = 'dist_a')) >= 1, 'A: the distribution is audited');
select lives_ok($$select public.sf_void_distribution((select id from sf_t where k = 'dist_a'), 'testing', (select updated_at from public.sf_distributions where id = (select id from sf_t where k = 'dist_a')))$$,
  'A: it can be voided while nothing new was recorded');
select is((select array_agg(public.sf_savings_at(id) order by k) from sf_t where k in ('p1', 'p2', 'p3')), array[100000, 200000, 300000]::bigint[], 'A: voiding restores everyone''s savings');
select is((select count(*)::int from public.sf_transactions where distribution_id = (select id from sf_t where k = 'dist_a') and voided_at is not null), 6, 'A: the shares and the closes are voided together');
select is((select interest_available_centavos from public.sf_fund_summary()), 30000::bigint, 'A: the fund is back to ₱300.00');

-- B: floor to the centavo, leftover stays in the fund --------------------------------------------------------------------
insert into sf_t select 'p1_cent', public.sf_record_deposit((select id from sf_t where k = 'p1'), public.sf_today(), 1, null, null);
insert into sf_t select 'dist_b', public.sf_distribute_interest(public.sf_today(),
  array[(select id from sf_t where k = 'p1'), (select id from sf_t where k = 'p2'), (select id from sf_t where k = 'p3')], null, null, 29998);
select is((select array_agg(share_centavos order by participant_name) from public.sf_distribution_participants where distribution_id = (select id from sf_t where k = 'dist_b')),
  array[5000, 9999, 14999]::bigint[], 'B: each share is rounded down to the centavo');
select is((select array[total_distributed_centavos, remainder_centavos] from public.sf_distributions where id = (select id from sf_t where k = 'dist_b')), array[29998, 2]::bigint[], 'B: ₱0.02 stays in the fund');
select is((select total_distributed_centavos + remainder_centavos from public.sf_distributions where id = (select id from sf_t where k = 'dist_b')), 30000::bigint, 'B: shares plus the leftover equal the fund');
select is((select interest_available_centavos from public.sf_fund_summary()), 2::bigint, 'B: only the leftover stays');
select lives_ok($$select public.sf_void_distribution((select id from sf_t where k = 'dist_b'), 'testing', (select updated_at from public.sf_distributions where id = (select id from sf_t where k = 'dist_b')))$$, 'B: voided');

-- C: a participant with a paid loan takes part; guards keep the saved ended total true ----------------------------------
insert into sf_t select 'dist_c', public.sf_distribute_interest(public.sf_today() - 1, array[(select id from sf_t where k = 'p6')], null, null);
select is((select array[savings_before_centavos, share_centavos, ended_total_centavos] from public.sf_distribution_participants where distribution_id = (select id from sf_t where k = 'dist_c')),
  array[1000000, 30000, 1030000]::bigint[], 'C: a participant whose loan is paid can be closed and gets the whole fund');
select throws_like($$select public.sf_record_deposit((select id from sf_t where k = 'p6'), public.sf_today() - 1, 100, null, null)$$,
  'P6''s year was closed on%Use a later date.', 'C: nothing can be dated on the close date');
select throws_like($$select public.sf_record_loan((select id from sf_t where k = 'p6'), public.sf_today() - 3, 10000, null, null)$$,
  'P6''s year was closed on%Use a later date.', 'C: nothing can be dated before the close either');
select throws_like($$select public.sf_void_transaction((select id from sf_t where k = 'p6_pay'), 'wrong entry', (select updated_at from public.sf_transactions where id = (select id from sf_t where k = 'p6_pay')))$$,
  'P6''s year was closed on%Void the distribution first.', 'C: a transaction dated before the close cannot be voided');
select throws_ok($$select public.sf_void_transaction((select id from public.sf_transactions where distribution_id = (select id from sf_t where k = 'dist_c') and type = 'cycle_close'), 'wrong entry',
  (select updated_at from public.sf_transactions where distribution_id = (select id from sf_t where k = 'dist_c') and type = 'cycle_close'))$$,
  'P0001', 'A year-end close is voided with its distribution. Void the distribution instead.', 'C: a year-end close cannot be voided alone');
select throws_ok($$select public.sf_void_transaction((select id from public.sf_transactions where distribution_id = (select id from sf_t where k = 'dist_c') and type = 'interest_share'), 'wrong entry',
  (select updated_at from public.sf_transactions where distribution_id = (select id from sf_t where k = 'dist_c') and type = 'interest_share'))$$,
  'P0001', 'An interest share is voided with its distribution. Void the distribution instead.', 'C: an interest share cannot be voided alone');
insert into sf_t select 'p6_after', public.sf_record_deposit((select id from sf_t where k = 'p6'), public.sf_today(), 5000, null, null);
select is(public.sf_savings_at((select id from sf_t where k = 'p6')), 5000::bigint, 'C: a deposit after the close starts the new cycle');
select throws_like($$select public.sf_void_distribution((select id from sf_t where k = 'dist_c'), 'wrong year', (select updated_at from public.sf_distributions where id = (select id from sf_t where k = 'dist_c')))$$,
  'This distribution cannot be voided because P6 has new transactions since it.', 'C: a distribution cannot be voided once a participant has new activity');
select lives_ok($$select public.sf_void_transaction((select id from sf_t where k = 'p6_after'), 'entered twice', (select updated_at from public.sf_transactions where id = (select id from sf_t where k = 'p6_after')))$$,
  'C: a transaction after the close can be voided');
select lives_ok($$select public.sf_void_distribution((select id from sf_t where k = 'dist_c'), 'wrong year', (select updated_at from public.sf_distributions where id = (select id from sf_t where k = 'dist_c')))$$,
  'C: the distribution can then be voided');
select is(public.sf_savings_at((select id from sf_t where k = 'p6')), 1000000::bigint, 'C: P6''s savings are back after the void');
select lives_ok($$select public.sf_record_deposit((select id from sf_t where k = 'p6'), public.sf_today() - 1, 100, null, null)$$, 'C: dates before a voided close are open again');

-- A distribution from before the year-end close ---------------------------------------------------------------------------
select is((select array[participant_count::bigint, share_count::bigint, per_participant_centavos] from public.sf_distribution_history() where id = '00000000-0000-0000-0000-000000440201'),
  array[1, 1, 1000]::bigint[], 'legacy: the history lists it with its equal share');
select is((select array[share_centavos, ended_total_centavos] from public.sf_distribution_details('00000000-0000-0000-0000-000000440201')), array[1000, null]::bigint[], 'legacy: the details show the share and no ended total');
select is((select cycle_start from public.sf_fund_summary()), null::date, 'legacy: an older equal-share distribution does not start a cycle');

-- Staff and anon -------------------------------------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000440002","role":"authenticated"}', true);
select throws_ok($$select public.sf_distribute_interest(public.sf_today() - 1, array[(select id from sf_t where k = 'p6')], null, null)$$, '42501', null, 'staff cannot distribute');
select throws_ok($$select * from public.sf_distribution_history()$$, '42501', null, 'staff cannot read the distribution history');
select throws_ok($$select * from public.sf_distribution_details('00000000-0000-0000-0000-000000440201')$$, '42501', null, 'staff cannot read the distribution details');
select is((select count(*)::int from public.sf_distribution_participants), 0, 'staff see no saved ended totals');
select lives_ok($$select * from public.sf_fund_summary()$$, 'staff can still read the fund figures');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000440001","role":"authenticated"}', true);
select ok((select count(*) from public.sf_distribution_participants) > 0, 'the owner reads the saved ended totals');
select ok(not has_function_privilege('anon', 'public.sf_distribute_interest(date, uuid[], text, uuid, bigint)', 'execute'), 'anon cannot distribute');
select ok(not has_function_privilege('anon', 'public.sf_distribution_history()', 'execute'), 'anon cannot read the history');
select ok(not has_function_privilege('anon', 'public.sf_distribution_details(uuid)', 'execute'), 'anon cannot read the details');
select ok(not has_function_privilege('authenticated', 'public.sf_guard_closed_cycle()', 'execute'), 'authenticated cannot call the close guard');
select ok(not has_function_privilege('authenticated', 'public.sf_cycle_start()', 'execute'), 'authenticated cannot call the cycle helper');
select throws_ok($$insert into public.sf_distribution_participants (distribution_id, participant_id, participant_name, savings_before_centavos, share_centavos, ended_total_centavos)
  values ('00000000-0000-0000-0000-000000440201', '00000000-0000-0000-0000-000000440101', 'X', 1, 1, 2)$$, '42501', null, 'the saved totals cannot be written directly');

-- Table shape ---------------------------------------------------------------------------------------------------------------
reset role;
select has_column('public', 'sf_distribution_participants', 'updated_at', 'saved totals carry updated_at');
select has_column('public', 'sf_distribution_participants', 'deleted_at', 'saved totals carry deleted_at');
select has_column('public', 'sf_distribution_participants', 'created_by', 'saved totals carry the actor');
select throws_ok($$insert into public.sf_transactions (participant_id, type, amount_centavos, tx_date)
  values ('00000000-0000-0000-0000-000000440101', 'cycle_close', 100, '2026-01-01')$$, '23514', null, 'a year-end close must belong to a distribution (shape check)');
select throws_ok($$insert into public.sf_distribution_participants (distribution_id, participant_id, participant_name, savings_before_centavos, share_centavos, ended_total_centavos)
  values ('00000000-0000-0000-0000-000000440201', '00000000-0000-0000-0000-000000440101', 'X', 100, 50, 999)$$, '23514', null, 'the ended total must equal savings plus share');
select throws_ok($$insert into public.sf_distributions (dist_date, available_before_centavos, per_participant_centavos, participant_count, total_distributed_centavos, remainder_centavos)
  values ('2026-01-01', 100, null, 2, 60, 50)$$, '23514', null, 'the remainder must be the fund less what was distributed');
select lives_ok($$insert into public.sf_distributions (dist_date, available_before_centavos, per_participant_centavos, participant_count, total_distributed_centavos, remainder_centavos, voided_at, void_reason)
  values ('2026-01-01', 100, null, 2, 97, 3, now(), 'constraint check')$$, 'a proportional distribution may leave more than one centavo per participant');
select throws_ok($$delete from public.sf_distribution_participants$$, '23514', 'Business records must be soft-deleted', 'saved totals cannot be hard deleted');

select * from finish();
rollback;
