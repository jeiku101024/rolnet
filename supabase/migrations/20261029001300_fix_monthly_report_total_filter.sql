-- Follow-up to 20261029001100: the FLEET TOTAL row's conditions were in WHERE, but an aggregate
-- without GROUP BY always returns one row, so one-unit reports and non-owners still received a
-- (zero) total row. The conditions move to HAVING. Same signature and return type, so
-- create or replace keeps the EXECUTE grant to authenticated.

create or replace function public.monthly_report(month_start date, selected_unit_id uuid default null)
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
    having selected_unit_id is null and public.is_owner()
  )
  select
    r.unit_id, r.body_number, r.plate_number, r.remittance_due_centavos, r.remittance_paid_centavos,
    r.outstanding_centavos, r.credit_centavos, r.fuel_expense_centavos, r.repair_expense_centavos,
    r.registration_expense_centavos, r.insurance_expense_centavos, r.other_expense_centavos,
    r.total_expense_centavos, r.net_income_centavos
  from report r
  order by r.sort_group, r.body_number, r.unit_id;
$$;
