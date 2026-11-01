begin;
select plan(13);

-- Feature 010 (20261101000300_remittances_use_unit_assignments.sql): new remittances follow the
-- daily unit assignment; legacy remittances keep working; the old assignment model is read-only;
-- and the release-day seed picks the right driver.

insert into auth.users (id, email, aud, role)
values ('00000000-0000-0000-0000-000000310001', 'rua-owner@rolnet.test', 'authenticated', 'authenticated');
update public.profiles
set role = 'owner', account_status = 'approved', approved_at = now(), approved_by = user_id
where user_id = '00000000-0000-0000-0000-000000310001';

insert into public.units (id, body_number, plate_number, make_model, status, created_at)
values
  ('00000000-0000-0000-0000-000000310101', 'RUA-310-A', 'RUA310A', 'Test Tricycle', 'active', '2030-01-01 08:00+08'),
  ('00000000-0000-0000-0000-000000310102', 'RUA-310-B', 'RUA310B', 'Test Tricycle', 'active', '2030-01-01 08:00+08'),
  ('00000000-0000-0000-0000-000000310103', 'RUA-310-C', 'RUA310C', 'Test Tricycle', 'active', '2030-06-01 08:00+08');
insert into public.drivers (id, full_name, license_number, license_expiry_date, phone)
values
  ('00000000-0000-0000-0000-000000310201', 'RUA Driver One', 'RUA-310-L1', '2035-12-31', '09170000310'),
  ('00000000-0000-0000-0000-000000310202', 'RUA Driver Two', 'RUA-310-L2', '2035-12-31', '09170000311');
insert into public.unit_assignments (id, unit_id, driver_id, service_date)
values ('00000000-0000-0000-0000-000000310301', '00000000-0000-0000-0000-000000310101', '00000000-0000-0000-0000-000000310201', '2030-03-01');
insert into public.driver_assignments (id, unit_id, driver_id, assignment_type, starts_on)
values ('00000000-0000-0000-0000-000000310501', '00000000-0000-0000-0000-000000310103', '00000000-0000-0000-0000-000000310202', 'primary', '2030-06-01');
insert into public.unit_status_changes (unit_id, from_status, to_status, changed_at, effective_on)
values ('00000000-0000-0000-0000-000000310102', 'active', 'in_repair', '2030-04-01 09:00+08', '2030-04-01');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000310001","role":"authenticated"}', true);
set local role authenticated;

select throws_ok($$insert into public.remittances (assignment_id, unit_id, driver_id, service_date, disposition, idempotency_key)
  values ('00000000-0000-0000-0000-000000310501', '00000000-0000-0000-0000-000000310101', '00000000-0000-0000-0000-000000310201', '2030-03-01', 'returned', gen_random_uuid())$$,
  '23514', 'Driver assignments are now recorded per day on the Units page.', 'a remittance can no longer use a legacy assignment');
select throws_ok($$insert into public.remittances (unit_id, driver_id, service_date, disposition, idempotency_key)
  values ('00000000-0000-0000-0000-000000310101', '00000000-0000-0000-0000-000000310201', '2030-03-02', 'returned', gen_random_uuid())$$,
  '23514', 'Assign a driver to this unit for this date first.', 'a remittance needs that day''s assignment');
select throws_ok($$insert into public.remittances (unit_id, driver_id, service_date, disposition, idempotency_key)
  values ('00000000-0000-0000-0000-000000310101', '00000000-0000-0000-0000-000000310202', '2030-03-01', 'returned', gen_random_uuid())$$,
  '23514', 'This unit is assigned to another driver on this date. Reload the page.', 'the remittance driver must match the assignment');
select throws_ok($$insert into public.remittances (unit_id, driver_id, service_date, disposition, idempotency_key)
  values ('00000000-0000-0000-0000-000000310102', '00000000-0000-0000-0000-000000310201', '2030-04-02', 'returned', gen_random_uuid())$$,
  '23514', 'This unit is In repair on this date. No remittance for this date.', 'a blocked date takes no remittance');
