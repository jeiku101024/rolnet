-- Feature 016 (specs/016-sinking-fund-refinements), migration 2 of 2: proportional distribution and the
-- year-end close.
--
-- 1. The Interest fund is shared in proportion to savings: each ticked participant gets
--    floor(fund x their savings / ticked participants' savings), in whole centavos; the leftover stays in the fund.
-- 2. The same distribution closes the year: each ticked participant's ended total (savings plus share) is stored
--    in sf_distribution_participants and a 'cycle_close' ledger row takes their savings back to zero.
--    Loans, balance and payments are already zero because a close is refused while a ticked participant has an
--    Open or Overdue loan; "payments received" counts from the cycle start (the last year-end close date).
-- 3. Owner-only history and details reads, and the guards that keep a saved ended total true.
--
-- Nothing is deleted or edited: totals stay derived from non-voided ledger rows (015 research R2).

-- 1. Structure -------------------------------------------------------------------------------------------------

-- Legacy distributions keep their equal per-participant amount; proportional ones leave it empty.
alter table public.sf_distributions alter column per_participant_centavos drop not null;
alter table public.sf_distributions drop constraint sf_distributions_total;
alter table public.sf_distributions drop constraint sf_distributions_remainder;
alter table public.sf_distributions add constraint sf_distributions_total
  check (per_participant_centavos is null or total_distributed_centavos = per_participant_centavos * participant_count);
alter table public.sf_distributions add constraint sf_distributions_remainder
  check (remainder_centavos = available_before_centavos - total_distributed_centavos
         and remainder_centavos >= 0
         and (per_participant_centavos is null or remainder_centavos < participant_count));

-- Which columns each type uses; 'cycle_close' is shaped like 'interest_share' (it belongs to a distribution).
alter table public.sf_transactions drop constraint sf_transactions_shape;
alter table public.sf_transactions add constraint sf_transactions_shape check (
  case type
    when 'deposit' then loan_id is null and distribution_id is null and interest_rate_bp is null and interest_centavos is null
      and amount_due_centavos is null and due_date is null and interest_part_centavos is null and principal_part_centavos is null
      and interest_set_by is null and interest_waived_centavos is null
    when 'savings_withdrawal' then loan_id is null and distribution_id is null and interest_rate_bp is null and interest_centavos is null
      and amount_due_centavos is null and due_date is null and interest_part_centavos is null and principal_part_centavos is null
      and interest_set_by is null and interest_waived_centavos is null
    when 'loan' then loan_id is null and distribution_id is null and interest_rate_bp is not null and interest_centavos is not null
      and amount_due_centavos is not null and due_date is not null and interest_part_centavos is null and principal_part_centavos is null
      and interest_set_by is null and interest_waived_centavos is null
    when 'payment' then loan_id is not null and distribution_id is null and interest_rate_bp is null and interest_centavos is null
      and amount_due_centavos is null and due_date is null and interest_part_centavos is not null and principal_part_centavos is not null
      and interest_set_by is not null and interest_waived_centavos is null
    when 'loan_withdrawal' then loan_id is not null and distribution_id is null and interest_rate_bp is null and interest_centavos is null
      and amount_due_centavos is null and due_date is null and interest_part_centavos is null and principal_part_centavos is null
      and interest_set_by is null and interest_waived_centavos is not null
    when 'interest_share' then loan_id is null and distribution_id is not null and interest_rate_bp is null and interest_centavos is null
      and amount_due_centavos is null and due_date is null and interest_part_centavos is null and principal_part_centavos is null
      and interest_set_by is null and interest_waived_centavos is null
    when 'cycle_close' then loan_id is null and distribution_id is not null and interest_rate_bp is null and interest_centavos is null
      and amount_due_centavos is null and due_date is null and interest_part_centavos is null and principal_part_centavos is null
      and interest_set_by is null and interest_waived_centavos is null
  end
);

-- Effect of one row on the participant's Total savings (now including the year-end close).
create or replace function public.sf_savings_delta(t public.sf_transactions)
returns bigint
language sql
immutable
set search_path = public
as $$
  select case t.type
    when 'deposit' then t.amount_centavos
    when 'interest_share' then t.amount_centavos
    when 'payment' then t.principal_part_centavos
    when 'loan' then -t.amount_centavos
    when 'savings_withdrawal' then -t.amount_centavos
    when 'cycle_close' then -t.amount_centavos
    else 0::bigint
  end;
$$;

-- One immutable row per participant who took part in a distribution: savings before, share, ended total.
create table public.sf_distribution_participants (
  id uuid primary key default gen_random_uuid(),
  distribution_id uuid not null references public.sf_distributions(id),
  participant_id uuid not null references public.sf_participants(id),
  participant_name text not null check (char_length(btrim(participant_name)) between 1 and 120),
  savings_before_centavos bigint not null check (savings_before_centavos >= 0),
  share_centavos bigint not null check (share_centavos >= 0),
  ended_total_centavos bigint not null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id),
  constraint sf_distribution_participants_ended check (ended_total_centavos = savings_before_centavos + share_centavos),
  constraint sf_distribution_participants_unique unique (distribution_id, participant_id)
);

