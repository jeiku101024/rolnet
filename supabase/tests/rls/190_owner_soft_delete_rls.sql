begin;
select plan(47);

-- T121 (FR-005, FR-030): owners soft-delete through soft_delete_record(); staff can never set
-- deleted_at, either through the function or by a direct update; deleted rows leave current views.

insert into auth.users (id, email, aud, role)
values
  ('00000000-0000-0000-0000-000000190001', 'softdel-owner@rolnet.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000190002', 'softdel-staff@rolnet.test', 'authenticated', 'authenticated');
update public.profiles
set role = 'owner', account_status = 'approved', approved_at = now(), approved_by = user_id
where user_id = '00000000-0000-0000-0000-000000190001';
update public.profiles
set account_status = 'approved', approved_at = now(), approved_by = '00000000-0000-0000-0000-000000190001'
where user_id = '00000000-0000-0000-0000-000000190002';

insert into public.units (id, body_number, plate_number, make_model)
values
  ('00000000-0000-0000-0000-000000190101', 'DEL-190-A', 'DEL190A', 'Test Tricycle'),
  ('00000000-0000-0000-0000-000000190102', 'DEL-190-B', 'DEL190B', 'Test Tricycle');
insert into public.drivers (id, full_name, license_number, license_expiry_date, phone)
values
  ('00000000-0000-0000-0000-000000190201', 'Delete Driver One', 'DEL-190-L1', '2035-12-31', '09170000190'),
  ('00000000-0000-0000-0000-000000190202', 'Delete Driver Two', 'DEL-190-L2', '2035-12-31', '09170000191'),
  ('00000000-0000-0000-0000-000000190203', 'Delete Driver Three', 'DEL-190-L3', '2035-12-31', '09170000192');
insert into public.driver_assignments (id, unit_id, driver_id, assignment_type, starts_on)
values ('00000000-0000-0000-0000-000000190301', '00000000-0000-0000-0000-000000190102', '00000000-0000-0000-0000-000000190203', 'primary', '2031-08-01');
insert into public.driver_days_off (id, primary_assignment_id, day_off_date)
values ('00000000-0000-0000-0000-000000190302', '00000000-0000-0000-0000-000000190301', '2031-08-05');
insert into public.mileage_readings (id, unit_id, reading_date, mileage)
values ('00000000-0000-0000-0000-000000190303', '00000000-0000-0000-0000-000000190102', '2031-08-02', 100);
insert into public.expense_categories (id, name)
values ('00000000-0000-0000-0000-000000190304', 'Delete Category 190');
insert into public.expenses (id, unit_id, category_id, expense_date, amount_centavos, idempotency_key)
select '00000000-0000-0000-0000-000000190305', '00000000-0000-0000-0000-000000190102', id, '2031-08-02', 50000, gen_random_uuid()
from public.expense_categories where system_key = 'fuel' and deleted_at is null;
insert into public.part_replacements (id, unit_id, part_name, cost_centavos, replaced_on, next_due_date)
values ('00000000-0000-0000-0000-000000190306', '00000000-0000-0000-0000-000000190102', 'Air filter', 1000, '2031-08-01', '2031-12-01');
insert into public.tire_installations (id, unit_id, position, brand, installed_on, cost_centavos, next_due_date)
values ('00000000-0000-0000-0000-000000190307', '00000000-0000-0000-0000-000000190102', 'front', 'Test Tire', '2031-08-01', 120000, '2032-08-01');
insert into public.remittances (id, assignment_id, unit_id, driver_id, service_date, disposition, idempotency_key)
values ('00000000-0000-0000-0000-000000190308', '00000000-0000-0000-0000-000000190301', '00000000-0000-0000-0000-000000190102',
        '00000000-0000-0000-0000-000000190203', '2031-08-03', 'returned', gen_random_uuid());
insert into public.remittance_payments (id, remittance_id, amount_centavos, idempotency_key)
values ('00000000-0000-0000-0000-000000190309', '00000000-0000-0000-0000-000000190308', 5000, gen_random_uuid());

