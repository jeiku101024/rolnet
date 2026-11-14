begin;
select no_plan();

-- Feature 015 (20261113000100/200/300): the Sinking fund tables are readable only by approved users and
-- writable only through the functions. Signed-out visitors and users still waiting for approval get nothing;
-- helper functions are not callable by app roles.

insert into auth.users (id, email, aud, role)
values
  ('00000000-0000-0000-0000-000000100001', 'sf-rls-staff@rolnet.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000100002', 'sf-rls-pending@rolnet.test', 'authenticated', 'authenticated');
update public.profiles
set account_status = 'approved', approved_at = now(), approved_by = user_id
where user_id = '00000000-0000-0000-0000-000000100001';

insert into public.sf_participants (id, name) values ('00000000-0000-0000-0000-000000100101', 'RLS Person');
insert into public.sf_transactions (id, participant_id, type, amount_centavos, tx_date)
values ('00000000-0000-0000-0000-000000100201', '00000000-0000-0000-0000-000000100101', 'deposit', 5000, '2026-01-05');

-- Grants as catalogs report them ---------------------------------------------------------------------------------
select ok(has_function_privilege('authenticated', 'public.sf_record_deposit(uuid, date, bigint, text, uuid)', 'execute'), 'authenticated can record a deposit');
select ok(has_function_privilege('authenticated', 'public.sf_distribute_interest(date, uuid[], text, uuid, bigint)', 'execute'), 'authenticated can call distribute (the function checks the owner)');
select ok(has_function_privilege('authenticated', 'public.sf_fund_summary(date, date)', 'execute'), 'authenticated can read the fund summary');
select ok(has_function_privilege('authenticated', 'public.sf_allowed_interest_range(uuid, bigint, uuid)', 'execute'), 'authenticated can read the allowed interest range');
select ok(not has_function_privilege('authenticated', 'public.sf_savings_total(uuid, date)', 'execute'), 'authenticated cannot call the savings helper');
select ok(not has_function_privilege('authenticated', 'public.sf_fund_total(date)', 'execute'), 'authenticated cannot call the fund helper');
select ok(not has_function_privilege('authenticated', 'public.sf_assert_fund_timeline()', 'execute'), 'authenticated cannot call a validator');
select ok(not has_function_privilege('authenticated', 'public.sf_lock()', 'execute'), 'authenticated cannot take the lock');
select ok(not has_function_privilege('authenticated', 'public.sf_allowed_interest(uuid, bigint, uuid)', 'execute'), 'authenticated cannot call the unchecked allowed-interest helper');
select ok(not has_function_privilege('anon', 'public.sf_record_deposit(uuid, date, bigint, text, uuid)', 'execute'), 'anon cannot record a deposit');
select ok(not has_function_privilege('anon', 'public.sf_fund_summary(date, date)', 'execute'), 'anon cannot read the fund summary');

-- Signed out ------------------------------------------------------------------------------------------------------------
set local role anon;
select throws_ok($$select count(*) from public.sf_participants$$, '42501', null, 'anon cannot read participants');
select throws_ok($$select count(*) from public.sf_ledger_v$$, '42501', null, 'anon cannot read the ledger view');
select throws_ok($$select public.sf_record_deposit('00000000-0000-0000-0000-000000100101', current_date, 100, null, null)$$, '42501', null, 'anon cannot call a write function');
reset role;

-- Signed in but not approved -----------------------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000100002","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.sf_participants), 0, 'a user waiting for approval sees no participants');
select is((select count(*)::int from public.sf_transactions), 0, 'a user waiting for approval sees no ledger rows');
select throws_ok($$select * from public.sf_fund_summary()$$, '42501', null, 'a user waiting for approval cannot read the summary');
select throws_ok($$select public.sf_record_deposit('00000000-0000-0000-0000-000000100101', public.sf_today(), 100, null, null)$$, '42501', null, 'a user waiting for approval cannot record');
reset role;

-- Approved staff: read yes, direct writes no -----------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000100001","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.sf_participants where id = '00000000-0000-0000-0000-000000100101'), 1, 'approved staff can read participants');
select is((select count(*)::int from public.sf_ledger_v where id = '00000000-0000-0000-0000-000000100201'), 1, 'approved staff can read the ledger view');
select throws_ok($$insert into public.sf_participants (name) values ('Direct Write')$$, '42501', null, 'staff cannot insert participants directly');
select throws_ok($$insert into public.sf_transactions (participant_id, type, amount_centavos, tx_date) values ('00000000-0000-0000-0000-000000100101', 'deposit', 100, '2026-01-06')$$, '42501', null, 'staff cannot insert ledger rows directly');
select throws_ok($$update public.sf_transactions set amount_centavos = 1 where id = '00000000-0000-0000-0000-000000100201'$$, '42501', null, 'staff cannot update ledger rows directly');
select throws_ok($$delete from public.sf_transactions where id = '00000000-0000-0000-0000-000000100201'$$, '42501', null, 'staff cannot delete ledger rows');
select throws_ok($$update public.sf_settings set default_interest_prefill = 'last'$$, '42501', null, 'staff cannot change settings directly');
select throws_ok($$select public.sf_assert_fund_timeline()$$, '42501', null, 'staff cannot call a validator');
select lives_ok($$select public.sf_record_deposit('00000000-0000-0000-0000-000000100101', public.sf_today(), 100, null, null)$$, 'staff can record a deposit through the function');
reset role;

select * from finish();
rollback;
