begin;
select no_plan();

-- Feature 016 (20261114000200): the saved ended totals of a distribution (sf_distribution_participants) and the
-- distribution history and details are owner only. Signed-out visitors, users waiting for approval, and approved
-- staff get nothing; nobody can write the table directly.

insert into auth.users (id, email, aud, role)
values
  ('00000000-0000-0000-0000-000000110001', 'sf-dist-rls-owner@rolnet.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000110002', 'sf-dist-rls-staff@rolnet.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000110003', 'sf-dist-rls-pending@rolnet.test', 'authenticated', 'authenticated');
update public.profiles
set role = 'owner', account_status = 'approved', approved_at = now(), approved_by = user_id
where user_id = '00000000-0000-0000-0000-000000110001';
update public.profiles
set account_status = 'approved', approved_at = now(), approved_by = '00000000-0000-0000-0000-000000110001'
where user_id = '00000000-0000-0000-0000-000000110002';

insert into public.sf_participants (id, name) values ('00000000-0000-0000-0000-000000110101', 'Dist RLS Person');
insert into public.sf_distributions (id, dist_date, available_before_centavos, per_participant_centavos, participant_count, total_distributed_centavos, remainder_centavos)
values ('00000000-0000-0000-0000-000000110201', '2026-01-05', 1000, null, 1, 1000, 0);
insert into public.sf_distribution_participants (id, distribution_id, participant_id, participant_name, savings_before_centavos, share_centavos, ended_total_centavos)
values ('00000000-0000-0000-0000-000000110301', '00000000-0000-0000-0000-000000110201', '00000000-0000-0000-0000-000000110101', 'Dist RLS Person', 5000, 1000, 6000);

-- Signed out ---------------------------------------------------------------------------------------------------------------
set local role anon;
select throws_ok($$select count(*) from public.sf_distribution_participants$$, '42501', null, 'anon cannot read the saved totals');
select throws_ok($$select * from public.sf_distribution_history()$$, '42501', null, 'anon cannot read the history');
select throws_ok($$select * from public.sf_distribution_details('00000000-0000-0000-0000-000000110201')$$, '42501', null, 'anon cannot read the details');
reset role;

-- Signed in but not approved -------------------------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000110003","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.sf_distribution_participants), 0, 'a user waiting for approval sees no saved totals');
select throws_ok($$select * from public.sf_distribution_history()$$, '42501', null, 'a user waiting for approval cannot read the history');
reset role;

-- Approved staff ---------------------------------------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000110002","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.sf_distribution_participants), 0, 'staff see no saved totals');
select throws_ok($$select * from public.sf_distribution_history()$$, '42501', null, 'staff cannot read the history');
select throws_ok($$select * from public.sf_distribution_details('00000000-0000-0000-0000-000000110201')$$, '42501', null, 'staff cannot read the details');
select throws_ok($$update public.sf_distribution_participants set share_centavos = 1$$, '42501', null, 'staff cannot change saved totals');
select throws_ok($$delete from public.sf_distribution_participants$$, '42501', null, 'staff cannot delete saved totals');
reset role;

-- Owner ---------------------------------------------------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000110001","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.sf_distribution_participants), 1, 'the owner reads the saved totals');
select is((select count(*)::int from public.sf_distribution_history() where id = '00000000-0000-0000-0000-000000110201'), 1, 'the owner reads the history');
select is((select ended_total_centavos from public.sf_distribution_details('00000000-0000-0000-0000-000000110201')), 6000::bigint, 'the owner reads the details');
select throws_ok($$update public.sf_distribution_participants set share_centavos = 1$$, '42501', null, 'even the owner cannot change saved totals directly');
select throws_ok($$insert into public.sf_distribution_participants (distribution_id, participant_id, participant_name, savings_before_centavos, share_centavos, ended_total_centavos)
  values ('00000000-0000-0000-0000-000000110201', '00000000-0000-0000-0000-000000110101', 'X', 1, 1, 2)$$, '42501', null, 'even the owner cannot write saved totals directly');
reset role;

select * from finish();
rollback;
