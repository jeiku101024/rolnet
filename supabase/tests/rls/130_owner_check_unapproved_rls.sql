begin;
select plan(8);

-- Fixture users. handle_new_user() creates a pending staff profile for each.
insert into auth.users (id, email, aud, role)
values
  ('00000000-0000-0000-0000-0000000000a1', 'owner-check-owner@rolnet.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000a2', 'owner-check-pending@rolnet.test', 'authenticated', 'authenticated');

update public.profiles
set role = 'owner', account_status = 'approved', approved_at = now(), approved_by = user_id
where user_id = '00000000-0000-0000-0000-0000000000a1';

-- Pending (unapproved) user.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
set local role authenticated;
select is(public.is_owner(), false, 'is_owner() is false, not NULL, for a pending user');
select throws_ok($$select public.require_owner()$$, '42501', null, 'require_owner() denies a pending user');
select throws_ok($$select public.approve_staff_registration('00000000-0000-0000-0000-0000000000a2')$$, '42501', null, 'a pending user cannot approve their own registration');
select throws_ok($$select public.reverse_remittance(gen_random_uuid(), 'test')$$, '42501', null, 'a pending user cannot reverse remittances');
reset role;

-- Signed-in user with no profile at all.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000ff","role":"authenticated"}', true);
set local role authenticated;
select is(public.is_owner(), false, 'is_owner() is false for a user without a profile');
select throws_ok($$select public.require_owner()$$, '42501', null, 'require_owner() denies a user without a profile');
reset role;

-- Approved owner.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$select public.require_owner()$$, 'require_owner() allows the approved owner');
select lives_ok($$select public.approve_staff_registration('00000000-0000-0000-0000-0000000000a2')$$, 'the owner can approve a pending registration');
reset role;

select finish();
rollback;
