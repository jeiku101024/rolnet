begin;
select plan(18);

-- Feature 010 (20261101000200_unit_status_history_and_archive.sql): archiving, and releasing
-- assignments dated today or later when a unit goes out of service or is archived, or a driver is
-- deactivated or archived. Earlier days and days with a remittance are kept; money never changes.

insert into auth.users (id, email, aud, role)
values ('00000000-0000-0000-0000-000000300001', 'rel-owner@rolnet.test', 'authenticated', 'authenticated');
update public.profiles
set role = 'owner', account_status = 'approved', approved_at = now(), approved_by = user_id
where user_id = '00000000-0000-0000-0000-000000300001';

insert into public.units (id, body_number, plate_number, make_model, status, created_at)
values
  ('00000000-0000-0000-0000-000000300101', 'REL-300-A', 'REL300A', 'Test Tricycle', 'active', '2020-01-01 08:00+08'),
  ('00000000-0000-0000-0000-000000300102', 'REL-300-B', 'REL300B', 'Test Tricycle', 'active', '2020-01-01 08:00+08'),
  ('00000000-0000-0000-0000-000000300103', 'REL-300-C', 'REL300C', 'Test Tricycle', 'active', '2020-01-01 08:00+08');
insert into public.drivers (id, full_name, license_number, license_expiry_date, phone, is_active)
values
  ('00000000-0000-0000-0000-000000300201', 'Release Driver One', 'REL-300-L1', '2035-12-31', '09170000300', true),
  ('00000000-0000-0000-0000-000000300202', 'Release Driver Two', 'REL-300-L2', '2035-12-31', '09170000301', true),
  ('00000000-0000-0000-0000-000000300203', 'Release Driver Three', 'REL-300-L3', '2035-12-31', '09170000302', true);
-- A legacy open-ended primary, which feature 005 used to treat as blocking deactivation.
insert into public.driver_assignments (unit_id, driver_id, assignment_type, starts_on)
values ('00000000-0000-0000-0000-000000300103', '00000000-0000-0000-0000-000000300203', 'primary', '2020-02-01');

-- Unit A: yesterday, today, tomorrow; today has a remittance. Unit B: today and tomorrow.
create temp table fleet_day as select (now() at time zone 'Asia/Manila')::date as d;
grant select on fleet_day to authenticated;
insert into public.unit_assignments (unit_id, driver_id, service_date)
select '00000000-0000-0000-0000-000000300101'::uuid, '00000000-0000-0000-0000-000000300201'::uuid, d + k from fleet_day, generate_series(-1, 1) k;
insert into public.unit_assignments (unit_id, driver_id, service_date)
select '00000000-0000-0000-0000-000000300102'::uuid, '00000000-0000-0000-0000-000000300202'::uuid, d + k from fleet_day, generate_series(0, 1) k;
insert into public.remittances (unit_id, driver_id, service_date, disposition, idempotency_key)
select '00000000-0000-0000-0000-000000300101', '00000000-0000-0000-0000-000000300201', d, 'returned', gen_random_uuid() from fleet_day;
insert into public.remittance_payments (remittance_id, amount_centavos, idempotency_key)
select id, 10000, gen_random_uuid() from public.remittances where unit_id = '00000000-0000-0000-0000-000000300101';
insert into public.expense_categories (id, name) values ('00000000-0000-0000-0000-000000300301', 'Release test category');
insert into public.expenses (unit_id, category_id, expense_date, amount_centavos, notes, idempotency_key)
values ('00000000-0000-0000-0000-000000300101', '00000000-0000-0000-0000-000000300301', '2026-01-15', 25000, 'Release test expense', gen_random_uuid());

create temp table money_before as
select
  (select sum(amount_due_centavos) || '/' || sum(allowance_centavos) || '/' || sum(deposit_centavos) from public.remittances where unit_id = '00000000-0000-0000-0000-000000300101' and deleted_at is null)
  || '|' || (select sum(p.amount_centavos) from public.remittance_payments p join public.remittances r on r.id = p.remittance_id where r.unit_id = '00000000-0000-0000-0000-000000300101' and p.deleted_at is null)
  || '|' || (select sum(amount_centavos) from public.expenses where unit_id = '00000000-0000-0000-0000-000000300101' and deleted_at is null) as totals;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000300001","role":"authenticated"}', true);
set local role authenticated;

-- Unit status change
update public.units set status = 'in_repair' where id = '00000000-0000-0000-0000-000000300101';
reset role;
select is((select count(*)::int from public.unit_assignments, fleet_day where unit_id = '00000000-0000-0000-0000-000000300101' and service_date = d + 1 and deleted_at is null),
  0, 'In repair releases tomorrow''s assignment');
select is((select count(*)::int from public.unit_assignments, fleet_day where unit_id = '00000000-0000-0000-0000-000000300101' and service_date = d and deleted_at is null),
  1, 'today''s assignment is kept because the day has a remittance');