create index sf_distribution_participants_distribution_idx on public.sf_distribution_participants (distribution_id);

create trigger sf_distribution_participants_audit_fields before insert or update on public.sf_distribution_participants
  for each row execute function public.set_audit_fields();
create trigger sf_distribution_participants_no_hard_delete before delete on public.sf_distribution_participants
  for each row execute function public.reject_hard_delete();
create trigger sf_distribution_participants_business_audit after insert or update on public.sf_distribution_participants
  for each row execute function public.audit_business_change();

alter table public.sf_distribution_participants enable row level security;
-- Owner only: this is every participant's ended savings. Writes go through sf_distribute_interest only.
create policy sf_distribution_participants_owner_read_policy on public.sf_distribution_participants
  for select to authenticated using (public.is_owner());
revoke all on public.sf_distribution_participants from anon, authenticated;
grant select on public.sf_distribution_participants to authenticated;

-- 2. Guards ----------------------------------------------------------------------------------------------------

-- After a participant's year is closed, nothing may be dated on or before the close date (spec FR-049), so the
-- saved ended total stays true. Covers every write function, deposits included.
create or replace function public.sf_guard_closed_cycle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  closed_on date;
  participant_name text;
begin
  if new.type = 'cycle_close' then return new; end if;
  select c.tx_date, p.name into closed_on, participant_name
  from public.sf_transactions c
  join public.sf_participants p on p.id = c.participant_id
  where c.participant_id = new.participant_id and c.type = 'cycle_close' and c.voided_at is null and new.tx_date <= c.tx_date
  order by c.tx_date desc
  limit 1;
  if closed_on is not null then
    raise exception using errcode = 'P0001',
      message = format('%s''s year was closed on %s. Use a later date.', participant_name, public.sf_date_text(closed_on));
  end if;
  return new;
end;
$$;

create trigger sf_transactions_closed_cycle before insert on public.sf_transactions
  for each row execute function public.sf_guard_closed_cycle();

-- The cycle starts after the latest non-voided year-end close (a distribution with no equal per-participant
-- amount; distributions made before the close never closed a year). Null before any close.
create or replace function public.sf_cycle_start()
returns date
language sql
stable
security definer
set search_path = public
as $$ select max(d.dist_date) from public.sf_distributions d where d.voided_at is null and d.per_participant_centavos is null; $$;

-- 3. Ledger view: the running savings now count the year-end close -----------------------------------------------

