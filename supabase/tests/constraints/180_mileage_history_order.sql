begin;
select plan(8);

-- T126 (FR-008): dated mileage history never decreases, including back-dated readings.

insert into auth.users (id, email, aud, role)
values ('00000000-0000-0000-0000-000000180002', 'mileage-staff@rolnet.test', 'authenticated', 'authenticated');
update public.profiles
set account_status = 'approved', approved_at = now(), approved_by = user_id
where user_id = '00000000-0000-0000-0000-000000180002';

insert into public.units (id, body_number, plate_number, make_model)
values ('00000000-0000-0000-0000-000000180101', 'MIL-180-A', 'MIL180A', 'Test Tricycle');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000180002","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$insert into public.mileage_readings (unit_id, reading_date, mileage) values ('00000000-0000-0000-0000-000000180101', '2031-05-01', 1000)$$,
  'staff record a first reading');
select lives_ok($$insert into public.mileage_readings (id, unit_id, reading_date, mileage) values ('00000000-0000-0000-0000-000000180301', '00000000-0000-0000-0000-000000180101', '2031-05-10', 1500)$$,
  'staff record a later, higher reading');
select throws_ok($$insert into public.mileage_readings (unit_id, reading_date, mileage) values ('00000000-0000-0000-0000-000000180101', '2031-05-05', 1600)$$,
  '23514', null, 'a back-dated reading higher than a later reading is rejected');
select lives_ok($$insert into public.mileage_readings (id, unit_id, reading_date, mileage) values ('00000000-0000-0000-0000-000000180302', '00000000-0000-0000-0000-000000180101', '2031-05-05', 1200)$$,
  'a back-dated reading between its neighbours is accepted');
select throws_ok($$insert into public.mileage_readings (unit_id, reading_date, mileage) values ('00000000-0000-0000-0000-000000180101', '2031-05-12', 1400)$$,
  '23514', null, 'a reading lower than the previous reading is still rejected');
select throws_ok($$update public.mileage_readings set mileage = 1700 where id = '00000000-0000-0000-0000-000000180302'$$,
  '23514', null, 'a reading cannot be edited above the next later reading');
select lives_ok($$update public.mileage_readings set mileage = 1500 where id = '00000000-0000-0000-0000-000000180301'$$,
  'a reading can be saved again with its own value');
select is((select current_mileage from public.units where id = '00000000-0000-0000-0000-000000180101'), 1500,
  'the unit''s current mileage is the highest reading');
reset role;

select finish();
rollback;