select is((select count(*)::int from public.unit_assignments, fleet_day where unit_id = '00000000-0000-0000-0000-000000300101' and service_date = d - 1 and deleted_at is null),
  1, 'yesterday''s assignment is kept');
select is((select deleted_by from public.unit_assignments, fleet_day where unit_id = '00000000-0000-0000-0000-000000300101' and service_date = d + 1),
  '00000000-0000-0000-0000-000000300001'::uuid, 'the release records who made it');
select ok(exists (select 1 from public.audit_events e join public.unit_assignments a on a.id = e.entity_id, fleet_day
  where a.unit_id = '00000000-0000-0000-0000-000000300101' and a.service_date = d + 1 and e.changed_fields->'after'->>'deleted_at' is not null),
  'the release is in the audit history');
set local role authenticated;
update public.units set status = 'active' where id = '00000000-0000-0000-0000-000000300101';
reset role;
select is((select count(*)::int from public.unit_assignments, fleet_day where unit_id = '00000000-0000-0000-0000-000000300101' and service_date = d + 1 and deleted_at is null),
  0, 'returning to Active does not bring released assignments back');

-- Archive
set local role authenticated;
update public.units set archived = true where id = '00000000-0000-0000-0000-000000300102';
reset role;
select ok((select archived_at is not null and archived_by = '00000000-0000-0000-0000-000000300001' from public.units where id = '00000000-0000-0000-0000-000000300102'),
  'archiving sets archived_at and archived_by');
select is((select count(*)::int from public.unit_assignments where unit_id = '00000000-0000-0000-0000-000000300102' and deleted_at is null),
  0, 'archiving releases today''s and later assignments');
set local role authenticated;
update public.units set archived = false where id = '00000000-0000-0000-0000-000000300102';
reset role;
select ok((select not archived and archived_at is null and archived_by is null from public.units where id = '00000000-0000-0000-0000-000000300102'),
  'restoring clears the archive fields');
select is((select count(*)::int from public.unit_assignments where unit_id = '00000000-0000-0000-0000-000000300102' and deleted_at is null),
  0, 'restoring does not bring released assignments back');
select throws_ok($$insert into public.units (body_number, plate_number, make_model, archived, archived_at) values ('REL-300-X', 'REL300X', 'Test', false, now())$$,
  '23514', null, 'archived and archived_at must agree');

-- Drivers
insert into public.unit_assignments (unit_id, driver_id, service_date)
select '00000000-0000-0000-0000-000000300103'::uuid, '00000000-0000-0000-0000-000000300203'::uuid, d + 2 from fleet_day;
set local role authenticated;
select lives_ok($$update public.drivers set is_active = false where id = '00000000-0000-0000-0000-000000300203'$$,
  'a driver with an open legacy primary can now be set Inactive');
reset role;
select is((select count(*)::int from public.unit_assignments where driver_id = '00000000-0000-0000-0000-000000300203' and deleted_at is null),
  0, 'deactivating a driver releases their upcoming assignments');
insert into public.unit_assignments (unit_id, driver_id, service_date)
select '00000000-0000-0000-0000-000000300103'::uuid, '00000000-0000-0000-0000-000000300202'::uuid, d + 3 from fleet_day;
set local role authenticated;
select ok((select public.soft_delete_record('drivers', '00000000-0000-0000-0000-000000300202')) is not null, 'a driver can be archived');
reset role;
select is((select count(*)::int from public.unit_assignments where driver_id = '00000000-0000-0000-0000-000000300202' and deleted_at is null),
  0, 'archiving a driver releases their upcoming assignments');

-- Units are never deleted
set local role authenticated;
select throws_ok($$select public.soft_delete_record('units', '00000000-0000-0000-0000-000000300103')$$,
  '22023', 'Units are archived, not deleted. Use Archive.', 'soft_delete_record refuses units');
reset role;

-- Money is unchanged by all of the above (SC-004, FR-052).
select is((select
  (select sum(amount_due_centavos) || '/' || sum(allowance_centavos) || '/' || sum(deposit_centavos) from public.remittances where unit_id = '00000000-0000-0000-0000-000000300101' and deleted_at is null)
  || '|' || (select sum(p.amount_centavos) from public.remittance_payments p join public.remittances r on r.id = p.remittance_id where r.unit_id = '00000000-0000-0000-0000-000000300101' and p.deleted_at is null)
  || '|' || (select sum(amount_centavos) from public.expenses where unit_id = '00000000-0000-0000-0000-000000300101' and deleted_at is null)),
  (select totals from money_before), 'remittance, payment, and expense totals are unchanged');

select ok(not has_function_privilege('authenticated', 'public.release_unit_assignments(uuid, uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.release_on_unit_change()', 'execute')
  and not has_function_privilege('authenticated', 'public.release_on_driver_change()', 'execute')
  and not has_function_privilege('authenticated', 'public.record_unit_status_change()', 'execute'),
  'release and history functions are not executable by app roles');

select * from finish();
rollback;
