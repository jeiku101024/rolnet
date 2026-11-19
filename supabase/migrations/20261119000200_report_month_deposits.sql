-- Feature 020: the Yearly report's Deposit follows the payments actually received.
--
-- report_unit_month_totals() (20261103000200) returned rental and allowance per unit and month, and the report
-- workbook wrote Deposit as Rental - Allowance. The app's Deposit is the payments received minus the allowance
-- (remittances.deposit_centavos, kept current by trigger since 20261103000300), so an unpaid remittance showed
-- 140 in the sheet and -40 in the app. This version also returns the month's sum of that stored deposit.
--
-- create or replace function cannot change a function's output columns, so the old version is dropped first and
-- the new one created in the same migration (one transaction: nothing can call it in between). The new column is
-- appended after allowance_centavos; callers read columns by name, so they keep working. The function stays
-- security invoker, so row level security on remittances and expenses still decides what a caller sees. The
-- earlier migration is pushed and is not edited.

drop function public.report_unit_month_totals(date, date);

create function public.report_unit_month_totals(p_from date, p_to date)
returns table (
  unit_id uuid,
  month date,
  rental_centavos bigint,
  allowance_centavos bigint,
  deposit_centavos bigint,
  remittance_count integer,
  expense_centavos bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  with r as (
    select unit_id, date_trunc('month', service_date)::date as month,
           sum(amount_due_centavos)::bigint as rental,
           sum(allowance_centavos)::bigint as allowance,
           sum(deposit_centavos)::bigint as deposit,
           count(*)::integer as n
    from public.remittances
    where deleted_at is null and service_date between p_from and p_to
    group by unit_id, date_trunc('month', service_date)::date
  ), e as (
    select unit_id, date_trunc('month', expense_date)::date as month,
           sum(amount_centavos)::bigint as expense
    from public.expenses
    where deleted_at is null and expense_date between p_from and p_to
    group by unit_id, date_trunc('month', expense_date)::date
  )
  select coalesce(r.unit_id, e.unit_id), coalesce(r.month, e.month),
         coalesce(r.rental, 0)::bigint, coalesce(r.allowance, 0)::bigint, coalesce(r.deposit, 0)::bigint,
         coalesce(r.n, 0)::integer, coalesce(e.expense, 0)::bigint
  from r full outer join e on e.unit_id = r.unit_id and e.month = r.month
  order by 1, 2;
$$;

-- New public functions start with no EXECUTE for anon or authenticated. The app calls this one.
revoke all on function public.report_unit_month_totals(date, date) from public, anon, authenticated;
grant execute on function public.report_unit_month_totals(date, date) to authenticated;
