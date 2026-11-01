begin;
select plan(14);

-- Feature 010 (20261101000200_unit_status_history_and_archive.sql): every unit status change is
-- recorded with its fleet-day effective date, and unit_status_on() returns the status in effect on a
-- date.

insert into auth.users (id, email, aud, role)
values ('00000000-0000-0000-0000-000000290001', 'usc-owner@rolnet.test', 'authenticated', 'authenticated');
update public.profiles
set role = 'owner', account_status = 'approved', approved_at = now(), approved_by = user_id
where user_id = '00000000-0000-0000-0000-000000290001';

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000290001","role":"authenticated"}', true);
set local role authenticated;

insert into public.units (id, body_number, plate_number, make_model, status)
values ('00000000-0000-0000-0000-000000290101', 'USC-290-A', 'USC290A', 'Test Tricycle', 'active');

select is((select count(*)::int from public.unit_status_changes where unit_id = '00000000-0000-0000-0000-000000290101' and from_status is null and to_status = 'active'),
  1, 'creating a unit records a creation row with no previous status');

update public.units set status = 'in_repair' where id = '00000000-0000-0000-0000-000000290101';
select is((select from_status::text || '>' || to_status::text from public.unit_status_changes where unit_id = '00000000-0000-0000-0000-000000290101' and from_status is not null),
  'active>in_repair', 'a status change records from and to');
select is((select changed_by from public.unit_status_changes where unit_id = '00000000-0000-0000-0000-000000290101' and from_status is not null),
  '00000000-0000-0000-0000-000000290001'::uuid, 'the change records who made it');
select is((select effective_on from public.unit_status_changes where unit_id = '00000000-0000-0000-0000-000000290101' and from_status is not null),
  (now() at time zone 'Asia/Manila')::date, 'the change takes effect on today''s fleet date');
update public.units set status = 'in_repair' where id = '00000000-0000-0000-0000-000000290101';
select is((select count(*)::int from public.unit_status_changes where unit_id = '00000000-0000-0000-0000-000000290101'),
  2, 'setting the same status again records nothing');

select throws_ok($$insert into public.unit_status_changes (unit_id, to_status, effective_on) values ('00000000-0000-0000-0000-000000290101', 'retired', '2030-01-01')$$,
  '42501', null, 'app users cannot write status history directly');

-- Status on a date, with a controlled history.
reset role;
insert into public.units (id, body_number, plate_number, make_model, status)
values ('00000000-0000-0000-0000-000000290102', 'USC-290-B', 'USC290B', 'Test Tricycle', 'active');
update public.unit_status_changes set deleted_at = now() where unit_id = '00000000-0000-0000-0000-000000290102';
insert into public.unit_status_changes (unit_id, from_status, to_status, changed_at, effective_on)
values
  ('00000000-0000-0000-0000-000000290102', 'active', 'in_repair', '2030-11-01 09:00+08', '2030-11-01'),
  ('00000000-0000-0000-0000-000000290102', 'in_repair', 'active', '2030-11-05 08:00+08', '2030-11-05'),
  ('00000000-0000-0000-0000-000000290102', 'active', 'retired', '2030-11-05 17:00+08', '2030-11-05');
select is(public.unit_status_on('00000000-0000-0000-0000-000000290102', '2030-10-31'), 'active'::public.unit_status,
  'before the first change, the previous status applies');
select is(public.unit_status_on('00000000-0000-0000-0000-000000290102', '2030-11-01'), 'in_repair'::public.unit_status,
  'the change applies from its effective date');
select is(public.unit_status_on('00000000-0000-0000-0000-000000290102', '2030-11-04'), 'in_repair'::public.unit_status,
  'In repair has no end date');
select is(public.unit_status_on('00000000-0000-0000-0000-000000290102', '2030-11-05'), 'retired'::public.unit_status,
  'two changes on one day resolve to the later one');
select is(public.unit_status_on('00000000-0000-0000-0000-000000290102', '2031-01-01'), 'retired'::public.unit_status,
  'a future date uses the current status');
select is(public.unit_status_on('00000000-0000-0000-0000-000000290199', '2030-11-05'), 'active'::public.unit_status,
  'with no history the status is Active');

-- Backfill invariant (FR-025): every out-of-service unit's latest entry ends in its current status.
select is((select count(*)::int from public.units u
  where u.deleted_at is null and u.status <> 'active'
    and u.status is distinct from (select c.to_status from public.unit_status_changes c
      where c.unit_id = u.id and c.deleted_at is null order by c.changed_at desc limit 1)),
  0, 'every In repair or Retired unit has a latest status entry matching its status');

select throws_ok($$delete from public.unit_status_changes where unit_id = '00000000-0000-0000-0000-000000290102'$$,
  null, null, 'status history cannot be hard-deleted');

select * from finish();
rollback;
