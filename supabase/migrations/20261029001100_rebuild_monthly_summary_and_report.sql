-- FR-026 / FR-029 / SC-004 / T102: rebuild the monthly unit summary shared by the dashboard and
-- the CSV report. The old function returned a literal 0 for outstanding and net income, counted
-- payments by the remittance's service date, had no plate number, credit or per-category expenses,
-- and monthly_report() had no fleet total row.
--
-- Definitions (fleet time zone Asia/Manila; soft-deleted rows excluded everywhere, FR-030):
-- * remittance_due_centavos: due of the unit's remittances whose service_date is in the month.
-- * remittance_paid_centavos: payments received in the month (paid_at, as a Manila date, in the
--   month) for the unit's active remittances, whatever their service date (spec Assumptions:
--   "payments received during the selected month").
-- * outstanding_centavos / credit_centavos: for the month's remittances, per remittance
--   greatest(due - paid, 0) and greatest(paid - due, 0) using all active payments recorded so far,
--   summed per unit (data model balance/credit).
-- * fuel / repair / registration / insurance_expense_centavos: expenses in the built-in category
--   with that system key; other_expense_centavos: every other category; total_expense_centavos:
--   all expenses dated in the month.
-- * net_income_centavos = remittance_paid_centavos - total_expense_centavos.
--
-- monthly_report(month_start, selected_unit_id) returns the same rows (one unit when
-- selected_unit_id is given) and, for a whole-fleet report, a final row with unit_id NULL,
-- body_number 'FLEET TOTAL' and the column sums (all zero for an empty month).
--
-- The return types change, so both functions are dropped and recreated. EXECUTE is granted to
-- authenticated again (lib/dashboard/queries.ts and app/api/reports/monthly call them), and both
-- keep returning no rows unless public.is_owner() is true.

drop function public.monthly_report(date, uuid);
drop function public.dashboard_monthly_unit_summary(date);

create function public.dashboard_monthly_unit_summary(month_start date)
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
  expenses_by_unit as (
    select
      e.unit_id,
      sum(e.amount_centavos) filter (where c.is_system and c.system_key = 'fuel') as fuel,
      sum(e.amount_centavos) filter (where c.is_system and c.system_key = 'repairs') as repairs,
      sum(e.amount_centavos) filter (where c.is_system and c.system_key = 'registration') as registration,
      sum(e.amount_centavos) filter (where c.is_system and c.system_key = 'insurance') as insurance,
      sum(e.amount_centavos) filter (
        where not (c.is_system and coalesce(c.system_key, '') in ('fuel', 'repairs', 'registration', 'insurance'))
      ) as other,
      sum(e.amount_centavos) as total
    from public.expenses e
    join public.expense_categories c on c.id = e.category_id
    cross join bounds b
    where e.deleted_at is null
      and e.expense_date >= b.first_day
      and e.expense_date < b.next_first_day
    group by e.unit_id
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

create function public.monthly_report(month_start date, selected_unit_id uuid default null)
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
  with unit_rows as (
    select s.*
    from public.dashboard_monthly_unit_summary(month_start) s
    where selected_unit_id is null or s.unit_id = selected_unit_id
  ),
  report as (
    select ur.*, 0 as sort_group from unit_rows ur
    union all
    select
      null::uuid,
      'FLEET TOTAL'::text,
      null::text,
      coalesce(sum(ur.remittance_due_centavos), 0)::bigint,
      coalesce(sum(ur.remittance_paid_centavos), 0)::bigint,
      coalesce(sum(ur.outstanding_centavos), 0)::bigint,
      coalesce(sum(ur.credit_centavos), 0)::bigint,
      coalesce(sum(ur.fuel_expense_centavos), 0)::bigint,
      coalesce(sum(ur.repair_expense_centavos), 0)::bigint,
      coalesce(sum(ur.registration_expense_centavos), 0)::bigint,
      coalesce(sum(ur.insurance_expense_centavos), 0)::bigint,
      coalesce(sum(ur.other_expense_centavos), 0)::bigint,
      coalesce(sum(ur.total_expense_centavos), 0)::bigint,
      coalesce(sum(ur.net_income_centavos), 0)::bigint,
      1
    from unit_rows ur
    where selected_unit_id is null and public.is_owner()
  )
  select
    r.unit_id, r.body_number, r.plate_number, r.remittance_due_centavos, r.remittance_paid_centavos,
    r.outstanding_centavos, r.credit_centavos, r.fuel_expense_centavos, r.repair_expense_centavos,
    r.registration_expense_centavos, r.insurance_expense_centavos, r.other_expense_centavos,
    r.total_expense_centavos, r.net_income_centavos
  from report r
  order by r.sort_group, r.body_number, r.unit_id;
$$;

grant execute on function public.dashboard_monthly_unit_summary(date) to authenticated;
grant execute on function public.monthly_report(date, uuid) to authenticated;
