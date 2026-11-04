-- Feature 014: the yearly report needs one row per unit and month. A year of daily rows for about 100 units is
-- about 36,500 rows (37 PostgREST pages), so the totals are added up in the database instead.
--
-- security invoker: row level security on remittances and expenses decides what the caller sees. The function
-- is read-only and takes no unit filter; the app filters one unit in memory.

create or replace function public.report_unit_month_totals(p_from date, p_to date)
returns table (
  unit_id uuid,
  month date,
  rental_centavos bigint,
  allowance_centavos bigint,
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
         coalesce(r.rental, 0)::bigint, coalesce(r.allowance, 0)::bigint, coalesce(r.n, 0)::integer, coalesce(e.expense, 0)::bigint
  from r full outer join e on e.unit_id = r.unit_id and e.month = r.month
  order by 1, 2;
$$;

-- New public functions start with no EXECUTE for anon or authenticated. The app calls this one.
revoke all on function public.report_unit_month_totals(date, date) from public, anon, authenticated;
grant execute on function public.report_unit_month_totals(date, date) to authenticated;
