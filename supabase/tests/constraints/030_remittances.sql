begin;
select plan(37);

-- FR-013 / FR-014 / FR-015: remittances need an assignment active on the service date that
-- matches the unit and driver (the backup is the operating driver on a covered day), the due is
-- computed by the database (18,000 centavos returned, 30,000 overnight), there is one remittance per
-- unit and driver per day, payments are positive and need an active remittance, and owners correct
-- entries through reverse_remittance() and correct_remittance_payment().
-- Locked financial facts (T116) are covered in rls/140_remittance_facts_locked_rls.sql and balances
-- (T124) in 210_driver_outstanding_balances.sql.

insert into auth.users (id, email, aud, role)
values
  ('00000000-0000-0000-0000-000000030001', 'remit-owner@rolnet.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000030002', 'remit-staff@rolnet.test', 'authenticated', 'authenticated');
update public.profiles
set role = 'owner', account_status = 'approved', approved_at = now(), approved_by = user_id
where user_id = '00000000-0000-0000-0000-000000030001';
update public.profiles
set account_status = 'approved', approved_at = now(), approved_by = '00000000-0000-0000-0000-000000030001'
where user_id = '00000000-0000-0000-0000-000000030002';

insert into public.units (id, body_number, plate_number, make_model)
values
  ('00000000-0000-0000-0000-000000030101', 'REM-030-A', 'REM030A', 'Test Tricycle'),
  ('00000000-0000-0000-0000-000000030102', 'REM-030-B', 'REM030B', 'Test Tricycle'),
  ('00000000-0000-0000-0000-000000030103', 'REM-030-C', 'REM030C', 'Test Tricycle');
insert into public.drivers (id, full_name, license_number, license_expiry_date, phone)
values
  ('00000000-0000-0000-0000-000000030201', 'Remit Driver X', 'REM-030-LX', '2035-12-31', '09170000301'),
  ('00000000-0000-0000-0000-000000030202', 'Remit Driver Y', 'REM-030-LY', '2035-12-31', '09170000302'),
  ('00000000-0000-0000-0000-000000030203', 'Remit Backup Z', 'REM-030-LZ', '2035-12-31', '09170000303'),
  ('00000000-0000-0000-0000-000000030204', 'Remit Driver W', 'REM-030-LW', '2035-12-31', '09170000304');
insert into public.driver_assignments (id, unit_id, driver_id, assignment_type, starts_on, ends_on, covered_primary_assignment_id, deleted_at)
values
  ('00000000-0000-0000-0000-000000030301', '00000000-0000-0000-0000-000000030101', '00000000-0000-0000-0000-000000030201', 'primary', '2031-03-01', null, null, null),
  ('00000000-0000-0000-0000-000000030302', '00000000-0000-0000-0000-000000030102', '00000000-0000-0000-0000-000000030202', 'primary', '2031-03-01', null, null, null),
  ('00000000-0000-0000-0000-000000030304', '00000000-0000-0000-0000-000000030103', '00000000-0000-0000-0000-000000030204', 'primary', '2031-03-01', '2031-03-10', null, null),
  ('00000000-0000-0000-0000-000000030305', '00000000-0000-0000-0000-000000030103', '00000000-0000-0000-0000-000000030204', 'primary', '2031-04-01', null, null, now());
insert into public.driver_assignments (id, unit_id, driver_id, assignment_type, starts_on, ends_on, covered_primary_assignment_id)
values ('00000000-0000-0000-0000-000000030303', '00000000-0000-0000-0000-000000030101', '00000000-0000-0000-0000-000000030203', 'backup', '2031-03-15', '2031-03-15', '00000000-0000-0000-0000-000000030301');
insert into public.remittances (id, assignment_id, unit_id, driver_id, service_date, disposition, idempotency_key, deleted_at)
values
  ('00000000-0000-0000-0000-000000030401', '00000000-0000-0000-0000-000000030301', '00000000-0000-0000-0000-000000030101', '00000000-0000-0000-0000-000000030201', '2031-03-02', 'returned', gen_random_uuid(), null),
  ('00000000-0000-0000-0000-000000030402', '00000000-0000-0000-0000-000000030301', '00000000-0000-0000-0000-000000030101', '00000000-0000-0000-0000-000000030201', '2031-03-20', 'returned', gen_random_uuid(), now());
insert into public.remittance_payments (id, remittance_id, amount_centavos, idempotency_key)
values ('00000000-0000-0000-0000-000000030501', '00000000-0000-0000-0000-000000030401', 5000, gen_random_uuid());
select set_config('test.idem', gen_random_uuid()::text, true);
select set_config('test.pidem', gen_random_uuid()::text, true);

select has_index('public', 'remittances', 'remittances_unit_date_unique', 'one remittance per unit per date');
select has_index('public', 'remittances', 'remittances_driver_date_unique', 'one remittance per driver per date');
select has_index('public', 'remittances', 'remittances_assignment_idx', 'remittances are indexed by assignment');

