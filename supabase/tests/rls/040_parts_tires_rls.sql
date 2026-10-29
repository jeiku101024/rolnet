begin;
select plan(19);

-- FR-020 / FR-021: who can read and write part replacements and tire installations. Anon is
-- denied outright, pending users see nothing, approved staff record and edit maintenance, and
-- soft-deleted rows leave current views. Staff soft-delete denial is in 190_owner_soft_delete_rls.sql.

insert into auth.users (id, email, aud, role)
values
  ('00000000-0000-0000-0000-000000045001', 'prtrls-owner@rolnet.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000045002', 'prtrls-staff@rolnet.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000045003', 'prtrls-pending@rolnet.test', 'authenticated', 'authenticated');
update public.profiles
set role = 'owner', account_status = 'approved', approved_at = now(), approved_by = user_id
where user_id = '00000000-0000-0000-0000-000000045001';
update public.profiles
set account_status = 'approved', approved_at = now(), approved_by = '00000000-0000-0000-0000-000000045001'
where user_id = '00000000-0000-0000-0000-000000045002';

insert into public.units (id, body_number, plate_number, make_model)
values ('00000000-0000-0000-0000-000000045101', 'PTR-045-A', 'PTR045A', 'Test Tricycle');
insert into public.part_replacements (id, unit_id, part_name, cost_centavos, replaced_on, next_due_date, deleted_at)
values
  ('00000000-0000-0000-0000-000000045201', '00000000-0000-0000-0000-000000045101', 'Oil filter', 35000, '2031-04-01', '2031-07-01', null),
  ('00000000-0000-0000-0000-000000045202', '00000000-0000-0000-0000-000000045101', 'Old filter', 35000, '2031-03-01', '2031-06-01', now());
insert into public.tire_installations (id, unit_id, position, brand, installed_on, cost_centavos, next_due_date)
values ('00000000-0000-0000-0000-000000045301', '00000000-0000-0000-0000-000000045101', 'front', 'Test Tire', '2031-04-01', 120000, '2032-04-01');

select policies_are('public', 'part_replacements', array['parts_staff_read', 'parts_operational_insert', 'parts_operational_update'], 'parts policies exist');
select policies_are('public', 'tire_installations', array['tires_staff_read', 'tires_operational_insert', 'tires_operational_update'], 'tire policies exist');

-- Signed-out visitor.
set local role anon;
select throws_ok($$select 1 from public.part_replacements$$, '42501', null, 'anon cannot read parts');
select throws_ok($$select 1 from public.tire_installations$$, '42501', null, 'anon cannot read tires');
reset role;

-- Signed-in user whose registration is still pending.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000045003","role":"authenticated"}', true);
set local role authenticated;
select is_empty($$select 1 from public.part_replacements where unit_id = '00000000-0000-0000-0000-000000045101'$$, 'a pending user sees no parts');
select is_empty($$select 1 from public.tire_installations where unit_id = '00000000-0000-0000-0000-000000045101'$$, 'a pending user sees no tires');
select throws_ok($$insert into public.part_replacements (unit_id, part_name, cost_centavos, replaced_on, next_due_date)
  values ('00000000-0000-0000-0000-000000045101', 'Chain', 100, '2031-04-01', '2031-05-01')$$, '42501', null, 'a pending user cannot record parts');
select throws_ok($$insert into public.tire_installations (unit_id, position, brand, installed_on, cost_centavos, next_due_date)
  values ('00000000-0000-0000-0000-000000045101', 'rear_left', 'Test Tire', '2031-04-01', 100, '2032-04-01')$$, '42501', null, 'a pending user cannot record tires');
reset role;

-- Approved staff.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000045002","role":"authenticated"}', true);
set local role authenticated;
select isnt_empty($$select 1 from public.part_replacements where id = '00000000-0000-0000-0000-000000045201'$$, 'staff read current parts');
select is_empty($$select 1 from public.part_replacements where id = '00000000-0000-0000-0000-000000045202'$$, 'staff do not see soft-deleted parts');
select isnt_empty($$select 1 from public.tire_installations where id = '00000000-0000-0000-0000-000000045301'$$, 'staff read current tires');
select lives_ok($$insert into public.part_replacements (unit_id, part_name, cost_centavos, replaced_on, next_due_date)
  values ('00000000-0000-0000-0000-000000045101', 'Chain', 100, '2031-04-01', '2031-05-01')$$, 'staff record parts');
select lives_ok($$insert into public.tire_installations (unit_id, position, brand, installed_on, cost_centavos, next_due_date)
  values ('00000000-0000-0000-0000-000000045101', 'rear_left', 'Test Tire', '2031-04-01', 100, '2032-04-01')$$, 'staff record tires');
select lives_ok($$update public.part_replacements set next_due_date = '2031-08-01' where id = '00000000-0000-0000-0000-000000045201'$$, 'staff edit parts');
select is((select next_due_date from public.part_replacements where id = '00000000-0000-0000-0000-000000045201'), '2031-08-01'::date, 'the part edit is saved');
select lives_ok($$update public.tire_installations set brand = 'Edited Tire' where id = '00000000-0000-0000-0000-000000045301'$$, 'staff edit tires');
select is((select updated_by from public.tire_installations where id = '00000000-0000-0000-0000-000000045301'), '00000000-0000-0000-0000-000000045002'::uuid, 'the tire editor is recorded');
reset role;

-- Approved owner.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000045001","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.part_replacements where unit_id = '00000000-0000-0000-0000-000000045101'), 2::bigint, 'the owner reads current parts, without soft-deleted ones');
select is((select count(*) from public.tire_installations where unit_id = '00000000-0000-0000-0000-000000045101'), 2::bigint, 'the owner reads current tires');
reset role;

select finish();
rollback;
