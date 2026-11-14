begin;
select no_plan();

-- Feature 015 (20261113000300_sinking_fund_reads.sql): fund totals, participant summaries, rankings
-- (savings as of a date, deposits in a range, archived participants left out), monthly flows, and the
-- distribution history. Dates are relative to sf_today().

insert into auth.users (id, email, aud, role)
values ('00000000-0000-0000-0000-000000430001', 'sf-reads-owner@rolnet.test', 'authenticated', 'authenticated');
update public.profiles
set role = 'owner', account_status = 'approved', approved_at = now(), approved_by = user_id
where user_id = '00000000-0000-0000-0000-000000430001';

create temp table sf_t (k text primary key, id uuid);
grant all on sf_t to authenticated;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000430001","role":"authenticated"}', true);

insert into sf_t select 'ann', public.sf_add_participant('Ann', null, null);
insert into sf_t select 'bo', public.sf_add_participant('Bo', null, null);
insert into sf_t select 'cid', public.sf_add_participant('Cid', null, null);

insert into sf_t select gen_random_uuid()::text, public.sf_record_deposit((select id from sf_t where k = 'ann'), public.sf_today() - 45, 100000, null, null);
insert into sf_t select gen_random_uuid()::text, public.sf_record_deposit((select id from sf_t where k = 'ann'), public.sf_today() - 5, 50000, null, null);
insert into sf_t select gen_random_uuid()::text, public.sf_record_deposit((select id from sf_t where k = 'bo'), public.sf_today(), 200000, null, null);
insert into sf_t select 'bo_loan', public.sf_record_loan((select id from sf_t where k = 'bo'), public.sf_today(), 100000, null, null);
insert into sf_t select gen_random_uuid()::text, public.sf_record_payment((select id from sf_t where k = 'bo_loan'), public.sf_today(), 20000, null, null, null);
insert into sf_t select gen_random_uuid()::text, public.sf_record_deposit((select id from sf_t where k = 'cid'), public.sf_today() - 2, 1000, null, null);
insert into sf_t select gen_random_uuid()::text, public.sf_record_savings_withdrawal((select id from sf_t where k = 'cid'), public.sf_today(), 1000, null, null);
insert into sf_t select gen_random_uuid()::text, public.sf_archive_participant((select id from sf_t where k = 'cid'), (select updated_at from public.sf_participants where id = (select id from sf_t where k = 'cid')));

select is((select array[total_savings_centavos, loans_outstanding_centavos, open_loan_count::bigint, balance_to_collect_centavos] from public.sf_fund_summary()),
  array[265000, 100000, 1, 85000]::bigint[], 'summary: total savings, loans outstanding with a count, balance to collect');
select is((select payments_received_centavos from public.sf_fund_summary()), 20000::bigint, 'summary: payments received, all time');
select is((select payments_received_centavos from public.sf_fund_summary(public.sf_today() - 30, public.sf_today() - 10)), 0::bigint, 'summary: payments received follows the date filter (none in range)');
select is((select payments_received_centavos from public.sf_fund_summary(public.sf_today() - 1, public.sf_today())), 20000::bigint, 'summary: payments received follows the date filter (in range)');
select is((select array[interest_collected_centavos, interest_distributed_centavos, interest_available_centavos, interest_expected_centavos, participant_count::bigint] from public.sf_fund_summary()),
  array[5000, 0, 5000, 0, 2]::bigint[], 'summary: Interest fund collected, distributed, available, expected, and active participant count');

select is((select count(*)::int from public.sf_participant_summaries()), 2, 'participant summaries leave archived participants out');
select is((select array[savings_centavos, loans_centavos, balance_to_pay_centavos] from public.sf_participant_summaries() where name = 'Bo'),
  array[115000, 100000, 85000]::bigint[], 'Bo''s card figures: savings, total loans, balance to pay');

select is((select array_agg(name order by amount_centavos desc, name) from public.sf_ranking('savings')), array['Ann', 'Bo'], 'ranking by savings, archived participants left out');
select is((select array_agg(amount_centavos order by name) from public.sf_ranking('savings', null, public.sf_today() - 30)), array[100000, 0]::bigint[],
  'ranking by savings uses savings at the end of the period');
select is((select array_agg(amount_centavos order by name) from public.sf_ranking('deposits', public.sf_today() - 10, public.sf_today())), array[50000, 200000]::bigint[],
  'ranking by deposits sums deposits in the range');
select is((select amount_centavos from public.sf_ranking('deposits') where name = 'Ann'), 150000::bigint, 'all-time deposits count every deposit');
select throws_ok($$select * from public.sf_ranking('loans')$$, 'P0001', 'Rank by savings or deposits.', 'only savings and deposits can be ranked');
select is(public.sf_savings_at((select id from sf_t where k = 'ann'), public.sf_today() - 30), 100000::bigint, 'savings as of a past date');

select is((select count(*)::int from public.sf_monthly_flows(6)), 6, 'six months of flows');
select is((select array[sum(deposits_centavos), sum(loans_centavos), sum(payments_centavos)] from public.sf_monthly_flows(6)), array[351000, 100000, 20000]::numeric[],
  'monthly flows add up to every deposit, loan, and payment (archived participants included)');

-- Bo still has an open loan, so Ann alone is ticked (feature 016): she gets the whole ₱50.00 and her year closes.
select throws_like($$select public.sf_distribute_interest(public.sf_today(), array[(select id from sf_t where k = 'ann'), (select id from sf_t where k = 'bo')], null, null)$$,
  '%Bo still has an unpaid loan%', 'a ticked participant with an open loan blocks the distribution');
insert into sf_t select gen_random_uuid()::text, public.sf_distribute_interest(public.sf_today(), array[(select id from sf_t where k = 'ann')], '2026 year-end', null);
select is((select array[count(*)::bigint, max(participant_count)::bigint, max(share_count)::bigint, max(total_distributed_centavos), max(year)::bigint] from public.sf_distribution_history()),
  array[1, 1, 1, 5000, extract(year from public.sf_today())::bigint]::bigint[], 'the distribution appears in the history with its year and share count');
select is((select interest_available_centavos from public.sf_fund_summary()), 0::bigint, 'the Interest fund is empty after the distribution');
select is((select savings_centavos from public.sf_participant_summaries() where name = 'Ann'), 0::bigint, 'the year-end close takes Ann''s savings back to zero');
select is((select ended_total_centavos from public.sf_distribution_details((select id from public.sf_distribution_history() limit 1))), 155000::bigint, 'the details show the ended total saved with the share');
select is((select array[payments_received_centavos, interest_collected_centavos] from public.sf_fund_summary()), array[0, 0]::bigint[], 'payments received and interest collected start again after the close');
select is((select cycle_start from public.sf_fund_summary()), public.sf_today(), 'the cycle starts at the close date');

select * from finish();
rollback;
