-- Feature 011, migration 2 of 3: move part replacements and tire installations into expenses.
-- research R3; data-model "Move mapping"; contracts/database.md "Migration 2".
--
-- Only adds rows: the originals stay unchanged (migration 3 makes them read-only). The move is
-- idempotent (unique source_table + source_id) and checks itself per unit; a mismatch raises and
-- the whole migration rolls back. Back up expenses, part_replacements and tire_installations first.

-- Keep in sync with mainCategoryFor in lib/expenses/categories.ts.
create function public.maintenance_category_for(p_name text)
returns public.expense_category
language sql
immutable
set search_path = public
as $$
  select case regexp_replace(replace(lower(coalesce(p_name, '')), '&', 'and'), '[^a-z]', '', 'g')
    when 'changeoil' then 'change_oil'
    when 'oilchange' then 'change_oil'
    when 'engineoil' then 'change_oil'
    when 'oil' then 'change_oil'
    when 'motoroil' then 'change_oil'
    when 'fronttire' then 'front_tire'
    when 'fronttyre' then 'front_tire'
    when 'reartire' then 'rear_tire'
    when 'reartyre' then 'rear_tire'
    when 'enginesprocket' then 'engine_sprocket'
    when 'sprocketengine' then 'engine_sprocket'
    when 'frontsprocket' then 'engine_sprocket'
    when 'drivesprocket' then 'engine_sprocket'
    when 'chain' then 'chain'
    when 'drivechain' then 'chain'
    when 'rearsprocket' then 'rear_sprocket'
    when 'sprocketrear' then 'rear_sprocket'
    when 'drivensprocket' then 'rear_sprocket'
    when 'battery' then 'battery'
    else 'others'
  end::public.expense_category;
$$;

revoke execute on function public.maintenance_category_for(text) from public, anon, authenticated;

-- Returns the number of expenses inserted (0 on a re-run).
create function public.move_maintenance_into_expenses()
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_parts integer;
  v_tires integer;
begin
  insert into public.expenses (
    unit_id, category, custom_category, expense_date, replaced_date, amount_centavos, notes,
    needs_review, source_table, source_id, idempotency_key, created_at, created_by
  )
  select
    p.unit_id,
    m.category,
    case when m.category = 'others' then left(regexp_replace(trim(p.part_name), '\s+', ' ', 'g'), 80) end,
    p.replaced_on,
    case when m.category <> 'others' then p.replaced_on end,
    p.cost_centavos,
    nullif(concat_ws(' · ',
      nullif(trim(p.notes), ''),
      p.replacement_mileage || ' km',
      'Next due ' || p.next_due_date,
      'Next due ' || p.next_due_mileage || ' km'), ''),
    p.cost_centavos = 0,
    'part_replacements',
    p.id,
    p.id,
    p.created_at,
    p.created_by
  from public.part_replacements p
  cross join lateral (select public.maintenance_category_for(p.part_name) as category) m
  where p.deleted_at is null
  on conflict (source_table, source_id) where source_table is not null do nothing;
  get diagnostics v_parts = row_count;

  insert into public.expenses (
    unit_id, category, custom_category, expense_date, replaced_date, amount_centavos, notes,
    needs_review, source_table, source_id, idempotency_key, created_at, created_by
  )
  select
    t.unit_id,
    case when t.position = 'front' then 'front_tire' else 'rear_tire' end::public.expense_category,
    null,
    t.installed_on,
    t.installed_on,
    t.cost_centavos,
    concat_ws(' · ',
      case t.position when 'front' then 'Front' when 'rear_left' then 'Rear left' else 'Rear right' end,
      nullif(trim(t.brand), ''),
      t.installed_mileage || ' km',
      'Next due ' || t.next_due_date,
      'Next due ' || t.next_due_mileage || ' km'),
    t.cost_centavos = 0,
    'tire_installations',
    t.id,
    t.id,
    t.created_at,
    t.created_by
  from public.tire_installations t
  where t.deleted_at is null
  on conflict (source_table, source_id) where source_table is not null do nothing;
  get diagnostics v_tires = row_count;

  return v_parts + v_tires;
end;
$$;

revoke execute on function public.move_maintenance_into_expenses() from public, anon, authenticated;

-- FR-039 / SC-002: per unit, moved rows must match the non-deleted originals in count and pesos.
-- p_unit_id limits the check to one unit (pgTAP); the migration checks every unit.
create function public.verify_maintenance_move(p_unit_id uuid default null)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  r record;
begin
  for r in
    with sources as (
      select unit_id, count(*) as n, sum(cost_centavos) as total
      from (
        select unit_id, cost_centavos from public.part_replacements where deleted_at is null
        union all
        select unit_id, cost_centavos from public.tire_installations where deleted_at is null
      ) s
      where p_unit_id is null or unit_id = p_unit_id
      group by unit_id
    ),
    moved as (
      select unit_id, count(*) as n, sum(amount_centavos) as total
      from public.expenses
      where source_table is not null and (p_unit_id is null or unit_id = p_unit_id)
      group by unit_id
    )
    select coalesce(s.unit_id, m.unit_id) as unit_id,
           coalesce(s.n, 0) as source_count, coalesce(m.n, 0) as moved_count,
           coalesce(s.total, 0) as source_total, coalesce(m.total, 0) as moved_total
    from sources s
    full join moved m on m.unit_id = s.unit_id
    where coalesce(s.n, 0) <> coalesce(m.n, 0) or coalesce(s.total, 0) <> coalesce(m.total, 0)
  loop
    raise exception using errcode = 'P0001',
      message = format('Maintenance move check failed for unit %s: %s sources / %s expenses, %s / %s centavos',
        r.unit_id, r.source_count, r.moved_count, r.source_total, r.moved_total);
  end loop;
end;
$$;

revoke execute on function public.verify_maintenance_move(uuid) from public, anon, authenticated;

select public.move_maintenance_into_expenses();
select public.verify_maintenance_move();