-- Approved staff record remittances.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000030002","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(format($$insert into public.remittances (id, assignment_id, unit_id, driver_id, service_date, disposition, amount_due_centavos, idempotency_key)
  values ('00000000-0000-0000-0000-000000030410', '00000000-0000-0000-0000-000000030302', '00000000-0000-0000-0000-000000030102',
          '00000000-0000-0000-0000-000000030202', '2031-03-05', 'returned', 1, %L)$$, current_setting('test.idem')),
  'staff record a returned remittance');
select is((select amount_due_centavos from public.remittances where id = '00000000-0000-0000-0000-000000030410'), 18000::bigint, 'a returned unit owes 18,000 centavos, whatever the client sent');
select lives_ok($$insert into public.remittances (id, assignment_id, unit_id, driver_id, service_date, disposition, idempotency_key)
  values ('00000000-0000-0000-0000-000000030411', '00000000-0000-0000-0000-000000030302', '00000000-0000-0000-0000-000000030102',
          '00000000-0000-0000-0000-000000030202', '2031-03-06', 'overnight_overtime', gen_random_uuid())$$,
  'staff record an overnight remittance');
select is((select amount_due_centavos from public.remittances where id = '00000000-0000-0000-0000-000000030411'), 30000::bigint, 'an overnight unit owes 30,000 centavos');
select throws_ok($$insert into public.remittances (assignment_id, unit_id, driver_id, service_date, disposition, idempotency_key)
  values ('00000000-0000-0000-0000-000000030302', '00000000-0000-0000-0000-000000030102', '00000000-0000-0000-0000-000000030202', '2031-03-05', 'returned', gen_random_uuid())$$,
  '23505', null, 'a second remittance for the same unit, driver and date is rejected');
select throws_ok($$insert into public.remittances (assignment_id, unit_id, driver_id, service_date, disposition, idempotency_key)
  values ('00000000-0000-0000-0000-000000030301', '00000000-0000-0000-0000-000000030101', '00000000-0000-0000-0000-000000030201', '2031-02-28', 'returned', gen_random_uuid())$$,
  '23514', null, 'a date before the assignment starts is rejected');
select throws_ok($$insert into public.remittances (assignment_id, unit_id, driver_id, service_date, disposition, idempotency_key)
  values ('00000000-0000-0000-0000-000000030304', '00000000-0000-0000-0000-000000030103', '00000000-0000-0000-0000-000000030204', '2031-03-11', 'returned', gen_random_uuid())$$,
  '23514', null, 'a date after the assignment ends is rejected');
select lives_ok($$insert into public.remittances (assignment_id, unit_id, driver_id, service_date, disposition, idempotency_key)
  values ('00000000-0000-0000-0000-000000030304', '00000000-0000-0000-0000-000000030103', '00000000-0000-0000-0000-000000030204', '2031-03-10', 'returned', gen_random_uuid())$$,
  'the last day of an ended assignment is accepted');
select throws_ok($$insert into public.remittances (assignment_id, unit_id, driver_id, service_date, disposition, idempotency_key)
  values ('00000000-0000-0000-0000-000000030301', '00000000-0000-0000-0000-000000030101', '00000000-0000-0000-0000-000000030202', '2031-03-03', 'returned', gen_random_uuid())$$,
  '23514', null, 'a driver other than the assignment''s is rejected');
select throws_ok($$insert into public.remittances (assignment_id, unit_id, driver_id, service_date, disposition, idempotency_key)
  values ('00000000-0000-0000-0000-000000030301', '00000000-0000-0000-0000-000000030102', '00000000-0000-0000-0000-000000030201', '2031-03-03', 'returned', gen_random_uuid())$$,
  '23514', null, 'a unit other than the assignment''s is rejected');
select throws_ok($$insert into public.remittances (assignment_id, unit_id, driver_id, service_date, disposition, idempotency_key)
  values ('00000000-0000-0000-0000-000000030301', '00000000-0000-0000-0000-000000030101', '00000000-0000-0000-0000-000000030201', '2031-03-15', 'returned', gen_random_uuid())$$,
  '23514', null, 'the primary driver cannot remit on a day the backup covers');
select lives_ok($$insert into public.remittances (assignment_id, unit_id, driver_id, service_date, disposition, idempotency_key)
  values ('00000000-0000-0000-0000-000000030303', '00000000-0000-0000-0000-000000030101', '00000000-0000-0000-0000-000000030203', '2031-03-15', 'returned', gen_random_uuid())$$,
  'the backup driver remits on the covered day');
select throws_ok($$insert into public.remittances (assignment_id, unit_id, driver_id, service_date, disposition, idempotency_key)
  values ('00000000-0000-0000-0000-000000030305', '00000000-0000-0000-0000-000000030103', '00000000-0000-0000-0000-000000030204', '2031-04-02', 'returned', gen_random_uuid())$$,
  '23514', null, 'a soft-deleted assignment cannot take remittances');