create or replace view public.sf_ledger_v with (security_invoker = true) as
select
  t.id, t.participant_id, pa.name as participant_name, (pa.driver_id is not null) as participant_is_driver,
  pa.archived_at is not null as participant_archived,
  t.type, t.amount_centavos, t.tx_date, t.notes, t.loan_id, t.distribution_id,
  t.interest_rate_bp, t.interest_centavos, t.amount_due_centavos, t.due_date,
  t.interest_part_centavos, t.principal_part_centavos, t.interest_set_by, t.interest_waived_centavos,
  t.voided_at, t.void_reason, t.created_at, t.updated_at,
  lt.tx_date as loan_date,
  case when lv.overdue then 'overdue' else lv.status end as loan_status,
  lv.balance_centavos as loan_balance_centavos,
  lv.interest_paid_centavos as loan_interest_paid_centavos,
  (lv.interest_paid_centavos + lv.principal_paid_centavos)::bigint as loan_paid_centavos,
  lv.withdrawn_on as loan_withdrawn_on,
  (case when t.type = 'payment' and t.voided_at is null then
    lt.amount_due_centavos - sum(case when t.type = 'payment' and t.voided_at is null then t.amount_centavos else 0 end)
      over (partition by t.loan_id order by t.tx_date, t.created_at, t.id)
  end)::bigint as loan_balance_after_centavos,
  (case when t.voided_at is null then
    sum(case when t.voided_at is not null then 0 else
      case t.type
        when 'deposit' then t.amount_centavos
        when 'interest_share' then t.amount_centavos
        when 'payment' then t.principal_part_centavos
        when 'loan' then -t.amount_centavos
        when 'savings_withdrawal' then -t.amount_centavos
        when 'cycle_close' then -t.amount_centavos
        else 0 end end)
      over (partition by t.participant_id
            order by t.tx_date,
                     (case t.type when 'deposit' then 0 when 'interest_share' then 0 when 'payment' then 0 else 1 end),
                     t.created_at, t.id)
  end)::bigint as savings_after_centavos,
  d.dist_date as distribution_date, d.total_distributed_centavos as distribution_total_centavos,
  d.participant_count as distribution_participant_count
from public.sf_transactions t
join public.sf_participants pa on pa.id = t.participant_id
left join public.sf_transactions lt on lt.id = t.loan_id
left join public.sf_loans_v lv on lv.id = coalesce(t.loan_id, case when t.type = 'loan' then t.id end)
left join public.sf_distributions d on d.id = t.distribution_id;

-- 4. Distribute and close the year ---------------------------------------------------------------------------------

drop function public.sf_distribute_interest(date, uuid[], text, uuid);

