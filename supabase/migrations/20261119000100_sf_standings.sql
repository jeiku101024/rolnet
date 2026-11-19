-- Feature 019 (page-level report downloads): the Sinking fund monthly standings workbook.
--
-- sf_standings(p_as_of) returns one row per active participant who had joined by p_as_of, with savings, open or
-- overdue loan principal, and the unpaid balance (interest included) as the ledger stood at the end of p_as_of.
-- sf_participant_summaries(p_as_of) only dates the savings; its loans are always "now", so a past month needs this.
--
-- Owner only (it lists every participant's savings and loans, like the distribution details). The fleet date uses
-- the same time zone as sf_today(): the sf_settings row, Asia/Manila by default. Voided rows never count.

create or replace function public.sf_standings(p_as_of date)
returns table (
  participant_id uuid,
  name text,
  savings_centavos bigint,
  loans_centavos bigint,
  balance_to_pay_centavos bigint,
  has_overdue boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.require_owner();
  if p_as_of is null then
    raise exception using errcode = 'P0001', message = 'Choose the date for the standings.';
  end if;
  return query
  select
    p.id,
    p.name,
    public.sf_savings_total(p.id, p_as_of),
    coalesce(sum(o.principal_centavos), 0)::bigint,
    coalesce(sum(o.balance_centavos), 0)::bigint,
    coalesce(bool_or(o.due_date < p_as_of), false)
  from public.sf_participants p
  left join lateral (
    -- Loans open on p_as_of: made by then, not withdrawn by then, and still owing after the payments dated by then.
    select
      l.amount_centavos as principal_centavos,
      l.due_date,
      (l.amount_due_centavos - coalesce(pay.paid, 0))::bigint as balance_centavos
    from public.sf_transactions l
    left join lateral (
      select sum(x.interest_part_centavos + x.principal_part_centavos) as paid
      from public.sf_transactions x
      where x.loan_id = l.id and x.type = 'payment' and x.voided_at is null and x.tx_date <= p_as_of
    ) pay on true
    where l.participant_id = p.id and l.type = 'loan' and l.voided_at is null and l.tx_date <= p_as_of
      and not exists (
        select 1 from public.sf_transactions w
        where w.loan_id = l.id and w.type = 'loan_withdrawal' and w.voided_at is null and w.tx_date <= p_as_of
      )
      and l.amount_due_centavos - coalesce(pay.paid, 0) > 0
  ) o on true
  where p.archived_at is null and p.deleted_at is null
    and (p.created_at at time zone coalesce((select s.timezone from public.sf_settings s limit 1), 'Asia/Manila'))::date <= p_as_of
  group by p.id, p.name
  order by p.name;
end;
$$;

revoke all on function public.sf_standings(date) from public, anon, authenticated;
grant execute on function public.sf_standings(date) to authenticated;
