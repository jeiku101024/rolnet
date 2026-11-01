begin;
select plan(16);

-- Feature 011 (contracts/database.md): staff record and edit expenses with the fixed categories;
-- only the owner deletes (soft delete, stale-checked, audited); parts, tires and the old category
-- list are read-only for everyone.

insert into auth.users (id, email, aud, role)
values
  ('00000000-0000-0000-0000-000000226001', 'merge-owner@rolnet.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000226002', 'merge-staff@rolnet.test', 'authenticated', 'authenticated');
update public.profiles
set role = 'owner', account_status = 'approved', approved_at = now(), approved_by = user_id
where user_id = '00000000-0000-0000-0000-000000226001';
update public.profiles
set account_status = 'approved', approved_at = now(), approved_by = '00000000-0000-0000-0000-000000226001'
where user_id = '00000000-0000-0000-0000-000000226002';
insert into public.units (id, body_number, plate_number, make_model)
values ('00000000-0000-0000-0000-000000226101', 'MRG-226-A', 'MRG226A', 'Test Tricycle');
insert into public.part_replacements (id, unit_id, part_name, cost_centavos, replaced_on, next_due_date)
values ('00000000-0000-0000-0000-000000226201', '00000000-0000-0000-0000-000000226101', 'Oil filter', 35000, '2031-04-01', '2031-07-01');
insert into public.tire_installations (id, unit_id, position, brand, installed_on, cost_centavos, next_due_date)
values ('00000000-0000-0000-0000-000000226301', '00000000-0000-0000-0000-000000226101', 'front', 'Test Tire', '2031-04-01', 120000, '2032-04-01');

-- Approved staff.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000226002","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$insert into public.expenses (id, unit_id, category, expense_date, replaced_date, amount_centavos, idempotency_key)
  values ('00000000-0000-0000-0000-000000226401', '00000000-0000-0000-0000-000000226101', 'chain', '2031-05-01', '2031-05-01', 35000, gen_random_uuid())$$,
  'staff record a main-category expense');
select lives_ok($$update public.expenses set category = 'others', custom_category = 'Brake pads', replaced_date = null
  where id = '00000000-0000-0000-0000-000000226401'$$, 'staff change an expense to Others');
select throws_ok($$update public.expenses set deleted_at = now() where id = '00000000-0000-0000-0000-000000226401'$$,
  '42501', null, 'staff cannot delete an expense');
select throws_ok($$select public.soft_delete_record('expenses', '00000000-0000-0000-0000-000000226401')$$,
  '42501', null, 'staff cannot call the owner delete');
select throws_ok($$insert into public.part_replacements (unit_id, part_name, cost_centavos, replaced_on, next_due_date)
  values ('00000000-0000-0000-0000-000000226101', 'Chain', 100, '2031-04-01', '2031-05-01')$$, '42501', null, 'staff cannot record parts');
select throws_ok($$insert into public.tire_installations (unit_id, position, brand, installed_on, cost_centavos, next_due_date)
  values ('00000000-0000-0000-0000-000000226101', 'rear_left', 'Test Tire', '2031-04-01', 100, '2032-04-01')$$, '42501', null, 'staff cannot record tires');
select throws_ok($$insert into public.expense_categories (name) values ('Staff Category 226')$$, '42501', null, 'staff cannot add categories');
select isnt_empty($$select 1 from public.part_replacements where id = '00000000-0000-0000-0000-000000226201'$$, 'staff still read parts');
select isnt_empty($$select 1 from public.tire_installations where id = '00000000-0000-0000-0000-000000226301'$$, 'staff still read tires');
reset role;

-- Approved owner.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000226001","role":"authenticated"}', true);
set local role authenticated;
update public.part_replacements set cost_centavos = 1 where id = '00000000-0000-0000-0000-000000226201';
select is((select cost_centavos from public.part_replacements where id = '00000000-0000-0000-0000-000000226201'), 35000::bigint, 'owner edits to parts change nothing');
select throws_ok($$select public.soft_delete_record('part_replacements', '00000000-0000-0000-0000-000000226201')$$, '22023', null, 'the owner cannot delete parts');
select is(public.soft_delete_record('expenses', '00000000-0000-0000-0000-000000226401', '2000-01-01T00:00:00Z'), null::jsonb, 'a stale delete removes nothing');
select ok(public.soft_delete_record('expenses', '00000000-0000-0000-0000-000000226401',
  (select updated_at from public.expenses where id = '00000000-0000-0000-0000-000000226401')) is not null, 'the owner deletes an expense');
select is_empty($$select 1 from public.expenses where id = '00000000-0000-0000-0000-000000226401'$$, 'a deleted expense leaves every view');
select is((select count(*) from public.audit_events where entity_type = 'expenses' and entity_id = '00000000-0000-0000-0000-000000226401' and action = 'soft_delete'),
  1::bigint, 'the delete is audited once');
select is((select row(changed_fields->'before'->>'amount_centavos', changed_fields->'before'->>'category', changed_fields->'before'->>'expense_date', actor_user_id)::text
  from public.audit_events where entity_type = 'expenses' and entity_id = '00000000-0000-0000-0000-000000226401' and action = 'soft_delete'),
  '(35000,others,2031-05-01,00000000-0000-0000-0000-000000226001)', 'the audit keeps who deleted it and the deleted values');
reset role;

select finish();
rollback;