create or replace function public.sf_distribute_interest(p_date date, p_participants uuid[], p_notes text, p_key uuid, p_expected_total bigint default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  dist_id uuid;
  ids uuid[];
  n integer;
  available bigint;
  overall bigint := 0;
  total bigint := 0;
  share bigint;
  rec record;
  offenders text;
  offender_count integer;
  late_name text;
  late_date date;
begin
  perform public.require_owner();
  perform public.sf_lock();
  if p_key is not null then
    select id into dist_id from public.sf_distributions where idempotency_key = p_key;
    if dist_id is not null then return dist_id; end if;
  end if;
  perform public.sf_check_date(p_date);
  select coalesce(array_agg(distinct x), '{}') into ids from unnest(coalesce(p_participants, '{}')) as x;
  n := coalesce(array_length(ids, 1), 0);
  if n = 0 then
    raise exception using errcode = 'P0001', message = 'Tick at least one participant.';
  end if;
  if (select count(*) from public.sf_participants where id = any(ids) and archived_at is null and deleted_at is null) <> n then
    raise exception using errcode = 'P0001', message = 'Only active participants can receive a share.';
  end if;

  -- The date cannot be before the latest activity of a ticked participant (spec FR-048).
  select p.name, max(t.tx_date) into late_name, late_date
  from public.sf_transactions t join public.sf_participants p on p.id = t.participant_id
  where t.participant_id = any(ids) and t.voided_at is null
  group by p.id, p.name
  having max(t.tx_date) > p_date
  order by max(t.tx_date) desc, p.name
  limit 1;
  if late_name is not null then
    raise exception using errcode = 'P0001',
      message = format('The distribution date cannot be before %s, when %s last had activity.', public.sf_date_text(late_date), late_name);
  end if;

  -- A close is refused while a ticked participant has an Open or Overdue loan (spec FR-034).
  select string_agg(x.name, ', ' order by x.name), count(*) into offenders, offender_count
  from (select distinct p.name from public.sf_loans_v l join public.sf_participants p on p.id = l.participant_id
        where l.participant_id = any(ids) and l.status = 'open') x;
  if offender_count > 0 then
    raise exception using errcode = 'P0001',
      message = case when offender_count = 1
        then format('%s still has an unpaid loan. Pay it or mark it as a withdrawal first.', offenders)
        else format('%s still have unpaid loans. Pay each loan or mark it as a withdrawal first.', offenders) end;
  end if;

  available := public.sf_fund_total(p_date);
  if available <= 0 then
    raise exception using errcode = 'P0001', message = 'There is no interest to distribute on this date.';
  end if;
  for rec in select public.sf_savings_total(x, p_date) as savings from unnest(ids) as x loop
    overall := overall + rec.savings;
  end loop;
  if overall <= 0 then
    raise exception using errcode = 'P0001', message = 'No ticked participant has savings.';
  end if;
  for rec in select public.sf_savings_total(x, p_date) as savings from unnest(ids) as x loop
    total := total + floor(available::numeric * rec.savings / overall)::bigint;
  end loop;
  if total <= 0 then
    raise exception using errcode = 'P0001', message = format('%s is too little to share.', public.sf_peso(available));
  end if;
  if p_expected_total is not null and p_expected_total <> total then
    raise exception using errcode = 'P0001', message = 'The figures changed. Review them and confirm again.';
  end if;

  insert into public.sf_distributions (dist_date, available_before_centavos, per_participant_centavos, participant_count, total_distributed_centavos, remainder_centavos, notes, idempotency_key)
  values (p_date, available, null, n, total, available - total, nullif(btrim(coalesce(p_notes, '')), ''), p_key)
  returning id into dist_id;

  for rec in
    select p.id, p.name, public.sf_savings_total(p.id, p_date) as savings
    from public.sf_participants p where p.id = any(ids) order by p.name
  loop
    share := floor(available::numeric * rec.savings / overall)::bigint;
    insert into public.sf_distribution_participants (distribution_id, participant_id, participant_name, savings_before_centavos, share_centavos, ended_total_centavos)
    values (dist_id, rec.id, rec.name, rec.savings, share, rec.savings + share);
    if share > 0 then
      insert into public.sf_transactions (participant_id, type, amount_centavos, tx_date, distribution_id)
      values (rec.id, 'interest_share', share, p_date, dist_id);
    end if;
    if rec.savings + share > 0 then
      insert into public.sf_transactions (participant_id, type, amount_centavos, tx_date, distribution_id, notes)
      values (rec.id, 'cycle_close', rec.savings + share, p_date, dist_id, 'Year-end close');
    end if;
  end loop;

  for rec in select x as id from unnest(ids) as x loop
    perform public.sf_assert_participant_timeline(rec.id);
  end loop;
  perform public.sf_assert_fund_timeline();
  perform public.write_audit_event('sf_distributions', dist_id, 'insert', jsonb_build_object(
    'participants', n, 'total_centavos', total, 'remainder_centavos', available - total,
    'shares', (select jsonb_agg(jsonb_build_object('participant_id', participant_id, 'share_centavos', share_centavos, 'ended_total_centavos', ended_total_centavos))
               from public.sf_distribution_participants where distribution_id = dist_id)));
  return dist_id;
end;
$$;

-- 5. Voids ------------------------------------------------------------------------------------------------------------

create or replace function public.sf_void_transaction(p_id uuid, p_reason text, p_expected_updated_at timestamptz)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  tx public.sf_transactions;
  clean_reason text := btrim(coalesce(p_reason, ''));
  closed_on date;
  participant_name text;
begin
  perform public.require_owner();
  perform public.sf_lock();
  select * into tx from public.sf_transactions where id = p_id and voided_at is null for update;
  if tx.id is null then
    raise exception using errcode = 'P0002', message = 'This transaction was not found or is already voided.';
  end if;
  if tx.updated_at is distinct from p_expected_updated_at then perform public.sf_stale(); end if;
  if char_length(clean_reason) not between 3 and 300 then
    raise exception using errcode = 'P0001', message = 'Give a reason of 3 to 300 characters.';
  end if;
  if tx.type = 'interest_share' then
    raise exception using errcode = 'P0001', message = 'An interest share is voided with its distribution. Void the distribution instead.';
  end if;
  if tx.type = 'cycle_close' then
    raise exception using errcode = 'P0001', message = 'A year-end close is voided with its distribution. Void the distribution instead.';
  end if;
  -- Voiding anything dated on or before a close would make the saved ended total untrue (spec FR-050).
  select c.tx_date, p.name into closed_on, participant_name
  from public.sf_transactions c join public.sf_participants p on p.id = c.participant_id
  where c.participant_id = tx.participant_id and c.type = 'cycle_close' and c.voided_at is null and tx.tx_date <= c.tx_date
  order by c.tx_date desc limit 1;
  if closed_on is not null then
    raise exception using errcode = 'P0001',
      message = format('%s''s year was closed on %s. Void the distribution first.', participant_name, public.sf_date_text(closed_on));
  end if;
  if tx.type = 'loan' and exists (
    select 1 from public.sf_transactions x where x.loan_id = tx.id and x.type in ('payment', 'loan_withdrawal') and x.voided_at is null
  ) then
    raise exception using errcode = 'P0001', message = 'This loan has payments or a withdrawal. Void them first.';
  end if;
  if tx.type = 'payment' and exists (
    select 1 from public.sf_transactions x where x.loan_id = tx.loan_id and x.type = 'loan_withdrawal' and x.voided_at is null
  ) then
    raise exception using errcode = 'P0001', message = 'Void the Withdrawal first.';
  end if;
  update public.sf_transactions set voided_at = now(), voided_by = auth.uid(), void_reason = clean_reason where id = p_id;
  perform public.sf_assert_participant_timeline(tx.participant_id);
  if tx.type = 'payment' then
    perform public.sf_assert_fund_timeline();
  end if;
  perform public.write_audit_event('sf_transactions', p_id, 'reverse', jsonb_build_object('reason', clean_reason, 'type', tx.type));
  return p_id;
end;
$$;

create or replace function public.sf_void_distribution(p_id uuid, p_reason text, p_expected_updated_at timestamptz)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  dist public.sf_distributions;
  clean_reason text := btrim(coalesce(p_reason, ''));
  who uuid;
  blocker text;
begin
  perform public.require_owner();
  perform public.sf_lock();
  select * into dist from public.sf_distributions where id = p_id and voided_at is null for update;
  if dist.id is null then
    raise exception using errcode = 'P0002', message = 'This distribution was not found or is already voided.';
  end if;
  if dist.updated_at is distinct from p_expected_updated_at then perform public.sf_stale(); end if;
  if char_length(clean_reason) not between 3 and 300 then
    raise exception using errcode = 'P0001', message = 'Give a reason of 3 to 300 characters.';
  end if;
  -- A closed year can be reopened only while nothing new has been recorded for its participants (spec FR-037).
  -- Nothing can be dated on or before a close (sf_guard_closed_cycle), so new activity is anything dated after it.
  select dp.participant_name into blocker
  from public.sf_distribution_participants dp
  where dp.distribution_id = p_id
    and exists (select 1 from public.sf_transactions t
                where t.participant_id = dp.participant_id and t.voided_at is null
                  and t.distribution_id is distinct from p_id and t.tx_date > dist.dist_date)
  order by dp.participant_name
  limit 1;
  if blocker is not null then
    raise exception using errcode = 'P0001',
      message = format('This distribution cannot be voided because %s has new transactions since it.', blocker);
  end if;
  update public.sf_distributions set voided_at = now(), voided_by = auth.uid(), void_reason = clean_reason where id = p_id;
  -- Voids the interest shares and the year-end close rows together; savings come back because totals are derived.
  update public.sf_transactions set voided_at = now(), voided_by = auth.uid(), void_reason = clean_reason
  where distribution_id = p_id and voided_at is null;
  for who in select distinct participant_id from public.sf_transactions where distribution_id = p_id loop
    perform public.sf_assert_participant_timeline(who);
  end loop;
  perform public.sf_assert_fund_timeline();
  perform public.write_audit_event('sf_distributions', p_id, 'reverse', jsonb_build_object('reason', clean_reason));
  return p_id;
end;
$$;

-- 6. Reads: cards and rankings count the current cycle -----------------------------------------------------------------

drop function public.sf_fund_summary(date, date);

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
  participant_count integer,
  cycle_start date
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  cycle date := public.sf_cycle_start();
begin
  perform public.sf_require_approved();
  return query
  select
    coalesce((select sum(public.sf_savings_delta(t)) from public.sf_transactions t where t.voided_at is null), 0)::bigint,
    coalesce((select sum(l.principal_centavos) from public.sf_loans_v l where l.status = 'open'), 0)::bigint,
    (select count(*) from public.sf_loans_v l where l.status = 'open')::integer,
    coalesce((select sum(l.balance_centavos) from public.sf_loans_v l where l.status = 'open'), 0)::bigint,
    coalesce((select sum(t.amount_centavos) from public.sf_transactions t
              where t.type = 'payment' and t.voided_at is null and (cycle is null or t.tx_date > cycle)
                and (p_from is null or t.tx_date >= p_from) and (p_to is null or t.tx_date <= p_to)), 0)::bigint,
    coalesce((select sum(t.interest_part_centavos) from public.sf_transactions t
              where t.type = 'payment' and t.voided_at is null and (cycle is null or t.tx_date > cycle)), 0)::bigint,
    coalesce((select sum(d.total_distributed_centavos) from public.sf_distributions d where d.voided_at is null), 0)::bigint,
    public.sf_fund_total(null),
    coalesce((select sum(l.unpaid_interest_centavos) from public.sf_loans_v l where l.status = 'open'), 0)::bigint,
    (select count(*) from public.sf_participants p where p.archived_at is null and p.deleted_at is null)::integer,
    cycle;
end;
$$;

create or replace function public.sf_ranking(p_rank_by text, p_start date default null, p_end date default null)
returns table (participant_id uuid, name text, driver_id uuid, amount_centavos bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  deposits_from date := coalesce(p_start, public.sf_cycle_start() + 1);
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
                       and (deposits_from is null or t.tx_date >= deposits_from) and (p_end is null or t.tx_date <= p_end)), 0)::bigint
    end
  from public.sf_participants p
  where p.archived_at is null and p.deleted_at is null
  order by p.name;
