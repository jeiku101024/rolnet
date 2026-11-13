-- Feature 015 (specs/015-sinking-fund), migration 3 of 3: read-model functions.
--
-- Totals, rankings, and the six-month chart are computed in SQL because PostgREST caps responses at
-- 1,000 rows and the Worker has a small CPU budget (research R5). They are security definer so they can
-- use the internal savings helpers (invoker functions cannot call ungranted helpers), and each one checks
-- is_approved_user() first, so they return nothing to anyone who could not read the tables.
-- All of them are stable and read only non-voided rows.

create or replace function public.sf_savings_at(p_participant uuid, p_as_of date default null)
returns bigint
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.sf_require_approved();
  return public.sf_savings_total(p_participant, p_as_of);
end;
$$;

-- Fund-wide totals. p_from and p_to limit only "payments received"; every other figure is as of now.
create or replace function public.sf_fund_summary(p_from date default null, p_to date default null)
returns table (
  total_savings_centavos bigint,
  loans_outstanding_centavos bigint,
  open_loan_count integer,
  balance_to_collect_centavos bigint,
  payments_received_centavos bigint,
  interest_collected_centavos bigint,
  interest_distributed_centavos bigint,
  interest_available_centavos bigint,
  interest_expected_centavos bigint,
  participant_count integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.sf_require_approved();
  return query
  select
    coalesce((select sum(public.sf_savings_delta(t)) from public.sf_transactions t where t.voided_at is null), 0)::bigint,
    coalesce((select sum(l.principal_centavos) from public.sf_loans_v l where l.status = 'open'), 0)::bigint,
    (select count(*) from public.sf_loans_v l where l.status = 'open')::integer,
    coalesce((select sum(l.balance_centavos) from public.sf_loans_v l where l.status = 'open'), 0)::bigint,
    coalesce((select sum(t.amount_centavos) from public.sf_transactions t
              where t.type = 'payment' and t.voided_at is null
                and (p_from is null or t.tx_date >= p_from) and (p_to is null or t.tx_date <= p_to)), 0)::bigint,
    coalesce((select sum(t.interest_part_centavos) from public.sf_transactions t where t.type = 'payment' and t.voided_at is null), 0)::bigint,
    coalesce((select sum(d.total_distributed_centavos) from public.sf_distributions d where d.voided_at is null), 0)::bigint,
    public.sf_fund_total(null),
    coalesce((select sum(l.unpaid_interest_centavos) from public.sf_loans_v l where l.status = 'open'), 0)::bigint,
    (select count(*) from public.sf_participants p where p.archived_at is null and p.deleted_at is null)::integer;
end;
$$;

-- One row per active participant for the cards, the donut chart, and the Participants summary.
create or replace function public.sf_participant_summaries(p_as_of date default null)
returns table (
  participant_id uuid,
  name text,
  driver_id uuid,
  savings_centavos bigint,
  loans_centavos bigint,
  balance_to_pay_centavos bigint,
  has_overdue boolean,
  last_transaction_date date,
  interest_shares_centavos bigint,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.sf_require_approved();
  return query
  select
    p.id,
    p.name,
    p.driver_id,
    public.sf_savings_total(p.id, p_as_of),
    coalesce((select sum(l.principal_centavos) from public.sf_loans_v l where l.participant_id = p.id and l.status = 'open'), 0)::bigint,
    coalesce((select sum(l.balance_centavos) from public.sf_loans_v l where l.participant_id = p.id and l.status = 'open'), 0)::bigint,
    coalesce((select bool_or(l.overdue) from public.sf_loans_v l where l.participant_id = p.id), false),
    (select max(t.tx_date) from public.sf_transactions t where t.participant_id = p.id and t.voided_at is null),
    coalesce((select sum(t.amount_centavos) from public.sf_transactions t where t.participant_id = p.id and t.type = 'interest_share' and t.voided_at is null), 0)::bigint,
    p.updated_at
  from public.sf_participants p
  where p.archived_at is null and p.deleted_at is null
  order by p.name;
end;
$$;

-- Ranking amounts for active participants. p_rank_by 'savings': savings at the end of p_end (now when null).
-- 'deposits': the sum of deposits dated from p_start to p_end (null means no limit). Ties are ranked in the app.
create or replace function public.sf_ranking(p_rank_by text, p_start date default null, p_end date default null)
returns table (participant_id uuid, name text, driver_id uuid, amount_centavos bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.sf_require_approved();
  if p_rank_by not in ('savings', 'deposits') then
    raise exception using errcode = 'P0001', message = 'Rank by savings or deposits.';
  end if;
  return query
  select
    p.id,
    p.name,
    p.driver_id,
    case when p_rank_by = 'savings'
      then public.sf_savings_total(p.id, p_end)
      else coalesce((select sum(t.amount_centavos) from public.sf_transactions t
                     where t.participant_id = p.id and t.type = 'deposit' and t.voided_at is null
                       and (p_start is null or t.tx_date >= p_start) and (p_end is null or t.tx_date <= p_end)), 0)::bigint
    end
  from public.sf_participants p
  where p.archived_at is null and p.deleted_at is null
  order by p.name;
end;
$$;

-- Deposits, loans, and payments per month for the last p_months months (all participants, archived included).
create or replace function public.sf_monthly_flows(p_months integer default 6)
returns table (month date, deposits_centavos bigint, loans_centavos bigint, payments_centavos bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.sf_require_approved();
  if p_months is null or p_months < 1 or p_months > 36 then
    raise exception using errcode = 'P0001', message = 'Choose between 1 and 36 months.';
  end if;
  return query
  select
    m.month_start::date,
    coalesce(sum(t.amount_centavos) filter (where t.type = 'deposit'), 0)::bigint,
    coalesce(sum(t.amount_centavos) filter (where t.type = 'loan'), 0)::bigint,
    coalesce(sum(t.amount_centavos) filter (where t.type = 'payment'), 0)::bigint
  from generate_series(
         date_trunc('month', public.sf_today()::timestamp) - ((p_months - 1) * interval '1 month'),
         date_trunc('month', public.sf_today()::timestamp),
         interval '1 month') as m(month_start)
  left join public.sf_transactions t
    on t.voided_at is null
   and t.type in ('deposit', 'loan', 'payment')
   and t.tx_date >= m.month_start::date
   and t.tx_date < (m.month_start + interval '1 month')::date
  group by m.month_start
  order by m.month_start;
end;
$$;

create or replace function public.sf_distribution_history()
returns table (
  id uuid, dist_date date, available_before_centavos bigint, per_participant_centavos bigint,
  participant_count integer, total_distributed_centavos bigint, remainder_centavos bigint,
  notes text, voided_at timestamptz, void_reason text, updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.sf_require_approved();
  return query
  select d.id, d.dist_date, d.available_before_centavos, d.per_participant_centavos, d.participant_count,
         d.total_distributed_centavos, d.remainder_centavos, d.notes, d.voided_at, d.void_reason, d.updated_at
  from public.sf_distributions d
  order by d.dist_date desc, d.created_at desc;
end;
$$;

revoke all on function
  public.sf_savings_at(uuid, date), public.sf_fund_summary(date, date), public.sf_participant_summaries(date),
  public.sf_ranking(text, date, date), public.sf_monthly_flows(integer), public.sf_distribution_history()
from public, anon, authenticated;

grant execute on function
  public.sf_savings_at(uuid, date), public.sf_fund_summary(date, date), public.sf_participant_summaries(date),
  public.sf_ranking(text, date, date), public.sf_monthly_flows(integer), public.sf_distribution_history()
to authenticated;
