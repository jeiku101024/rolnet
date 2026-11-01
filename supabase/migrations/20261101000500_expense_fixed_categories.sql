-- Feature 011 (merged Expenses page), migration 1 of 3: fixed expense categories.
-- research R1, R2, R4, R5, R10, R16; contracts/database.md "Migration 1".
--
-- Expenses get a fixed category (7 main parts + Others), a typed name for Others, and a date
-- replaced for main parts. Existing expenses become Others with their old category name. The old
-- category_id column and expense_categories table stay for history (migration 3 makes them read-only).

create type public.expense_category as enum (
  'change_oil', 'front_tire', 'rear_tire', 'engine_sprocket', 'chain', 'rear_sprocket', 'battery', 'others'
);

alter table public.expenses
  add column category public.expense_category,
  add column custom_category text,
  add column replaced_date date,
  add column needs_review boolean not null default false,
  add column source_table text,
  add column source_id uuid;

-- R2: every existing expense (deleted ones too, so the check holds for all rows) keeps its label.
-- Audit triggers fire for these updates as a migration (actor null); that is the record of the change.
update public.expenses e
set category = 'others',
    custom_category = left(regexp_replace(trim(c.name), '\s+', ' ', 'g'), 80)
from public.expense_categories c
where c.id = e.category_id;

alter table public.expenses
  alter column category set not null,
  alter column category_id drop not null;

alter table public.expenses
  drop constraint expenses_amount_centavos_check,
  add constraint expenses_category_shape_check check (
    (category = 'others' and custom_category is not null and length(trim(custom_category)) between 1 and 80 and replaced_date is null)
    or (category <> 'others' and custom_category is null and replaced_date is not null)
  ),
  add constraint expenses_amount_check check (amount_centavos > 0 or (amount_centavos = 0 and needs_review)),
  add constraint expenses_source_pair_check check (
    (source_table is null) = (source_id is null)
    and (source_table is null or source_table in ('part_replacements', 'tire_installations'))
  );

drop index if exists public.expenses_category_idx;
create index expenses_date_idx on public.expenses (expense_date desc) where deleted_at is null;
create index expenses_category_date_idx on public.expenses (category, expense_date desc) where deleted_at is null;
create index expenses_unit_category_replaced_idx on public.expenses (unit_id, category, replaced_date desc)
  where deleted_at is null and category <> 'others';
create unique index expenses_source_unique on public.expenses (source_table, source_id) where source_table is not null;

-- R4/R5: tidy the typed name; only migrations may create ₱0 "needs review" or "moved" rows.
-- "No future dates" is enforced by the app's validation, not here: existing pgTAP fixtures insert
-- far-future dates on purpose to stay isolated from real data (research R5).
create function public.normalize_expense()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.custom_category is not null then
    new.custom_category := regexp_replace(trim(new.custom_category), '\s+', ' ', 'g');
  end if;
  if auth.uid() is not null then
    if tg_op = 'INSERT' then
      new.needs_review := false;
      new.source_table := null;
      new.source_id := null;
    else
      new.source_table := old.source_table;
      new.source_id := old.source_id;
      if new.amount_centavos > 0 then
        new.needs_review := false;
      end if;
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.normalize_expense() from public, anon, authenticated;

create trigger expenses_normalize before insert or update on public.expenses
  for each row execute function public.normalize_expense();

-- R10: moved parts have no category_id, so the old inner join would drop them from totals.
-- Same signature and columns; main categories count as repairs, other new rows as "other".
create or replace function public.dashboard_monthly_unit_summary(month_start date)
returns table(
  unit_id uuid,
  body_number text,
  plate_number text,
  remittance_due_centavos bigint,
  remittance_paid_centavos bigint,
  outstanding_centavos bigint,
  credit_centavos bigint,
  fuel_expense_centavos bigint,
  repair_expense_centavos bigint,
  registration_expense_centavos bigint,
  insurance_expense_centavos bigint,
  other_expense_centavos bigint,
  total_expense_centavos bigint,
  net_income_centavos bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with bounds as (
    select
      date_trunc('month', month_start)::date as first_day,
      (date_trunc('month', month_start) + interval '1 month')::date as next_first_day
  ),
  month_remittances as (
    select r.unit_id, r.amount_due_centavos as due, coalesce(paid.total, 0) as paid
    from public.remittances r
    cross join bounds b
    left join lateral (
      select sum(p.amount_centavos) as total
      from public.remittance_payments p
      where p.remittance_id = r.id and p.deleted_at is null
    ) paid on true
    where r.deleted_at is null
      and r.service_date >= b.first_day
      and r.service_date < b.next_first_day
  ),
  due_by_unit as (
    select
      mr.unit_id,
      sum(mr.due) as due,
      sum(greatest(mr.due - mr.paid, 0)) as outstanding,
      sum(greatest(mr.paid - mr.due, 0)) as credit
    from month_remittances mr
    group by mr.unit_id
  ),
  paid_by_unit as (
    select r.unit_id, sum(p.amount_centavos) as paid
    from public.remittance_payments p
    join public.remittances r on r.id = p.remittance_id
    cross join bounds b
    where p.deleted_at is null
      and r.deleted_at is null
      and p.paid_at >= (b.first_day::timestamp at time zone 'Asia/Manila')
      and p.paid_at < (b.next_first_day::timestamp at time zone 'Asia/Manila')
    group by r.unit_id
  ),
  classified as (
    select
      e.unit_id,
      e.amount_centavos,
      case
        when e.category <> 'others' then 'repairs'
        when c.is_system and c.system_key in ('fuel', 'repairs', 'registration', 'insurance') then c.system_key
        else 'other'
      end as bucket
    from public.expenses e
    left join public.expense_categories c on c.id = e.category_id
    cross join bounds b
    where e.deleted_at is null
      and e.expense_date >= b.first_day
      and e.expense_date < b.next_first_day
  ),
  expenses_by_unit as (
    select
      x.unit_id,
      sum(x.amount_centavos) filter (where x.bucket = 'fuel') as fuel,
      sum(x.amount_centavos) filter (where x.bucket = 'repairs') as repairs,
      sum(x.amount_centavos) filter (where x.bucket = 'registration') as registration,
      sum(x.amount_centavos) filter (where x.bucket = 'insurance') as insurance,
      sum(x.amount_centavos) filter (where x.bucket = 'other') as other,
      sum(x.amount_centavos) as total
    from classified x
    group by x.unit_id
  )
  select
    u.id,
    u.body_number,
    u.plate_number,
    coalesce(d.due, 0)::bigint,
    coalesce(p.paid, 0)::bigint,
    coalesce(d.outstanding, 0)::bigint,
    coalesce(d.credit, 0)::bigint,
    coalesce(x.fuel, 0)::bigint,
    coalesce(x.repairs, 0)::bigint,
    coalesce(x.registration, 0)::bigint,
    coalesce(x.insurance, 0)::bigint,
    coalesce(x.other, 0)::bigint,
    coalesce(x.total, 0)::bigint,
    (coalesce(p.paid, 0) - coalesce(x.total, 0))::bigint
  from public.units u
  left join due_by_unit d on d.unit_id = u.id
  left join paid_by_unit p on p.unit_id = u.id
  left join expenses_by_unit x on x.unit_id = u.id
  where u.deleted_at is null
    and public.is_owner()
  order by u.body_number, u.id;
$$;

revoke execute on function public.dashboard_monthly_unit_summary(date) from public, anon;
grant execute on function public.dashboard_monthly_unit_summary(date) to authenticated;