end;
$$;

-- 7. History and details (owner only) ----------------------------------------------------------------------------------

drop function public.sf_distribution_history();

create or replace function public.sf_distribution_history()
returns table (
  id uuid, dist_date date, year integer, available_before_centavos bigint, total_distributed_centavos bigint,
  remainder_centavos bigint, participant_count integer, share_count integer, per_participant_centavos bigint,
  notes text, voided_at timestamptz, void_reason text, updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.require_owner();
  return query
  select d.id, d.dist_date, extract(year from d.dist_date)::integer, d.available_before_centavos, d.total_distributed_centavos,
         d.remainder_centavos, d.participant_count,
         (case when exists (select 1 from public.sf_distribution_participants dp where dp.distribution_id = d.id)
               then (select count(*) from public.sf_distribution_participants dp where dp.distribution_id = d.id and dp.share_centavos > 0)
               else (select count(*) from public.sf_transactions t where t.distribution_id = d.id and t.type = 'interest_share') end)::integer,
         d.per_participant_centavos, d.notes, d.voided_at, d.void_reason, d.updated_at
  from public.sf_distributions d
  order by d.dist_date desc, d.created_at desc;
end;
$$;

create or replace function public.sf_distribution_details(p_id uuid)
returns table (
  participant_id uuid, participant_name text, savings_before_centavos bigint, share_centavos bigint, ended_total_centavos bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.require_owner();
  return query
  select r.participant_id, r.participant_name, r.savings_before_centavos, r.share_centavos, r.ended_total_centavos
  from (
    select dp.participant_id, dp.participant_name, dp.savings_before_centavos, dp.share_centavos, dp.ended_total_centavos
    from public.sf_distribution_participants dp where dp.distribution_id = p_id
    union all
    -- A distribution made before the year-end close has no saved ended totals: show its shares only.
    select t.participant_id, p.name, null::bigint, t.amount_centavos, null::bigint
    from public.sf_transactions t join public.sf_participants p on p.id = t.participant_id
    where t.distribution_id = p_id and t.type = 'interest_share'
      and not exists (select 1 from public.sf_distribution_participants x where x.distribution_id = p_id)
  ) r
  order by r.ended_total_centavos desc nulls last, r.participant_name asc;
end;
$$;

-- 8. Grants -------------------------------------------------------------------------------------------------------------
-- Helpers get no grant. The functions the app calls are granted to authenticated and check the caller inside.

revoke all on function
  public.sf_guard_closed_cycle(), public.sf_cycle_start(),
  public.sf_distribute_interest(date, uuid[], text, uuid, bigint),
  public.sf_fund_summary(date, date), public.sf_ranking(text, date, date),
  public.sf_distribution_history(), public.sf_distribution_details(uuid)
from public, anon, authenticated;

grant execute on function
  public.sf_distribute_interest(date, uuid[], text, uuid, bigint),
  public.sf_fund_summary(date, date), public.sf_ranking(text, date, date),
  public.sf_distribution_history(), public.sf_distribution_details(uuid)
to authenticated;
