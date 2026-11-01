begin;
select plan(30);

-- Feature 011 (contracts/database.md migration 1): fixed expense categories, the shape and amount
-- checks, normalize_expense(), the new indexes, and the rebuilt monthly summary.

insert into auth.users (id, email, aud, role)
values
  ('00000000-0000-0000-0000-000000320001', 'fixed-owner@rolnet.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000320002', 'fixed-staff@rolnet.test', 'authenticated', 'authenticated');
update public.profiles
set role = 'owner', account_status = 'approved', approved_at = now(), approved_by = user_id
where user_id = '00000000-0000-0000-0000-000000320001';
update public.profiles
set account_status = 'approved', approved_at = now(), approved_by = '00000000-0000-0000-0000-000000320001'
where user_id = '00000000-0000-0000-0000-000000320002';
insert into public.units (id, body_number, plate_number, make_model)
values ('00000000-0000-0000-0000-000000320101', 'FIX-320-A', 'FIX320A', 'Test Tricycle');

-- Enum order is the display order (FR-009).
select is(enum_range(null::public.expense_category)::text[],
  array['change_oil','front_tire','rear_tire','engine_sprocket','chain','rear_sprocket','battery','others'],
  'the categories are the 7 main parts in client order, then Others');

-- Shape check (as the migration role; the constraint applies to everyone).
select set_config('request.jwt.claims', '', true);
select lives_ok($$insert into public.expenses (unit_id, category, custom_category, expense_date, amount_centavos, idempotency_key)
  values ('00000000-0000-0000-0000-000000320101', 'others', 'Brake pads', '2033-01-05', 100, gen_random_uuid())$$, 'Others with a name and no date replaced is accepted');
select throws_ok($$insert into public.expenses (unit_id, category, custom_category, expense_date, replaced_date, amount_centavos, idempotency_key)
  values ('00000000-0000-0000-0000-000000320101', 'others', 'Brake pads', '2033-01-05', '2033-01-05', 100, gen_random_uuid())$$, '23514', null, 'Others cannot have a date replaced');
select throws_ok($$insert into public.expenses (unit_id, category, expense_date, amount_centavos, idempotency_key)
  values ('00000000-0000-0000-0000-000000320101', 'others', '2033-01-05', 100, gen_random_uuid())$$, '23514', null, 'Others needs a category name');
select throws_ok($$insert into public.expenses (unit_id, category, custom_category, expense_date, amount_centavos, idempotency_key)
  values ('00000000-0000-0000-0000-000000320101', 'others', '   ', '2033-01-05', 100, gen_random_uuid())$$, '23514', null, 'a blank category name is rejected');
select throws_ok($$insert into public.expenses (unit_id, category, custom_category, expense_date, amount_centavos, idempotency_key)
  values ('00000000-0000-0000-0000-000000320101', 'others', repeat('x', 81), '2033-01-05', 100, gen_random_uuid())$$, '23514', null, 'a category name over 80 characters is rejected');
select lives_ok($$insert into public.expenses (unit_id, category, expense_date, replaced_date, amount_centavos, idempotency_key)
  values ('00000000-0000-0000-0000-000000320101', 'chain', '2033-01-05', '2033-01-04', 100, gen_random_uuid())$$, 'a main category with a date replaced is accepted');
select throws_ok($$insert into public.expenses (unit_id, category, expense_date, amount_centavos, idempotency_key)
  values ('00000000-0000-0000-0000-000000320101', 'chain', '2033-01-05', 100, gen_random_uuid())$$, '23514', null, 'a main category needs a date replaced');
select throws_ok($$insert into public.expenses (unit_id, category, custom_category, expense_date, replaced_date, amount_centavos, idempotency_key)
  values ('00000000-0000-0000-0000-000000320101', 'chain', 'Chain', '2033-01-05', '2033-01-05', 100, gen_random_uuid())$$, '23514', null, 'a main category cannot have a category name');

-- Amount: ₱0 only for a migration-created row marked for review.
select lives_ok($$insert into public.expenses (id, unit_id, category, custom_category, expense_date, amount_centavos, needs_review, source_table, source_id, idempotency_key)
  values ('00000000-0000-0000-0000-000000320301', '00000000-0000-0000-0000-000000320101', 'others', 'Brake shoes', '2033-01-06', 0, true, 'part_replacements', '00000000-0000-0000-0000-000000320901', gen_random_uuid())$$,
  'the migration role can store a ₱0 row marked for review');
select throws_ok($$insert into public.expenses (unit_id, category, custom_category, expense_date, amount_centavos, idempotency_key)
  values ('00000000-0000-0000-0000-000000320101', 'others', 'Brake shoes', '2033-01-06', 0, gen_random_uuid())$$, '23514', null, 'a ₱0 row without the review mark is rejected');
