begin;
select plan(14);

-- Feature 010 (FR-056, FR-057, research R9): approved staff read and save daily assignments; unit
-- changes, status history, and the old assignment model stay out of their reach; unapproved users
-- and anon see nothing.

insert into auth.users (id, email, aud, role)
values
  ('00000000-0000-0000-0000-000000210001', 'uar-owner@rolnet.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000210002', 'uar-staff@rolnet.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000210003', 'uar-pending@rolnet.test', 'authenticated', 'authenticated');
update public.profiles
set role = 'owner', account_status = 'approved', approved_at = now(), approved_by = user_id
where user_id = '00000000-0000-0000-0000-000000210001';
update public.profiles
set account_status = 'approved', approved_at = now(), approved_by = '00000000-0000-0000-0000-000000210001'
where user_id = '00000000-0000-0000-0000-000000210002';

insert into public.units (id, body_number, plate_number, make_model, created_at)
values ('00000000-0000-0000-0000-000000210101', 'UAR-210-A', 'UAR210A', 'Test Tricycle', '2030-01-01 08:00+08');
insert into public.drivers (id, full_name, license_number, license_expiry_date, phone)
values
  ('00000000-0000-0000-0000-000000210201', 'UAR Driver One', 'UAR-210-L1', '2035-12-31', '09170000210'),
  ('00000000-0000-0000-0000-000000210202', 'UAR Driver Two', 'UAR-210-L2', '2035-12-31', '09170000211');

-- Approved staff
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000210002","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$select public.save_unit_assignment('00000000-0000-0000-0000-000000210101', '2030-03-01', '00000000-0000-0000-0000-000000210201', null, null)$$,
  'staff can save an assignment');
select is((select count(*)::int from public.unit_assignments where unit_id = '00000000-0000-0000-0000-000000210101'),
  1, 'staff can read assignments');
select lives_ok($$select public.save_unit_assignment('00000000-0000-0000-0000-000000210101', '2030-03-01', '00000000-0000-0000-0000-000000210202', 'edited',
  (select updated_at from public.unit_assignments where unit_id = '00000000-0000-0000-0000-000000210101' and service_date = '2030-03-01'))$$,
  'staff can edit an assignment');
select ok((select count(*) > 0 from public.unit_status_changes where unit_id = '00000000-0000-0000-0000-000000210101'),
  'staff can read status history');

update public.units set status = 'in_repair', archived = true, name = 'Staff rename', body_number = 'X', plate_number = 'X', make_model = 'X'
where id = '00000000-0000-0000-0000-000000210101';
select is((select status::text || '/' || archived || '/' || body_number from public.units where id = '00000000-0000-0000-0000-000000210101'),
  'active/false/UAR-210-A', 'staff updates to units change nothing');
select throws_ok($$insert into public.unit_status_changes (unit_id, to_status, effective_on) values ('00000000-0000-0000-0000-000000210101', 'retired', '2030-01-01')$$,
  '42501', null, 'staff cannot write status history');
update public.unit_status_changes set to_status = 'retired' where unit_id = '00000000-0000-0000-0000-000000210101';
select is((select string_agg(to_status::text, ',') from public.unit_status_changes where unit_id = '00000000-0000-0000-0000-000000210101'),
  'active', 'staff cannot change status history');
select throws_ok($$insert into public.driver_assignments (unit_id, driver_id, assignment_type, starts_on) values ('00000000-0000-0000-0000-000000210101', '00000000-0000-0000-0000-000000210201', 'primary', '2030-07-01')$$,
  '42501', null, 'staff cannot create a legacy assignment');
select throws_ok($$insert into public.driver_days_off (primary_assignment_id, day_off_date) values (gen_random_uuid(), '2030-07-01')$$,
  null, null, 'staff cannot record a legacy day off');
select throws_ok($$select public.soft_delete_record('units', '00000000-0000-0000-0000-000000210101')$$,
  null, null, 'staff cannot delete a unit');

-- Unapproved user
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000210003","role":"authenticated"}', true);
select is((select count(*)::int from public.unit_assignments), 0, 'a pending user reads no assignments');
select is((select count(*)::int from public.unit_status_changes), 0, 'a pending user reads no status history');
select throws_ok($$select public.save_unit_assignment('00000000-0000-0000-0000-000000210101', '2030-03-02', '00000000-0000-0000-0000-000000210201', null, null)$$,
  '42501', null, 'a pending user cannot save an assignment');

-- Anon
reset role;
set local role anon;
select throws_ok($$select count(*) from public.unit_assignments$$, '42501', null, 'anon cannot read assignments');

select * from finish();
rollback;
