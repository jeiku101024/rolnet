begin;
select plan(13);

-- T116 / FR-013a: saved remittance facts are immutable for staff and owner; notes stay editable
-- and owners correct through reverse_remittance() plus a replacement entry.

insert into auth.users (id, email, aud, role)
values
  ('00000000-0000-0000-0000-000000140001', 'lock-owner@rolnet.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000140002', 'lock-staff@rolnet.test', 'authenticated', 'authenticated');

update public.profiles
set role = 'owner', account_status = 'approved', approved_at = now(), approved_by = user_id
where user_id = '00000000-0000-0000-0000-000000140001';
update public.profiles
set account_status = 'approved', approved_at = now(), approved_by = '00000000-0000-0000-0000-000000140001'
where user_id = '00000000-0000-0000-0000-000000140002';

insert into public.units (id, body_number, plate_number, make_model)
values
  ('00000000-0000-0000-0000-000000140101', 'LOCK-140-A', 'LCK140A', 'Test Tricycle'),
  ('00000000-0000-0000-0000-000000140102', 'LOCK-140-B', 'LCK140B', 'Test Tricycle');
insert into public.drivers (id, full_name, license_number, license_expiry_date, phone)
values
  ('00000000-0000-0000-0000-000000140201', 'Lock Driver One', 'LOCK-140-L1', '2035-12-31', '09170000140'),
  ('00000000-0000-0000-0000-000000140202', 'Lock Driver Two', 'LOCK-140-L2', '2035-12-31', '09170000141');
insert into public.driver_assignments (id, unit_id, driver_id, assignment_type, starts_on)
values
  ('00000000-0000-0000-0000-000000140301', '00000000-0000-0000-0000-000000140101', '00000000-0000-0000-0000-000000140201', 'primary', '2031-01-01'),
  ('00000000-0000-0000-0000-000000140302', '00000000-0000-0000-0000-000000140102', '00000000-0000-0000-0000-000000140202', 'primary', '2031-01-01');
insert into public.remittances (id, assignment_id, unit_id, driver_id, service_date, disposition, idempotency_key)
values ('00000000-0000-0000-0000-000000140401', '00000000-0000-0000-0000-000000140301', '00000000-0000-0000-0000-000000140101',
        '00000000-0000-0000-0000-000000140201', '2031-01-05', 'returned', gen_random_uuid());

-- Approved staff.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000140002","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$update public.remittances set notes = 'staff note' where id = '00000000-0000-0000-0000-000000140401'$$, 'staff can edit remittance notes');
select throws_ok($$update public.remittances set service_date = '2031-01-06' where id = '00000000-0000-0000-0000-000000140401'$$, '23514', null, 'staff cannot change the service date');
select throws_ok($$update public.remittances set disposition = 'overnight_overtime' where id = '00000000-0000-0000-0000-000000140401'$$, '23514', null, 'staff cannot change the disposition');
select throws_ok($$update public.remittances set amount_due_centavos = 100 where id = '00000000-0000-0000-0000-000000140401'$$, '23514', null, 'staff cannot change the amount due');
select throws_ok($$update public.remittances set driver_id = '00000000-0000-0000-0000-000000140202' where id = '00000000-0000-0000-0000-000000140401'$$, '23514', null, 'staff cannot change the driver');
select throws_ok($$update public.remittances set unit_id = '00000000-0000-0000-0000-000000140102' where id = '00000000-0000-0000-0000-000000140401'$$, '23514', null, 'staff cannot change the unit');
select throws_ok($$update public.remittances set assignment_id = '00000000-0000-0000-0000-000000140302' where id = '00000000-0000-0000-0000-000000140401'$$, '23514', null, 'staff cannot change the assignment');
reset role;

-- Approved owner.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000140001","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$update public.remittances set service_date = '2031-01-06' where id = '00000000-0000-0000-0000-000000140401'$$, '23514', null, 'the owner cannot change the service date directly');
select throws_ok($$update public.remittances set disposition = 'overnight_overtime' where id = '00000000-0000-0000-0000-000000140401'$$, '23514', null, 'the owner cannot change the disposition directly');
select lives_ok($$update public.remittances set notes = 'owner note' where id = '00000000-0000-0000-0000-000000140401'$$, 'the owner can edit remittance notes');
select is((select notes from public.remittances where id = '00000000-0000-0000-0000-000000140401'), 'owner note', 'the note edit is saved');
select lives_ok($$select public.reverse_remittance('00000000-0000-0000-0000-000000140401', 'wrong disposition')$$, 'the owner can reverse the remittance');
insert into public.remittances (assignment_id, unit_id, driver_id, service_date, disposition, idempotency_key)
values ('00000000-0000-0000-0000-000000140301', '00000000-0000-0000-0000-000000140101', '00000000-0000-0000-0000-000000140201', '2031-01-05', 'overnight_overtime', gen_random_uuid());
select is(
  (select amount_due_centavos from public.remittances where unit_id = '00000000-0000-0000-0000-000000140101' and service_date = '2031-01-05' and deleted_at is null),
  30000::bigint,
  'a replacement entry for the same date is accepted with the recalculated due'
);
reset role;

select finish();
rollback;