select throws_ok($$insert into public.remittances (assignment_id, unit_id, driver_id, service_date, disposition, idempotency_key)
  values ('00000000-0000-0000-0000-000000030301', '00000000-0000-0000-0000-000000030101', '00000000-0000-0000-0000-000000030201', '2031-03-03', 'returned', null)$$,
  '23502', null, 'an idempotency key is required');
select throws_ok(format($$insert into public.remittances (assignment_id, unit_id, driver_id, service_date, disposition, idempotency_key)
  values ('00000000-0000-0000-0000-000000030301', '00000000-0000-0000-0000-000000030101', '00000000-0000-0000-0000-000000030201', '2031-03-03', 'returned', %L)$$,
  current_setting('test.idem')), '23505', null, 'a repeated idempotency key is rejected');
select throws_ok($$insert into public.remittances (assignment_id, unit_id, driver_id, service_date, disposition, idempotency_key)
  values ('00000000-0000-0000-0000-000000030301', '00000000-0000-0000-0000-000000030101', '00000000-0000-0000-0000-000000030201', '2031-03-03', 'late', gen_random_uuid())$$,
  '22P02', null, 'an unknown disposition is rejected');

-- Payments.
select lives_ok(format($$insert into public.remittance_payments (remittance_id, amount_centavos, idempotency_key)
  values ('00000000-0000-0000-0000-000000030401', 10000, %L)$$, current_setting('test.pidem')), 'staff record a partial payment');
select throws_ok($$insert into public.remittance_payments (remittance_id, amount_centavos, idempotency_key)
  values ('00000000-0000-0000-0000-000000030401', 0, gen_random_uuid())$$, '23514', null, 'a zero payment is rejected');
select throws_ok($$insert into public.remittance_payments (remittance_id, amount_centavos, idempotency_key)
  values ('00000000-0000-0000-0000-000000030401', -1, gen_random_uuid())$$, '23514', null, 'a negative payment is rejected');
select throws_ok($$insert into public.remittance_payments (remittance_id, amount_centavos, idempotency_key)
  values ('00000000-0000-0000-0000-000000030402', 1000, gen_random_uuid())$$, '23514', null, 'a reversed remittance cannot take payments');
select throws_ok($$insert into public.remittance_payments (remittance_id, amount_centavos, idempotency_key)
  values (gen_random_uuid(), 1000, gen_random_uuid())$$, '23514', null, 'a payment needs an existing remittance');
select throws_ok(format($$insert into public.remittance_payments (remittance_id, amount_centavos, idempotency_key)
  values ('00000000-0000-0000-0000-000000030401', 1000, %L)$$, current_setting('test.pidem')), '23505', null, 'a repeated payment idempotency key is rejected');

-- Corrections are owner-only.
select throws_ok($$select public.reverse_remittance('00000000-0000-0000-0000-000000030401', 'staff try')$$, '42501', null, 'staff cannot reverse remittances');
select throws_ok($$select public.correct_remittance_payment('00000000-0000-0000-0000-000000030501', 'staff try')$$, '42501', null, 'staff cannot correct payments');
reset role;

-- Approved owner.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000030001","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$select public.correct_remittance_payment('00000000-0000-0000-0000-000000030501', '  ')$$, '23514', null, 'a payment correction needs a reason');
select lives_ok($$select public.correct_remittance_payment('00000000-0000-0000-0000-000000030501', 'entered twice')$$, 'the owner corrects a payment');
select throws_ok($$select public.correct_remittance_payment('00000000-0000-0000-0000-000000030501', 'entered twice')$$, 'P0002', null, 'a corrected payment cannot be corrected again');
select lives_ok($$select public.reverse_remittance('00000000-0000-0000-0000-000000030401', 'duplicate entry')$$, 'the owner reverses a remittance');
select is_empty($$select 1 from public.remittances where id = '00000000-0000-0000-0000-000000030401'$$, 'a reversed remittance leaves current views');
select throws_ok($$select public.reverse_remittance('00000000-0000-0000-0000-000000030401', 'again')$$, 'P0002', null, 'a reversed remittance cannot be reversed again');
reset role;

select isnt_empty($$select 1 from public.audit_events where entity_id = '00000000-0000-0000-0000-000000030401' and action = 'reverse' and changed_fields ->> 'reason' = 'duplicate entry'$$,
  'the reversal and its reason are audited');
select is((select deleted_by from public.remittances where id = '00000000-0000-0000-0000-000000030401'), '00000000-0000-0000-0000-000000030001'::uuid, 'the reversal records the owner');
select throws_ok($$delete from public.remittances where id = '00000000-0000-0000-0000-000000030410'$$, '23514', null, 'remittances cannot be hard-deleted');
select throws_ok($$delete from public.remittance_payments where id = '00000000-0000-0000-0000-000000030501'$$, '23514', null, 'payments cannot be hard-deleted');

select finish();
rollback;