-- Approved staff: the function is denied for every table.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000190002","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$select public.soft_delete_record('units', '00000000-0000-0000-0000-000000190101')$$, '42501', null, 'staff cannot soft-delete units');
select throws_ok($$select public.soft_delete_record('drivers', '00000000-0000-0000-0000-000000190201')$$, '42501', null, 'staff cannot soft-delete drivers');
select throws_ok($$select public.soft_delete_record('driver_assignments', '00000000-0000-0000-0000-000000190301')$$, '42501', null, 'staff cannot soft-delete assignments');
select throws_ok($$select public.soft_delete_record('driver_days_off', '00000000-0000-0000-0000-000000190302')$$, '42501', null, 'staff cannot soft-delete days off');
select throws_ok($$select public.soft_delete_record('mileage_readings', '00000000-0000-0000-0000-000000190303')$$, '42501', null, 'staff cannot soft-delete mileage readings');
select throws_ok($$select public.soft_delete_record('expense_categories', '00000000-0000-0000-0000-000000190304')$$, '42501', null, 'staff cannot soft-delete expense categories');
select throws_ok($$select public.soft_delete_record('expenses', '00000000-0000-0000-0000-000000190305')$$, '42501', null, 'staff cannot soft-delete expenses');
select throws_ok($$select public.soft_delete_record('part_replacements', '00000000-0000-0000-0000-000000190306')$$, '42501', null, 'staff cannot soft-delete parts');
select throws_ok($$select public.soft_delete_record('tire_installations', '00000000-0000-0000-0000-000000190307')$$, '42501', null, 'staff cannot soft-delete tires');

-- Direct updates on tables staff may otherwise edit are rejected by the owner-only rule.
select throws_ok($$update public.mileage_readings set deleted_at = now() where id = '00000000-0000-0000-0000-000000190303'$$, '42501', null, 'staff cannot set deleted_at on a mileage reading');
select throws_ok($$update public.expenses set deleted_at = now() where id = '00000000-0000-0000-0000-000000190305'$$, '42501', null, 'staff cannot set deleted_at on an expense');
select throws_ok($$update public.part_replacements set deleted_at = now() where id = '00000000-0000-0000-0000-000000190306'$$, '42501', null, 'staff cannot set deleted_at on a part');
select throws_ok($$update public.tire_installations set deleted_at = now() where id = '00000000-0000-0000-0000-000000190307'$$, '42501', null, 'staff cannot set deleted_at on a tire');
select throws_ok($$update public.remittances set deleted_at = now() where id = '00000000-0000-0000-0000-000000190308'$$, '42501', null, 'staff cannot set deleted_at on a remittance');

-- Owner-only tables: a staff update matches no rows, so the record stays current.
update public.units set deleted_at = now() where id = '00000000-0000-0000-0000-000000190101';
update public.drivers set deleted_at = now() where id = '00000000-0000-0000-0000-000000190201';
update public.driver_assignments set deleted_at = now() where id = '00000000-0000-0000-0000-000000190301';
update public.driver_days_off set deleted_at = now() where id = '00000000-0000-0000-0000-000000190302';
update public.expense_categories set deleted_at = now() where id = '00000000-0000-0000-0000-000000190304';
update public.remittance_payments set deleted_at = now() where id = '00000000-0000-0000-0000-000000190309';
update public.fleet_settings set deleted_at = now() where id = true;
select isnt_empty($$select 1 from public.units where id = '00000000-0000-0000-0000-000000190101'$$, 'a staff update does not delete a unit');
select isnt_empty($$select 1 from public.drivers where id = '00000000-0000-0000-0000-000000190201'$$, 'a staff update does not delete a driver');
select isnt_empty($$select 1 from public.driver_assignments where id = '00000000-0000-0000-0000-000000190301'$$, 'a staff update does not delete an assignment');
select isnt_empty($$select 1 from public.driver_days_off where id = '00000000-0000-0000-0000-000000190302'$$, 'a staff update does not delete a day off');
select isnt_empty($$select 1 from public.expense_categories where id = '00000000-0000-0000-0000-000000190304'$$, 'a staff update does not delete a category');
select isnt_empty($$select 1 from public.remittance_payments where id = '00000000-0000-0000-0000-000000190309'$$, 'a staff update does not delete a payment');
select isnt_empty($$select 1 from public.fleet_settings where id = true$$, 'a staff update does not delete fleet settings');
reset role;

