begin;
select plan(14);

-- Feature 012 (FR-050): owner and staff manage absences and switch roles; staff still can't edit
-- driver records directly; unapproved users and anon get nothing.

insert into auth.users (id, email, aud, role)
values
  ('00000000-0000-0000-0000-000000230001', 'absr-owner@rolnet.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000230002', 'absr-staff@rolnet.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000230003', 'absr-pending@rolnet.test', 'authenticated', 'authenticated');
update public.profiles
set role = 'owner', account_status = 'approved', approved_at = now(), approved_by = user_id
where user_id = '00000000-0000-0000-0000-000000230001';
update public.profiles
set account_status = 'approved', approved_at = now(), approved_by = '00000000-0000-0000-0000-000000230001'
where user_id = '00000000-0000-0000-0000-000000230002';

insert into public.drivers (id, full_name, license_number, license_expiry_date, phone)
values ('00000000-0000-0000-0000-000000230201', 'RLS Absence Driver', 'ABSR-230-L1', '2035-12-31', '09170000230');

-- Approved staff
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000230002","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$select public.save_driver_absence(null, '00000000-0000-0000-0000-000000230201', 'day_off', '2031-06-01', null, 'sick', null, '{}', null)$$,
  'staff can schedule an absence');
select is((select count(*)::int from public.driver_absences where driver_id = '00000000-0000-0000-0000-000000230201'), 1, 'staff can read absences');
select lives_ok($$select public.cancel_driver_absence(
  (select id from public.driver_absences where driver_id = '00000000-0000-0000-0000-000000230201'),
  (select updated_at from public.driver_absences where driver_id = '00000000-0000-0000-0000-000000230201'))$$,
  'staff can cancel an absence');
select lives_ok($$select public.save_driver_absence(null, '00000000-0000-0000-0000-000000230201', 'on_leave', (now() at time zone 'Asia/Manila')::date - 15, null, 'vacation', null, '{}', null);
  select public.confirm_driver_leave((select id from public.driver_absences where driver_id = '00000000-0000-0000-0000-000000230201' and end_date is null))$$,
  'staff can schedule an open-ended leave and mark it as still on leave');
select is((select count(*)::int from public.driver_absence_confirmations), 1, 'staff can read leave confirmations');
select lives_ok($$select public.end_driver_absence(
  (select id from public.driver_absences where driver_id = '00000000-0000-0000-0000-000000230201' and end_date is null),
  (select updated_at from public.driver_absences where driver_id = '00000000-0000-0000-0000-000000230201' and end_date is null))$$,
  'staff can end a leave early');
select lives_ok($$select public.set_driver_role('00000000-0000-0000-0000-000000230201', 'backup', (select updated_at from public.drivers where id = '00000000-0000-0000-0000-000000230201'));
  select public.undo_driver_role_change((select id from public.driver_role_changes where driver_id = '00000000-0000-0000-0000-000000230201'))$$,
  'staff can switch a role and undo it');
update public.drivers set full_name = 'Staff rename', driver_kind = 'backup' where id = '00000000-0000-0000-0000-000000230201';
select is((select full_name || '/' || driver_kind from public.drivers where id = '00000000-0000-0000-0000-000000230201'),
  'RLS Absence Driver/primary', 'staff still cannot update driver records directly');

-- Unapproved user
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000230003","role":"authenticated"}', true);
select is((select count(*)::int from public.driver_absences), 0, 'a pending user reads no absences');
select is((select count(*)::int from public.driver_role_changes), 0, 'a pending user reads no role history');
select throws_ok($$select public.save_driver_absence(null, '00000000-0000-0000-0000-000000230201', 'day_off', '2031-07-01', null, 'sick', null, '{}', null)$$,
  '42501', null, 'a pending user cannot schedule an absence');
select throws_ok($$select public.set_driver_role('00000000-0000-0000-0000-000000230201', 'backup', now())$$,
  '42501', null, 'a pending user cannot switch a role');

-- Anon
reset role;
set local role anon;
select throws_ok($$select count(*) from public.driver_absences$$, '42501', null, 'anon cannot read absences');
select throws_ok($$select count(*) from public.driver_role_changes$$, '42501', null, 'anon cannot read role history');

select * from finish();
rollback;
