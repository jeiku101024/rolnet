begin;
select plan(22);

-- FR-013 / FR-015: who can read and write remittances and payments. Anon is denied outright,
-- pending users see nothing, approved staff record remittances and payments, and only the owner
-- edits payments. Locked remittance facts (T116) are in 140_remittance_facts_locked_rls.sql.

insert into auth.users (id, email, aud, role)
values
  ('00000000-0000-0000-0000-000000035001', 'remrls-owner@rolnet.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000035002', 'remrls-staff@rolnet.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000035003', 'remrls-pending@rolnet.test', 'authenticated', 'authenticated');
update public.profiles
set role = 'owner', account_status = 'approved', approved_at = now(), approved_by = user_id
where user_id = '00000000-0000-0000-0000-000000035001';
update public.profiles
set account_status = 'approved', approved_at = now(), approved_by = '00000000-0000-0000-0000-000000035001'
where user_id = '00000000-0000-0000-0000-000000035002';

insert into public.units (id, body_number, plate_number, make_model)
values ('00000000-0000-0000-0000-000000035101', 'RMR-035-A', 'RMR035A', 'Test Tricycle');
insert into public.drivers (id, full_name, license_number, license_expiry_date, phone)
values ('00000000-0000-0000-0000-000000035201', 'Remit RLS Driver', 'RMR-035-L1', '2035-12-31', '09170000351');
insert into public.driver_assignments (id, unit_id, driver_id, assignment_type, starts_on)
values ('00000000-0000-0000-0000-000000035301', '00000000-0000-0000-0000-000000035101', '00000000-0000-0000-0000-000000035201', 'primary', '2031-03-01');
insert into public.remittances (id, assignment_id, unit_id, driver_id, service_date, disposition, idempotency_key, deleted_at)
values
  ('00000000-0000-0000-0000-000000035401', '00000000-0000-0000-0000-000000035301', '00000000-0000-0000-0000-000000035101', '00000000-0000-0000-0000-000000035201', '2031-03-02', 'returned', gen_random_uuid(), null),
  ('00000000-0000-0000-0000-000000035402', '00000000-0000-0000-0000-000000035301', '00000000-0000-0000-0000-000000035101', '00000000-0000-0000-0000-000000035201', '2031-03-03', 'returned', gen_random_uuid(), now());
insert into public.remittance_payments (id, remittance_id, amount_centavos, idempotency_key)
values ('00000000-0000-0000-0000-000000035501', '00000000-0000-0000-0000-000000035401', 18000, gen_random_uuid());

select policies_are('public', 'remittances', array['remittances_staff_read_policy', 'remittances_operational_insert_policy', 'remittances_operational_update_policy'], 'remittance RLS policies exist');
select policies_are('public', 'remittance_payments', array['remittance_payments_staff_read_policy', 'remittance_payments_operational_insert_policy', 'remittance_payments_owner_update_policy'], 'payment RLS policies exist');

-- Signed-out visitor.
set local role anon;
select throws_ok($$select 1 from public.remittances$$, '42501', null, 'anon cannot read remittances');
select throws_ok($$select 1 from public.remittance_payments$$, '42501', null, 'anon cannot read payments');
select throws_ok($$select public.reverse_remittance('00000000-0000-0000-0000-000000035401', 'anon')$$, '42501', null, 'anon cannot reverse remittances');
reset role;

-- Signed-in user whose registration is still pending.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000035003","role":"authenticated"}', true);
set local role authenticated;
select is_empty($$select 1 from public.remittances where unit_id = '00000000-0000-0000-0000-000000035101'$$, 'a pending user sees no remittances');
select is_empty($$select 1 from public.remittance_payments where id = '00000000-0000-0000-0000-000000035501'$$, 'a pending user sees no payments');
select throws_ok($$insert into public.remittances (assignment_id, unit_id, driver_id, service_date, disposition, idempotency_key)
  values ('00000000-0000-0000-0000-000000035301', '00000000-0000-0000-0000-000000035101', '00000000-0000-0000-0000-000000035201', '2031-03-04', 'returned', gen_random_uuid())$$,
  '42501', null, 'a pending user cannot record remittances');
select throws_ok($$insert into public.remittance_payments (remittance_id, amount_centavos, idempotency_key)
  values ('00000000-0000-0000-0000-000000035401', 100, gen_random_uuid())$$, '42501', null, 'a pending user cannot record payments');
reset role;

-- Approved staff.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000035002","role":"authenticated"}', true);
set local role authenticated;
select isnt_empty($$select 1 from public.remittances where id = '00000000-0000-0000-0000-000000035401'$$, 'staff read current remittances');
select is_empty($$select 1 from public.remittances where id = '00000000-0000-0000-0000-000000035402'$$, 'staff do not see reversed remittances');
select isnt_empty($$select 1 from public.remittance_payments where id = '00000000-0000-0000-0000-000000035501'$$, 'staff read payments');
select lives_ok($$insert into public.remittances (id, assignment_id, unit_id, driver_id, service_date, disposition, idempotency_key)
  values ('00000000-0000-0000-0000-000000035410', '00000000-0000-0000-0000-000000035301', '00000000-0000-0000-0000-000000035101', '00000000-0000-0000-0000-000000035201', '2031-03-04', 'overnight_overtime', gen_random_uuid())$$,
  'staff record remittances');
select lives_ok($$insert into public.remittance_payments (remittance_id, amount_centavos, idempotency_key)
  values ('00000000-0000-0000-0000-000000035410', 30000, gen_random_uuid())$$, 'staff record payments');
select is((select created_by from public.remittances where id = '00000000-0000-0000-0000-000000035410'), '00000000-0000-0000-0000-000000035002'::uuid, 'the recording staff member is saved');
update public.remittance_payments set amount_centavos = 1, notes = 'staff edit' where id = '00000000-0000-0000-0000-000000035501';
select is((select amount_centavos from public.remittance_payments where id = '00000000-0000-0000-0000-000000035501'), 18000::bigint, 'staff cannot edit a saved payment');
reset role;

-- Approved owner.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000035001","role":"authenticated"}', true);
set local role authenticated;
select isnt_empty($$select 1 from public.remittances where id = '00000000-0000-0000-0000-000000035410'$$, 'the owner reads remittances');
select lives_ok($$update public.remittance_payments set notes = 'owner note' where id = '00000000-0000-0000-0000-000000035501'$$, 'the owner edits a payment');
select is((select notes from public.remittance_payments where id = '00000000-0000-0000-0000-000000035501'), 'owner note', 'the owner''s payment edit is saved');
select is_empty($$select 1 from public.remittances where id = '00000000-0000-0000-0000-000000035402'$$, 'reversed remittances stay out of the owner''s current views');
select lives_ok($$select public.reverse_remittance('00000000-0000-0000-0000-000000035410', 'wrong day')$$, 'the owner reverses a remittance');
reset role;
select is((select deleted_by from public.remittances where id = '00000000-0000-0000-0000-000000035410'), '00000000-0000-0000-0000-000000035001'::uuid, 'the reversal is attributed to the owner');

select finish();
rollback;
