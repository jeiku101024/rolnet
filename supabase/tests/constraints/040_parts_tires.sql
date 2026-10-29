begin;
select plan(24);

-- FR-020 / FR-021: part replacements and tire installations accept valid rows and reject invalid
-- ones; each unit has one current tire per position. Tire replacement through
-- replace_tire_installation() (T122) is covered in 200_replacement_history.sql.

insert into auth.users (id, email, aud, role)
values
  ('00000000-0000-0000-0000-000000040001', 'parts-owner@rolnet.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000040002', 'parts-staff@rolnet.test', 'authenticated', 'authenticated');
update public.profiles
set role = 'owner', account_status = 'approved', approved_at = now(), approved_by = user_id
where user_id = '00000000-0000-0000-0000-000000040001';
update public.profiles
set account_status = 'approved', approved_at = now(), approved_by = '00000000-0000-0000-0000-000000040001'
where user_id = '00000000-0000-0000-0000-000000040002';

insert into public.units (id, body_number, plate_number, make_model)
values ('00000000-0000-0000-0000-000000040101', 'PRT-040-A', 'PRT040A', 'Test Tricycle');

-- Approved staff record parts and tires.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000040002","role":"authenticated"}', true);
set local role authenticated;

-- Parts.
select lives_ok($$insert into public.part_replacements (id, unit_id, part_name, cost_centavos, replaced_on, next_due_date)
  values ('00000000-0000-0000-0000-000000040201', '00000000-0000-0000-0000-000000040101', 'Oil filter', 35000, '2031-04-01', '2031-07-01')$$,
  'a part with a due date is accepted');
select is((select created_by from public.part_replacements where id = '00000000-0000-0000-0000-000000040201'), '00000000-0000-0000-0000-000000040002'::uuid, 'the creator is recorded');
select lives_ok($$insert into public.part_replacements (unit_id, part_name, cost_centavos, replaced_on, replacement_mileage, next_due_mileage)
  values ('00000000-0000-0000-0000-000000040101', 'Chain', 0, '2031-04-01', 1000, 3000)$$,
  'a free part with only a due mileage is accepted');
select throws_ok($$insert into public.part_replacements (unit_id, part_name, cost_centavos, replaced_on)
  values ('00000000-0000-0000-0000-000000040101', 'Spark plug', 100, '2031-04-01')$$,
  '23514', null, 'a part needs a due date or a due mileage');
select throws_ok($$insert into public.part_replacements (unit_id, part_name, cost_centavos, replaced_on, next_due_date)
  values ('00000000-0000-0000-0000-000000040101', 'Spark plug', 100, '2031-04-01', '2031-04-01')$$,
  '23514', null, 'the due date must be after the replacement date');
select throws_ok($$insert into public.part_replacements (unit_id, part_name, cost_centavos, replaced_on, replacement_mileage, next_due_mileage)
  values ('00000000-0000-0000-0000-000000040101', 'Spark plug', 100, '2031-04-01', 2000, 2000)$$,
  '23514', null, 'the due mileage must be above the replacement mileage');
select throws_ok($$insert into public.part_replacements (unit_id, part_name, cost_centavos, replaced_on, next_due_date)
  values ('00000000-0000-0000-0000-000000040101', 'Spark plug', -1, '2031-04-01', '2031-05-01')$$,
  '23514', null, 'a negative part cost is rejected');
select throws_ok($$insert into public.part_replacements (unit_id, part_name, cost_centavos, replaced_on, replacement_mileage, next_due_date)
  values ('00000000-0000-0000-0000-000000040101', 'Spark plug', 100, '2031-04-01', -5, '2031-05-01')$$,
  '23514', null, 'a negative replacement mileage is rejected');
select throws_ok($$insert into public.part_replacements (unit_id, part_name, cost_centavos, replaced_on, next_due_date)
  values ('00000000-0000-0000-0000-000000040101', '  ', 100, '2031-04-01', '2031-05-01')$$,
  '23514', null, 'a blank part name is rejected');
