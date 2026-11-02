begin;
select plan(15);

-- Feature 012 (20261102000200_driver_role_history.sql, research R7): set_driver_role writes the role
-- and its history together, Inactive drivers can switch, Undo reverts and withdraws only the caller's
-- latest change within 60 seconds, and history can't be written directly.

insert into auth.users (id, email, aud, role)
values
  ('00000000-0000-0000-0000-000000360001', 'role-owner@rolnet.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000360002', 'role-staff@rolnet.test', 'authenticated', 'authenticated');
update public.profiles
set role = 'owner', account_status = 'approved', approved_at = now(), approved_by = user_id
where user_id = '00000000-0000-0000-0000-000000360001';
update public.profiles
set account_status = 'approved', approved_at = now(), approved_by = '00000000-0000-0000-0000-000000360001'
where user_id = '00000000-0000-0000-0000-000000360002';

insert into public.drivers (id, full_name, driver_kind, license_number, license_expiry_date, phone, is_active)
values
  ('00000000-0000-0000-0000-000000360201', 'Role Driver Active', 'primary', 'ROLE-360-L1', '2035-12-31', '09170000360', true),
  ('00000000-0000-0000-0000-000000360202', 'Role Driver Inactive', 'primary', 'ROLE-360-L2', '2035-12-31', '09170000361', false);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000360001","role":"authenticated"}', true);
set local role authenticated;

select lives_ok($$select public.set_driver_role('00000000-0000-0000-0000-000000360201', 'backup', (select updated_at from public.drivers where id = '00000000-0000-0000-0000-000000360201'))$$,
  'the owner can switch a driver to Backup');
select is((select driver_kind::text from public.drivers where id = '00000000-0000-0000-0000-000000360201'), 'backup', 'the role changed');
select is((select string_agg(from_role || '>' || to_role, ',') from public.driver_role_changes where driver_id = '00000000-0000-0000-0000-000000360201'),
  'primary>backup', 'the switch is logged with from and to');
select is(public.set_driver_role('00000000-0000-0000-0000-000000360201', 'backup', (select updated_at from public.drivers where id = '00000000-0000-0000-0000-000000360201')),
  null, 'switching to the current role does nothing');
select throws_ok($$select public.set_driver_role('00000000-0000-0000-0000-000000360201', 'primary', '2000-01-01 00:00+00')$$,
  'P0001', 'This driver was changed by someone else. Reload to see it.', 'a stale switch is refused');
select lives_ok($$select public.set_driver_role('00000000-0000-0000-0000-000000360202', 'backup', (select updated_at from public.drivers where id = '00000000-0000-0000-0000-000000360202'))$$,
  'an Inactive driver''s role can be switched');
reset role;
select throws_ok($$update public.drivers set phone = '09179999999' where id = '00000000-0000-0000-0000-000000360202'$$,
  '23514', 'This driver is Inactive. Set the driver to Active before editing their details', 'other details stay locked while Inactive');

-- Undo. Make the first change older so "latest" is deterministic within this transaction.
update public.driver_role_changes set changed_at = now() - interval '10 seconds' where driver_id = '00000000-0000-0000-0000-000000360201';
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000360002","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$select public.undo_driver_role_change((select id from public.driver_role_changes where driver_id = '00000000-0000-0000-0000-000000360201'))$$,
  'P0001', 'This change can no longer be undone.', 'another user cannot undo the change');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000360001","role":"authenticated"}', true);
select lives_ok($$select public.set_driver_role('00000000-0000-0000-0000-000000360201', 'primary', (select updated_at from public.drivers where id = '00000000-0000-0000-0000-000000360201'))$$,
  'a second switch back to Primary');
select throws_ok($$select public.undo_driver_role_change((select id from public.driver_role_changes where driver_id = '00000000-0000-0000-0000-000000360201' and to_role = 'backup'))$$,
  'P0001', 'This change can no longer be undone.', 'an older change cannot be undone');
select lives_ok($$select public.undo_driver_role_change((select id from public.driver_role_changes where driver_id = '00000000-0000-0000-0000-000000360201' and to_role = 'primary'))$$,
  'the latest change can be undone');
select is((select driver_kind::text || '/' || (select count(*) from public.driver_role_changes where driver_id = '00000000-0000-0000-0000-000000360201')
  from public.drivers where id = '00000000-0000-0000-0000-000000360201'),
  'backup/1', 'undo restored the previous role and withdrew the entry');

reset role;
update public.driver_role_changes set changed_at = now() - interval '2 minutes' where driver_id = '00000000-0000-0000-0000-000000360201' and deleted_at is null;
set local role authenticated;
select throws_ok($$select public.undo_driver_role_change((select id from public.driver_role_changes where driver_id = '00000000-0000-0000-0000-000000360201'))$$,
  'P0001', 'This change can no longer be undone.', 'a change older than 60 seconds cannot be undone');
select throws_ok($$insert into public.driver_role_changes (driver_id, from_role, to_role, changed_by) values ('00000000-0000-0000-0000-000000360201', 'backup', 'primary', '00000000-0000-0000-0000-000000360001')$$,
  '42501', null, 'history cannot be written directly');

reset role;
select throws_ok($$insert into public.driver_role_changes (driver_id, from_role, to_role, changed_by) values ('00000000-0000-0000-0000-000000360201', 'backup', 'backup', '00000000-0000-0000-0000-000000360001')$$,
  '23514', null, 'a change must switch to a different role');

select * from finish();
rollback;