-- Approved owner.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000190001","role":"authenticated"}', true);
set local role authenticated;
select ok(public.soft_delete_record('units', '00000000-0000-0000-0000-000000190101') is not null, 'the owner soft-deletes a unit');
select ok(public.soft_delete_record('drivers', '00000000-0000-0000-0000-000000190201') is not null, 'the owner soft-deletes a driver');
select ok(public.soft_delete_record('driver_days_off', '00000000-0000-0000-0000-000000190302') is not null, 'the owner soft-deletes a day off');
select ok(public.soft_delete_record('driver_assignments', '00000000-0000-0000-0000-000000190301') is not null, 'the owner soft-deletes an assignment');
select ok(public.soft_delete_record('mileage_readings', '00000000-0000-0000-0000-000000190303') is not null, 'the owner soft-deletes a mileage reading');
select ok(public.soft_delete_record('expense_categories', '00000000-0000-0000-0000-000000190304') is not null, 'the owner soft-deletes a custom category');
select ok(public.soft_delete_record('expenses', '00000000-0000-0000-0000-000000190305') is not null, 'the owner soft-deletes an expense');
select ok(public.soft_delete_record('part_replacements', '00000000-0000-0000-0000-000000190306') is not null, 'the owner soft-deletes a part');
select ok(public.soft_delete_record('tire_installations', '00000000-0000-0000-0000-000000190307') is not null, 'the owner soft-deletes a tire');
select is_empty($$select 1 from public.units where id = '00000000-0000-0000-0000-000000190101'$$, 'a deleted unit leaves current views');
select is_empty($$select 1 from public.drivers where id = '00000000-0000-0000-0000-000000190201'$$, 'a deleted driver leaves current views');
select is_empty($$select 1 from public.driver_days_off where id = '00000000-0000-0000-0000-000000190302'$$, 'a deleted day off leaves current views');
select is_empty($$select 1 from public.driver_assignments where id = '00000000-0000-0000-0000-000000190301'$$, 'a deleted assignment leaves current views');
select is_empty($$select 1 from public.mileage_readings where id = '00000000-0000-0000-0000-000000190303'$$, 'a deleted reading leaves current views');
select is_empty($$select 1 from public.expense_categories where id = '00000000-0000-0000-0000-000000190304'$$, 'a deleted category leaves current views');
select is_empty($$select 1 from public.expenses where id = '00000000-0000-0000-0000-000000190305'$$, 'a deleted expense leaves current views');
select is_empty($$select 1 from public.part_replacements where id = '00000000-0000-0000-0000-000000190306'$$, 'a deleted part leaves current views');
select is_empty($$select 1 from public.tire_installations where id = '00000000-0000-0000-0000-000000190307'$$, 'a deleted tire leaves current views');
select isnt_empty($$select 1 from public.audit_events where entity_id = '00000000-0000-0000-0000-000000190101' and action = 'soft_delete'$$, 'the soft delete is audited');

-- Records with their own correction functions, and built-in categories, are not deleted here.
select throws_ok($$select public.soft_delete_record('remittances', '00000000-0000-0000-0000-000000190308')$$, '22023', null, 'remittances are reversed with reverse_remittance()');
select throws_ok($$select public.soft_delete_record('remittance_payments', '00000000-0000-0000-0000-000000190309')$$, '22023', null, 'payments are corrected with correct_remittance_payment()');
select throws_ok($$select public.soft_delete_record('fleet_settings', gen_random_uuid())$$, '22023', null, 'fleet settings cannot be deleted');
select throws_ok($$select public.soft_delete_record('expense_categories', (select id from public.expense_categories where system_key = 'fuel' and deleted_at is null))$$, '23514', null, 'built-in categories cannot be deleted');

-- Optimistic concurrency and restore.
select is(public.soft_delete_record('drivers', '00000000-0000-0000-0000-000000190202', '2000-01-01T00:00:00Z'), null::jsonb, 'a stale expected update time deletes nothing');
select ok(public.restore_record('units', '00000000-0000-0000-0000-000000190101') is not null, 'the owner restores a unit');
select isnt_empty($$select 1 from public.units where id = '00000000-0000-0000-0000-000000190101'$$, 'a restored unit is current again');
reset role;

select finish();
rollback;