select throws_ok($$insert into public.part_replacements (unit_id, part_name, cost_centavos, replaced_on, next_due_date)
  values (gen_random_uuid(), 'Spark plug', 100, '2031-04-01', '2031-05-01')$$,
  '23503', null, 'a part needs an existing unit');
select throws_ok($$update public.part_replacements set next_due_date = '2031-03-01' where id = '00000000-0000-0000-0000-000000040201'$$,
  '23514', null, 'an edit cannot move the due date before the replacement date');

-- Tires.
select lives_ok($$insert into public.tire_installations (id, unit_id, position, brand, installed_on, cost_centavos, next_due_date)
  values ('00000000-0000-0000-0000-000000040301', '00000000-0000-0000-0000-000000040101', 'front', 'Test Tire', '2031-04-01', 120000, '2032-04-01')$$,
  'a front tire is installed');
select throws_ok($$insert into public.tire_installations (unit_id, position, brand, installed_on, cost_centavos, next_due_date)
  values ('00000000-0000-0000-0000-000000040101', 'front', 'Other Tire', '2031-04-02', 120000, '2032-04-02')$$,
  '23505', null, 'a second current front tire is rejected');
select lives_ok($$insert into public.tire_installations (unit_id, position, brand, installed_on, cost_centavos, next_due_mileage)
  values ('00000000-0000-0000-0000-000000040101', 'rear_left', 'Test Tire', '2031-04-01', 120000, 20000)$$,
  'a tire in another position is installed');
select throws_ok($$insert into public.tire_installations (unit_id, position, brand, installed_on, cost_centavos)
  values ('00000000-0000-0000-0000-000000040101', 'rear_right', 'Test Tire', '2031-04-01', 120000)$$,
  '23514', null, 'a tire needs a due date or a due mileage');
select throws_ok($$insert into public.tire_installations (unit_id, position, brand, installed_on, cost_centavos, next_due_date)
  values ('00000000-0000-0000-0000-000000040101', 'rear_right', 'Test Tire', '2031-04-01', -1, '2032-04-01')$$,
  '23514', null, 'a negative tire cost is rejected');
select throws_ok($$insert into public.tire_installations (unit_id, position, brand, installed_on, cost_centavos, next_due_date)
  values ('00000000-0000-0000-0000-000000040101', 'spare', 'Test Tire', '2031-04-01', 100, '2032-04-01')$$,
  '22P02', null, 'an unknown tire position is rejected');
select throws_ok($$insert into public.tire_installations (unit_id, position, brand, installed_on, cost_centavos, next_due_date)
  values ('00000000-0000-0000-0000-000000040101', 'rear_right', ' ', '2031-04-01', 100, '2032-04-01')$$,
  '23514', null, 'a blank tire brand is rejected');
select throws_ok($$insert into public.tire_installations (unit_id, position, brand, installed_on, installed_mileage, cost_centavos, next_due_date)
  values ('00000000-0000-0000-0000-000000040101', 'rear_right', 'Test Tire', '2031-04-01', -1, 100, '2032-04-01')$$,
  '23514', null, 'a negative installed mileage is rejected');
reset role;

-- Once the owner archives the current front tire, the position is free again.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000040001","role":"authenticated"}', true);
set local role authenticated;
select ok(public.soft_delete_record('tire_installations', '00000000-0000-0000-0000-000000040301') is not null, 'the owner archives the front tire');
select lives_ok($$insert into public.tire_installations (unit_id, position, brand, installed_on, cost_centavos, next_due_date)
  values ('00000000-0000-0000-0000-000000040101', 'front', 'Other Tire', '2031-04-02', 120000, '2032-04-02')$$,
  'a new front tire is accepted after the old one is archived');
reset role;

select has_index('public', 'tire_installations', 'current_tire_position_unique', 'one current tire per position is enforced by an index');
select throws_ok($$delete from public.part_replacements where id = '00000000-0000-0000-0000-000000040201'$$, '23514', null, 'parts cannot be hard-deleted');
select throws_ok($$delete from public.tire_installations where id = '00000000-0000-0000-0000-000000040301'$$, '23514', null, 'tires cannot be hard-deleted');

select finish();
rollback;