select throws_ok($$insert into public.expenses (unit_id, category, custom_category, expense_date, amount_centavos, source_table, idempotency_key)
  values ('00000000-0000-0000-0000-000000320101', 'others', 'X', '2033-01-06', 100, 'part_replacements', gen_random_uuid())$$, '23514', null, 'a source table needs a source id');

-- normalize_expense() for app users.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000320002","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$insert into public.expenses (unit_id, category, custom_category, expense_date, amount_centavos, needs_review, idempotency_key)
  values ('00000000-0000-0000-0000-000000320101', 'others', 'Brake shoes', '2033-01-06', 0, true, gen_random_uuid())$$, '23514', null, 'staff cannot store a ₱0 expense, even marked for review');
insert into public.expenses (id, unit_id, category, custom_category, expense_date, amount_centavos, needs_review, source_table, source_id, idempotency_key)
values ('00000000-0000-0000-0000-000000320302', '00000000-0000-0000-0000-000000320101', 'others', '  Brake   pads ', '2033-01-07', 500, true, 'part_replacements', gen_random_uuid(), gen_random_uuid());
select is((select custom_category from public.expenses where id = '00000000-0000-0000-0000-000000320302'), 'Brake pads', 'the category name is trimmed and its spaces collapsed');
select is((select row(needs_review, source_table, source_id)::text from public.expenses where id = '00000000-0000-0000-0000-000000320302'), '(f,,)', 'staff cannot mark an expense for review or as moved');
update public.expenses set source_table = null, source_id = null, notes = 'edited' where id = '00000000-0000-0000-0000-000000320301';
select is((select source_table from public.expenses where id = '00000000-0000-0000-0000-000000320301'), 'part_replacements', 'staff cannot change where a moved expense came from');
select is((select needs_review from public.expenses where id = '00000000-0000-0000-0000-000000320301'), true, 'a ₱0 moved expense stays marked until it gets an amount');
update public.expenses set amount_centavos = 25000 where id = '00000000-0000-0000-0000-000000320301';
select is((select needs_review from public.expenses where id = '00000000-0000-0000-0000-000000320301'), false, 'saving a real amount clears the review mark');
select lives_ok($$insert into public.expenses (unit_id, category, expense_date, replaced_date, amount_centavos, idempotency_key)
  values ('00000000-0000-0000-0000-000000320101', 'battery', '2040-01-01', '2040-01-01', 100, gen_random_uuid())$$,
  'the database accepts future dates; the app validation rejects them (research R5 note)');
reset role;

-- Backfill: every expense has a category, and old ones keep their category name.
select is_empty($$select 1 from public.expenses where category is null$$, 'every expense has a fixed category');
select is_empty($$select 1 from public.expenses e join public.expense_categories c on c.id = e.category_id
  where e.category <> 'others' or e.custom_category is distinct from left(regexp_replace(trim(c.name), '\s+', ' ', 'g'), 80)$$,
  'older expenses became Others with their old category name');

-- Indexes (research R16).
select has_index('public', 'expenses', 'expenses_date_idx', 'expenses are indexed by date');
select has_index('public', 'expenses', 'expenses_category_date_idx', 'expenses are indexed by category and date');
select has_index('public', 'expenses', 'expenses_unit_category_replaced_idx', 'last replaced dates are indexed per unit');
select has_index('public', 'expenses', 'expenses_source_unique', 'moved records are unique per source');
select hasnt_index('public', 'expenses', 'expenses_category_idx', 'the old category index is gone');

-- Monthly summary counts expenses without an old category (research R10).
select set_config('request.jwt.claims', '', true);
insert into public.units (id, body_number, plate_number, make_model)
values ('00000000-0000-0000-0000-000000320102', 'FIX-320-B', 'FIX320B', 'Test Tricycle');
insert into public.expenses (unit_id, category, custom_category, expense_date, replaced_date, amount_centavos, idempotency_key)
values
  ('00000000-0000-0000-0000-000000320102', 'change_oil', null, '2033-02-03', '2033-02-03', 1000, gen_random_uuid()),
  ('00000000-0000-0000-0000-000000320102', 'others', 'Wash', '2033-02-04', null, 500, gen_random_uuid());
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000320001","role":"authenticated"}', true);
set local role authenticated;
select is((select total_expense_centavos from public.dashboard_monthly_unit_summary('2033-02-01') where unit_id = '00000000-0000-0000-0000-000000320102'), 1500::bigint, 'the summary total includes expenses with no old category');
select is((select repair_expense_centavos from public.dashboard_monthly_unit_summary('2033-02-01') where unit_id = '00000000-0000-0000-0000-000000320102'), 1000::bigint, 'main categories count as repairs');
select is((select other_expense_centavos from public.dashboard_monthly_unit_summary('2033-02-01') where unit_id = '00000000-0000-0000-0000-000000320102'), 500::bigint, 'new Others count as other');
reset role;

select ok(not has_function_privilege('authenticated', 'public.normalize_expense()', 'execute'), 'normalize_expense is trigger-only');

select finish();
rollback;