select throws_ok($$insert into public.remittances (unit_id, driver_id, service_date, disposition, idempotency_key)
  values ('00000000-0000-0000-0000-000000310103', '00000000-0000-0000-0000-000000310201', '2030-05-01', 'returned', gen_random_uuid())$$,
  '23514', 'This unit wasn''t in the fleet on this date.', 'a date before the unit was added takes no remittance');
select lives_ok($$insert into public.remittances (id, unit_id, driver_id, service_date, disposition, idempotency_key)
  values ('00000000-0000-0000-0000-000000310401', '00000000-0000-0000-0000-000000310101', '00000000-0000-0000-0000-000000310201', '2030-03-01', 'returned', gen_random_uuid())$$,
  'a remittance matching the day''s assignment saves');
select is((select unit_assignment_id from public.remittances where id = '00000000-0000-0000-0000-000000310401'),
  '00000000-0000-0000-0000-000000310301'::uuid, 'the remittance is linked to the daily assignment');
select throws_ok($$update public.remittances set unit_assignment_id = null, assignment_id = null where id = '00000000-0000-0000-0000-000000310401'$$,
  '23514', null, 'the assignment link is a locked fact');
select throws_ok($$insert into public.driver_assignments (unit_id, driver_id, assignment_type, starts_on)
  values ('00000000-0000-0000-0000-000000310103', '00000000-0000-0000-0000-000000310202', 'primary', '2030-07-01')$$,
  '42501', null, 'the owner can no longer create a primary assignment');

reset role;
-- Archived units take no remittance.
update public.units set archived = true where id = '00000000-0000-0000-0000-000000310103';
insert into public.unit_assignments (unit_id, driver_id, service_date)
select '00000000-0000-0000-0000-000000310101', '00000000-0000-0000-0000-000000310202', '2030-03-03';
set local role authenticated;
select throws_ok($$insert into public.remittances (unit_id, driver_id, service_date, disposition, idempotency_key)
  values ('00000000-0000-0000-0000-000000310103', '00000000-0000-0000-0000-000000310201', '2030-07-01', 'returned', gen_random_uuid())$$,
  '23514', 'This unit is archived.', 'an archived unit takes no remittance');
reset role;

-- Legacy remittances (saved under a primary assignment) still accept payments.
alter table public.remittances disable trigger remittances_validate;
insert into public.remittances (id, assignment_id, unit_id, driver_id, service_date, disposition, amount_due_centavos, idempotency_key)
values ('00000000-0000-0000-0000-000000310402', '00000000-0000-0000-0000-000000310501', '00000000-0000-0000-0000-000000310103',
        '00000000-0000-0000-0000-000000310202', '2030-06-02', 'returned', 18000, gen_random_uuid());
alter table public.remittances enable trigger remittances_validate;
insert into public.remittance_payments (remittance_id, amount_centavos, idempotency_key)
values ('00000000-0000-0000-0000-000000310402', 10000, gen_random_uuid());
select is((select deposit_centavos from public.remittances where id = '00000000-0000-0000-0000-000000310402'),
  6000::bigint, 'a legacy remittance accepts a payment and its deposit updates');

select is((select count(*)::int from public.remittances where num_nonnulls(assignment_id, unit_assignment_id) <> 1),
  0, 'every remittance has exactly one assignment link');

-- Release-day seed invariant: at most one active row per unit and per driver for any date, and none
-- on a blocked day.
select is((select count(*)::int from public.unit_assignments a
  where a.deleted_at is null and public.unit_status_on(a.unit_id, a.service_date) <> 'active'
    and not exists (select 1 from public.remittances r where r.unit_id = a.unit_id and r.service_date = a.service_date and r.deleted_at is null)
    and a.service_date >= (now() at time zone 'Asia/Manila')::date),
  0, 'no active assignment today or later sits on a blocked day');

select * from finish();
rollback;
