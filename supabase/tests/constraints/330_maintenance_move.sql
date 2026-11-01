begin;
select plan(20);

-- Feature 011 (research R3, contracts/database.md migration 2): the name mapping, the move of parts
-- and tires into expenses, its idempotency, and the per-unit self-check. The test calls the same
-- functions the migration calls, so it cannot drift from the migration.

select is_empty($$
  select v.name from (values
    ('changeoil','change_oil'), ('Oil change','change_oil'), ('Engine oil','change_oil'), ('OIL','change_oil'), ('Motor oil','change_oil'),
    ('Front tire','front_tire'), ('front tyre','front_tire'), ('Rear tire','rear_tire'), ('rear-tyre','rear_tire'),
    ('Engine sprocket','engine_sprocket'), ('Sprocket (engine)','engine_sprocket'), ('Front sprocket','engine_sprocket'), ('Drive sprocket','engine_sprocket'),
    ('Chain','chain'), ('Drive chain','chain'),
    ('Rear sprocket','rear_sprocket'), ('Sprocket rear','rear_sprocket'), ('Driven sprocket','rear_sprocket'),
    ('Battery','battery'),
    ('Brake pads','others'), ('Spark plug','others'), ('Rear left tire (Dunlop)','others'), ('','others')
  ) v(name, expected)
  where public.maintenance_category_for(v.name) <> v.expected::public.expense_category$$,
  'every documented variant maps to its category, and anything else to Others');
select ok(public.maintenance_category_for(null) = 'others', 'a missing name maps to Others');
select ok(not has_function_privilege('authenticated', 'public.maintenance_category_for(text)', 'execute')
  and not has_function_privilege('authenticated', 'public.move_maintenance_into_expenses()', 'execute')
  and not has_function_privilege('authenticated', 'public.verify_maintenance_move(uuid)', 'execute'),
  'the move functions are migration-only');

-- Fixtures, written as the migration role (parts and tires are read-only for app users).
select set_config('request.jwt.claims', '', true);
insert into public.units (id, body_number, plate_number, make_model)
values ('00000000-0000-0000-0000-000000330101', 'MOV-330-A', 'MOV330A', 'Test Tricycle');
insert into public.part_replacements (id, unit_id, part_name, cost_centavos, replaced_on, replacement_mileage, next_due_date, notes, deleted_at)
values
  ('00000000-0000-0000-0000-000000330201', '00000000-0000-0000-0000-000000330101', 'Engine oil', 45000, '2026-09-01', 1200, '2026-12-01', 'Shell', null),
  ('00000000-0000-0000-0000-000000330202', '00000000-0000-0000-0000-000000330101', 'Brake shoes', 0, '2026-09-02', null, '2027-03-01', null, null),
  ('00000000-0000-0000-0000-000000330203', '00000000-0000-0000-0000-000000330101', 'Chain', 9000, '2026-08-01', null, '2027-01-01', null, now());
insert into public.tire_installations (id, unit_id, position, brand, installed_on, installed_mileage, cost_centavos, next_due_date)
values
  ('00000000-0000-0000-0000-000000330301', '00000000-0000-0000-0000-000000330101', 'front', 'IRC', '2026-09-03', 1300, 120000, '2027-09-03'),
  ('00000000-0000-0000-0000-000000330302', '00000000-0000-0000-0000-000000330101', 'rear_left', 'Dunlop', '2026-09-04', null, 110000, '2027-09-04');

select is(public.move_maintenance_into_expenses(), 4, 'the four current parts and tires are moved; the deleted part is not');

select is((select row(category, custom_category, expense_date, replaced_date, amount_centavos, needs_review)::text
  from public.expenses where source_id = '00000000-0000-0000-0000-000000330201'),
  '(change_oil,,2026-09-01,2026-09-01,45000,f)', 'a matching part becomes that category with both dates set');
select is((select row(source_table, idempotency_key, category_id)::text from public.expenses where source_id = '00000000-0000-0000-0000-000000330201'),
  '(part_replacements,00000000-0000-0000-0000-000000330201,)', 'a moved part keeps its origin and uses its id as the idempotency key');
select is((select notes from public.expenses where source_id = '00000000-0000-0000-0000-000000330201'),
  'Shell · 1200 km · Next due 2026-12-01', 'the mileage and next-due values are kept in the notes');
select is((select row(category, custom_category, replaced_date, amount_centavos, needs_review)::text
  from public.expenses where source_id = '00000000-0000-0000-0000-000000330202'),
  '(others,"Brake shoes",,0,t)', 'an unmatched part becomes Others with its name; a ₱0 part is marked for review');
select is((select category::text from public.expenses where source_id = '00000000-0000-0000-0000-000000330301'), 'front_tire', 'a front tire becomes Front Tire');
select is((select category::text from public.expenses where source_id = '00000000-0000-0000-0000-000000330302'), 'rear_tire', 'a rear tire becomes Rear Tire');
select is((select replaced_date from public.expenses where source_id = '00000000-0000-0000-0000-000000330302'), '2026-09-04'::date, 'a tire uses its install date as the date replaced');
select ok((select notes from public.expenses where source_id = '00000000-0000-0000-0000-000000330302') like 'Rear left · Dunlop%', 'the tire position and brand are kept in the notes');
select is_empty($$select 1 from public.expenses where source_id = '00000000-0000-0000-0000-000000330203'$$, 'a soft-deleted part is not moved');
select is((select count(*) from public.part_replacements where unit_id = '00000000-0000-0000-0000-000000330101'), 3::bigint, 'the original parts are kept');

-- Idempotent.
select is(public.move_maintenance_into_expenses(), 0, 'running the move again inserts nothing');
select is((select count(*) from public.expenses where unit_id = '00000000-0000-0000-0000-000000330101'), 4::bigint, 'no duplicates after a re-run');

-- Self-check.
select lives_ok($$select public.verify_maintenance_move('00000000-0000-0000-0000-000000330101')$$, 'the per-unit check passes after the move');
update public.expenses set amount_centavos = 46000 where source_id = '00000000-0000-0000-0000-000000330201';
select throws_ok($$select public.verify_maintenance_move('00000000-0000-0000-0000-000000330101')$$, 'P0001', null, 'a changed peso total fails the check');
update public.expenses set amount_centavos = 45000 where source_id = '00000000-0000-0000-0000-000000330201';
insert into public.part_replacements (unit_id, part_name, cost_centavos, replaced_on, next_due_date)
values ('00000000-0000-0000-0000-000000330101', 'Spark plug', 500, '2026-09-05', '2027-09-05');
select throws_ok($$select public.verify_maintenance_move('00000000-0000-0000-0000-000000330101')$$, 'P0001', null, 'a part that was not moved fails the check');
select is(public.move_maintenance_into_expenses(), 1, 'moving again picks up only the new part');

select finish();
rollback;
