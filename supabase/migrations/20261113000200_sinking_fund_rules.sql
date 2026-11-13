-- Feature 015 (specs/015-sinking-fund), migration 2 of 3: rules and write functions.
--
-- Every user action is exactly one security definer function (one transaction). Each takes the same
-- advisory lock first, so sinking-fund writes are serialized (research R4): two payments that together
-- exceed a balance cannot both pass. After writing, each function re-validates the affected timelines so
-- a participant's savings and the Interest fund are never negative on any date, including back-dated
-- entries and voids (research R3). Owner-only functions call require_owner() first; the others check
-- is_approved_user(). The helpers below are called only from these definer functions and get no grant;
-- only the write functions the app calls, and sf_allowed_interest_range, are granted to authenticated.
--
-- Errors: P0001 is a plain-language rule message, 40001 means the record changed since it was read,
-- P0002 means not found, 42501 means not allowed.

-- 1. Helpers (no grants) ------------------------------------------------------------------------------------

create or replace function public.sf_constants()
returns table (interest_rate_bp integer, loan_step_centavos bigint, loan_term_months integer)
language sql
immutable
set search_path = public
as $$ select 500, 10000::bigint, 1; $$;

create or replace function public.sf_lock()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('sinking_fund', 0));
end;
$$;

-- "₱1,000.00" for error messages.
create or replace function public.sf_peso(p_centavos bigint)
returns text
language sql
immutable
set search_path = public
as $$ select chr(8369) || to_char(p_centavos::numeric / 100, 'FM999,999,999,990.00'); $$;

-- "Nov 5, 2026" for error messages.
create or replace function public.sf_date_text(p_date date)
returns text
language sql
immutable
set search_path = public
as $$ select to_char(p_date, 'Mon FMDD, YYYY'); $$;

-- Loan date plus one calendar month; PostgreSQL clamps to the month's last day (Jan 31 gives Feb 28).
create or replace function public.sf_loan_due_date(p_date date)
returns date
language sql
immutable
set search_path = public
as $$ select (p_date + interval '1 month')::date; $$;

-- Effect of one row on the participant's Total savings (data-model.md "Derived values").
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
    else 0::bigint
  end;
$$;

-- Total savings at the end of p_as_of (or now when null) from non-voided rows.
create or replace function public.sf_savings_total(p_participant uuid, p_as_of date default null)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(public.sf_savings_delta(t)), 0)::bigint
  from public.sf_transactions t
  where t.participant_id = p_participant and t.voided_at is null and (p_as_of is null or t.tx_date <= p_as_of);
$$;

-- Interest fund at the end of p_as_of (or now when null): collected interest parts minus distribution totals.
create or replace function public.sf_fund_total(p_as_of date default null)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select (
    coalesce((select sum(t.interest_part_centavos) from public.sf_transactions t
              where t.type = 'payment' and t.voided_at is null and (p_as_of is null or t.tx_date <= p_as_of)), 0)
    - coalesce((select sum(d.total_distributed_centavos) from public.sf_distributions d
                where d.voided_at is null and (p_as_of is null or d.dist_date <= p_as_of)), 0)
  )::bigint;
$$;

-- Raises when the participant's running savings would be negative on any date. Same-day order: credits
-- first, then debits, then creation order, so the order entries were typed in a day never matters.
create or replace function public.sf_assert_participant_timeline(p_participant uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  entry record;
  running bigint := 0;
  before bigint;
  participant_name text;
begin
  for entry in
    select t.tx_date, public.sf_savings_delta(t) as delta
    from public.sf_transactions t
    where t.participant_id = p_participant and t.voided_at is null and public.sf_savings_delta(t) <> 0
    order by t.tx_date, (public.sf_savings_delta(t) < 0), t.created_at, t.id
  loop
    before := running;
    running := running + entry.delta;
    if running < 0 then
      select name into participant_name from public.sf_participants where id = p_participant;
      raise exception using errcode = 'P0001',
        message = format('%s only had %s on %s.', participant_name, public.sf_peso(before), public.sf_date_text(entry.tx_date));
    end if;
  end loop;
end;
$$;

-- Raises when the Interest fund would be negative on any date (payments add interest; distributions subtract).
create or replace function public.sf_assert_fund_timeline()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  entry record;
  running bigint := 0;
  before bigint;
begin
  for entry in
    select e.d, e.delta from (
      select t.tx_date as d, t.interest_part_centavos as delta, t.created_at as c, t.id
      from public.sf_transactions t
      where t.type = 'payment' and t.voided_at is null and t.interest_part_centavos > 0
      union all
      select x.dist_date, -x.total_distributed_centavos, x.created_at, x.id
      from public.sf_distributions x
      where x.voided_at is null
    ) e
    order by e.d, (e.delta < 0), e.c, e.id
  loop
    before := running;
    running := running + entry.delta;
    if running < 0 then
      raise exception using errcode = 'P0001',
        message = format('The Interest fund only had %s on %s.', public.sf_peso(before), public.sf_date_text(entry.d));
    end if;
  end loop;
end;
$$;

-- Raises when a loan's payments break its limits.
create or replace function public.sf_assert_loan(p_loan uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  loan_row public.sf_transactions;
  interest_paid bigint;
  principal_paid bigint;
begin
  select * into loan_row from public.sf_transactions where id = p_loan and type = 'loan';
  select coalesce(sum(interest_part_centavos), 0), coalesce(sum(principal_part_centavos), 0)
    into interest_paid, principal_paid
  from public.sf_transactions where loan_id = p_loan and type = 'payment' and voided_at is null;
  if interest_paid > loan_row.interest_centavos then
    raise exception using errcode = 'P0001', message = 'The interest paid cannot be higher than the loan''s interest.';
  end if;
  if principal_paid > loan_row.amount_centavos then
    raise exception using errcode = 'P0001', message = 'The principal paid cannot be higher than the amount borrowed.';
  end if;
  if exists (select 1 from public.sf_transactions where loan_id = p_loan and type = 'payment' and voided_at is null and tx_date < loan_row.tx_date) then
    raise exception using errcode = 'P0001', message = format('Payment date cannot be before the loan date (%s).', public.sf_date_text(loan_row.tx_date));
  end if;
end;
$$;

-- Allowed interest part for a payment of p_amount on p_loan, from the loan's OTHER non-voided payments.
create or replace function public.sf_allowed_interest(p_loan uuid, p_amount bigint, p_exclude_payment uuid)
returns table (min_part bigint, max_part bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  loan_row public.sf_transactions;
  interest_paid bigint;
  principal_paid bigint;
begin
  select * into loan_row from public.sf_transactions where id = p_loan and type = 'loan' and voided_at is null;
  if loan_row.id is null then
    raise exception using errcode = 'P0002', message = 'This loan was not found.';
  end if;
  select coalesce(sum(interest_part_centavos), 0), coalesce(sum(principal_part_centavos), 0)
    into interest_paid, principal_paid
  from public.sf_transactions
  where loan_id = p_loan and type = 'payment' and voided_at is null and id is distinct from p_exclude_payment;
  min_part := greatest(0, p_amount - (loan_row.amount_centavos - principal_paid));
  max_part := least(p_amount, loan_row.interest_centavos - interest_paid);
  return next;
end;
$$;

create or replace function public.sf_require_approved()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not coalesce(public.is_approved_user(), false) then
    raise exception using errcode = '42501', message = 'Only approved users can use the sinking fund.';
  end if;
end;
$$;

create or replace function public.sf_check_date(p_date date)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_date is null then
    raise exception using errcode = 'P0001', message = 'Choose a date.';
  end if;
  if p_date > public.sf_today() then
    raise exception using errcode = 'P0001', message = 'The date cannot be in the future.';
  end if;
end;
$$;

create or replace function public.sf_check_amount(p_amount bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_amount is null or p_amount <= 0 then
    raise exception using errcode = 'P0001', message = 'Enter an amount greater than ₱0.00.';
  end if;
end;
$$;

create or replace function public.sf_stale()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception using errcode = '40001', message = 'This record was changed by someone else. Reload to see the latest.';
end;
$$;

-- An active (not archived, not deleted) participant, locked for the rest of the transaction.
create or replace function public.sf_active_participant(p_participant uuid)
returns public.sf_participants
language plpgsql
security definer
set search_path = public
as $$
declare participant_row public.sf_participants;
begin
  select * into participant_row from public.sf_participants
  where id = p_participant and deleted_at is null and archived_at is null for update;
  if participant_row.id is null then
    raise exception using errcode = 'P0002', message = 'This participant was not found or is archived.';
  end if;
  return participant_row;
end;
$$;

-- 2. Participants ----------------------------------------------------------------------------------------------

create or replace function public.sf_add_participant(p_name text, p_driver_id uuid, p_notes text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_name text := btrim(coalesce(p_name, ''));
  new_id uuid;
begin
  perform public.sf_require_approved();
  perform public.sf_lock();
  if char_length(clean_name) not between 1 and 120 then
    raise exception using errcode = 'P0001', message = 'Enter a name of 1 to 120 characters.';
  end if;
  if exists (select 1 from public.sf_participants where name_key = lower(clean_name) and archived_at is null and deleted_at is null) then
    raise exception using errcode = 'P0001', message = format('A participant named %s already exists.', clean_name);
  end if;
  if p_driver_id is not null then
    if not exists (select 1 from public.drivers where id = p_driver_id and deleted_at is null) then
      raise exception using errcode = 'P0002', message = 'This driver was not found.';
    end if;
    if exists (select 1 from public.sf_participants where driver_id = p_driver_id and deleted_at is null) then
      raise exception using errcode = 'P0001', message = 'This driver is already a participant.';
    end if;
  end if;
  insert into public.sf_participants (name, driver_id, notes)
  values (clean_name, p_driver_id, nullif(btrim(coalesce(p_notes, '')), ''))
  returning id into new_id;
  return new_id;
end;
$$;

-- Editing the name of a linked participant removes the driver link (the app confirms first).
create or replace function public.sf_rename_participant(p_id uuid, p_name text, p_expected_updated_at timestamptz)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_name text := btrim(coalesce(p_name, ''));
  participant_row public.sf_participants;
begin
  perform public.sf_require_approved();
  perform public.sf_lock();
  participant_row := public.sf_active_participant(p_id);
  if participant_row.updated_at is distinct from p_expected_updated_at then perform public.sf_stale(); end if;
  if char_length(clean_name) not between 1 and 120 then
    raise exception using errcode = 'P0001', message = 'Enter a name of 1 to 120 characters.';
  end if;
  if exists (select 1 from public.sf_participants where name_key = lower(clean_name) and archived_at is null and deleted_at is null and id <> p_id) then
    raise exception using errcode = 'P0001', message = format('A participant named %s already exists.', clean_name);
  end if;
  update public.sf_participants set name = clean_name, driver_id = null where id = p_id;
  return p_id;
end;
$$;

create or replace function public.sf_archive_participant(p_id uuid, p_expected_updated_at timestamptz)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare participant_row public.sf_participants;
begin
  perform public.require_owner();
  perform public.sf_lock();
  participant_row := public.sf_active_participant(p_id);
  if participant_row.updated_at is distinct from p_expected_updated_at then perform public.sf_stale(); end if;
  if exists (select 1 from public.sf_loans_v where participant_id = p_id and status = 'open') then
    raise exception using errcode = 'P0001', message = 'This participant has an open or overdue loan. Settle or close it first.';
  end if;
  if public.sf_savings_total(p_id) <> 0 then
    raise exception using errcode = 'P0001', message = 'Total savings must be ₱0.00 before archiving. Record a savings withdrawal first.';
  end if;
  update public.sf_participants set archived_at = now(), archived_by = auth.uid() where id = p_id;
  return p_id;
end;
$$;

-- 3. Deposits, loans, payments, savings withdrawals ------------------------------------------------------------

create or replace function public.sf_record_deposit(p_participant uuid, p_date date, p_amount bigint, p_notes text, p_key uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare new_id uuid;
begin
  perform public.sf_require_approved();
  perform public.sf_lock();
  if p_key is not null then
    select id into new_id from public.sf_transactions where idempotency_key = p_key;
    if new_id is not null then return new_id; end if;
  end if;
  perform public.sf_check_date(p_date);
  perform public.sf_check_amount(p_amount);
  perform public.sf_active_participant(p_participant);
  insert into public.sf_transactions (participant_id, type, amount_centavos, tx_date, notes, idempotency_key)
  values (p_participant, 'deposit', p_amount, p_date, nullif(btrim(coalesce(p_notes, '')), ''), p_key)
  returning id into new_id;
  return new_id;
end;
$$;

create or replace function public.sf_record_loan(p_participant uuid, p_date date, p_amount bigint, p_notes text, p_key uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
  rate integer;
  step bigint;
  interest bigint;
  available bigint;
begin
  perform public.sf_require_approved();
  perform public.sf_lock();
  if p_key is not null then
    select id into new_id from public.sf_transactions where idempotency_key = p_key;
    if new_id is not null then return new_id; end if;
  end if;
  perform public.sf_check_date(p_date);
  perform public.sf_check_amount(p_amount);
  perform public.sf_active_participant(p_participant);
  select c.interest_rate_bp, c.loan_step_centavos into rate, step from public.sf_constants() c;
  if p_amount % step <> 0 then
    raise exception using errcode = 'P0001', message = 'Loans must be in steps of ₱100 (₱100, ₱200, ₱300...).';
  end if;
  available := public.sf_savings_total(p_participant, p_date);
  if p_date = public.sf_today() and p_amount > available then
    raise exception using errcode = 'P0001', message = format('Loan cannot be higher than total savings (%s).', public.sf_peso(available));
  end if;
  interest := p_amount * rate / 10000;
  insert into public.sf_transactions (participant_id, type, amount_centavos, tx_date, notes, interest_rate_bp, interest_centavos, amount_due_centavos, due_date, idempotency_key)
  values (p_participant, 'loan', p_amount, p_date, nullif(btrim(coalesce(p_notes, '')), ''), rate, interest, p_amount + interest, public.sf_loan_due_date(p_date), p_key)
  returning id into new_id;
  perform public.sf_assert_participant_timeline(p_participant);
  return new_id;
end;
$$;

-- The owner's p_interest_part is used when given and valid; everyone else gets the Fund settings default.
create or replace function public.sf_record_payment(p_loan uuid, p_date date, p_amount bigint, p_interest_part bigint, p_notes text, p_key uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
  loan_row public.sf_transactions;
  loan_state public.sf_loans_v;
  allowed record;
  chosen bigint;
  set_by public.sf_interest_set_by;
  prefill public.sf_prefill;
begin
  perform public.sf_require_approved();
  perform public.sf_lock();
  if p_key is not null then
    select id into new_id from public.sf_transactions where idempotency_key = p_key;
    if new_id is not null then return new_id; end if;
  end if;
  perform public.sf_check_date(p_date);
  perform public.sf_check_amount(p_amount);
  select * into loan_row from public.sf_transactions where id = p_loan and type = 'loan' and voided_at is null for update;
  if loan_row.id is null then
    raise exception using errcode = 'P0002', message = 'This loan was not found.';
  end if;
  if p_date < loan_row.tx_date then
    raise exception using errcode = 'P0001', message = format('Payment date cannot be before the loan date (%s).', public.sf_date_text(loan_row.tx_date));
  end if;
  select * into loan_state from public.sf_loans_v where id = p_loan;
  if loan_state.status = 'withdrawn' then
    raise exception using errcode = 'P0001', message = 'This loan was closed as a withdrawal.';
  end if;
  if loan_state.balance_centavos = 0 then
    raise exception using errcode = 'P0001', message = 'This loan is already paid.';
  end if;
  if p_amount > loan_state.balance_centavos then
    raise exception using errcode = 'P0001', message = format('Payment cannot be higher than the balance (%s).', public.sf_peso(loan_state.balance_centavos));
  end if;
  select * into allowed from public.sf_allowed_interest(p_loan, p_amount, null);
  if public.is_owner() and p_interest_part is not null then
    if p_interest_part < allowed.min_part or p_interest_part > allowed.max_part then
      raise exception using errcode = 'P0001',
        message = format('Interest part must be between %s and %s for this payment.', public.sf_peso(allowed.min_part), public.sf_peso(allowed.max_part));
    end if;
    chosen := p_interest_part;
    set_by := 'owner';
  else
    select default_interest_prefill into prefill from public.sf_settings limit 1;
    chosen := case when prefill = 'last' then allowed.min_part else allowed.max_part end;
    set_by := 'default';
  end if;
  insert into public.sf_transactions (participant_id, type, amount_centavos, tx_date, notes, loan_id, interest_part_centavos, principal_part_centavos, interest_set_by, idempotency_key)
  values (loan_row.participant_id, 'payment', p_amount, p_date, nullif(btrim(coalesce(p_notes, '')), ''), p_loan, chosen, p_amount - chosen, set_by, p_key)
  returning id into new_id;
  perform public.sf_assert_loan(p_loan);
  perform public.sf_assert_participant_timeline(loan_row.participant_id);
  perform public.sf_assert_fund_timeline();
  return new_id;
end;
$$;

create or replace function public.sf_record_savings_withdrawal(p_participant uuid, p_date date, p_amount bigint, p_notes text, p_key uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
  available bigint;
begin
  perform public.require_owner();
  perform public.sf_lock();
  if p_key is not null then
    select id into new_id from public.sf_transactions where idempotency_key = p_key;
    if new_id is not null then return new_id; end if;
  end if;
  perform public.sf_check_date(p_date);
  perform public.sf_check_amount(p_amount);
  perform public.sf_active_participant(p_participant);
  available := public.sf_savings_total(p_participant, p_date);
  if p_date = public.sf_today() and p_amount > available then
    raise exception using errcode = 'P0001', message = format('Withdrawal cannot be higher than total savings (%s).', public.sf_peso(available));
  end if;
  insert into public.sf_transactions (participant_id, type, amount_centavos, tx_date, notes, idempotency_key)
  values (p_participant, 'savings_withdrawal', p_amount, p_date, nullif(btrim(coalesce(p_notes, '')), ''), p_key)
  returning id into new_id;
  perform public.sf_assert_participant_timeline(p_participant);
  return new_id;
end;
$$;

-- 4. Loan Withdrawal and interest part ---------------------------------------------------------------------------

-- Closes an overdue loan: balance becomes 0, savings are unchanged, unpaid interest is waived.
-- p_expected_balance_centavos is the balance the owner saw in the confirmation; a payment recorded since then makes it stale.
create or replace function public.sf_mark_loan_withdrawal(p_loan uuid, p_expected_balance_centavos bigint)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  loan_state public.sf_loans_v;
  new_id uuid;
begin
  perform public.require_owner();
  perform public.sf_lock();
  perform 1 from public.sf_transactions where id = p_loan and type = 'loan' and voided_at is null for update;
  select * into loan_state from public.sf_loans_v where id = p_loan;
  if loan_state.id is null then
    raise exception using errcode = 'P0002', message = 'This loan was not found.';
  end if;
  if loan_state.status <> 'open' or not loan_state.overdue then
    raise exception using errcode = 'P0001', message = 'Only an overdue loan can be closed as a withdrawal.';
  end if;
  if loan_state.balance_centavos is distinct from p_expected_balance_centavos then perform public.sf_stale(); end if;
  insert into public.sf_transactions (participant_id, type, amount_centavos, tx_date, loan_id, interest_waived_centavos)
  values (loan_state.participant_id, 'loan_withdrawal', loan_state.balance_centavos, public.sf_today(), p_loan, loan_state.unpaid_interest_centavos)
  returning id into new_id;
  return new_id;
end;
$$;

create or replace function public.sf_change_interest_part(p_payment uuid, p_interest_part bigint, p_expected_updated_at timestamptz)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  payment_row public.sf_transactions;
  loan_state public.sf_loans_v;
  allowed record;
begin
  perform public.require_owner();
  perform public.sf_lock();
  select * into payment_row from public.sf_transactions where id = p_payment and type = 'payment' and voided_at is null for update;
  if payment_row.id is null then
    raise exception using errcode = 'P0002', message = 'This payment was not found.';
  end if;
  if payment_row.updated_at is distinct from p_expected_updated_at then perform public.sf_stale(); end if;
  select * into loan_state from public.sf_loans_v where id = payment_row.loan_id;
  if loan_state.status = 'withdrawn' then
    raise exception using errcode = 'P0001', message = 'This loan was closed as a withdrawal, so its payments cannot change.';
  end if;
  select * into allowed from public.sf_allowed_interest(payment_row.loan_id, payment_row.amount_centavos, p_payment);
  if p_interest_part is null or p_interest_part < allowed.min_part or p_interest_part > allowed.max_part then
    raise exception using errcode = 'P0001',
      message = format('Interest part must be between %s and %s for this payment.', public.sf_peso(allowed.min_part), public.sf_peso(allowed.max_part));
  end if;
  update public.sf_transactions
  set interest_part_centavos = p_interest_part,
      principal_part_centavos = payment_row.amount_centavos - p_interest_part,
      interest_set_by = 'owner'
  where id = p_payment;
  perform public.sf_assert_loan(payment_row.loan_id);
  perform public.sf_assert_participant_timeline(payment_row.participant_id);
  perform public.sf_assert_fund_timeline();
  return p_payment;
end;
$$;

-- 5. Distribution ---------------------------------------------------------------------------------------------------

create or replace function public.sf_distribute_interest(p_date date, p_participants uuid[], p_notes text, p_key uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  dist_id uuid;
  ids uuid[];
  available bigint;
  n integer;
  share bigint;
  who uuid;
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
  available := public.sf_fund_total(p_date);
  if available <= 0 then
    raise exception using errcode = 'P0001', message = 'There is no interest to distribute on this date.';
  end if;
  share := available / n;
  if share <= 0 then
    raise exception using errcode = 'P0001', message = format('%s is too little to share among %s participants.', public.sf_peso(available), n);
  end if;
  insert into public.sf_distributions (dist_date, available_before_centavos, per_participant_centavos, participant_count, total_distributed_centavos, remainder_centavos, notes, idempotency_key)
  values (p_date, available, share, n, share * n, available - share * n, nullif(btrim(coalesce(p_notes, '')), ''), p_key)
  returning id into dist_id;
  foreach who in array ids loop
    insert into public.sf_transactions (participant_id, type, amount_centavos, tx_date, distribution_id)
    values (who, 'interest_share', share, p_date, dist_id);
  end loop;
  perform public.sf_assert_fund_timeline();
  perform public.write_audit_event('sf_distributions', dist_id, 'insert', jsonb_build_object('participants', n, 'per_participant_centavos', share, 'total_centavos', share * n));
  return dist_id;
end;
$$;

-- 6. Voids -------------------------------------------------------------------------------------------------------------

create or replace function public.sf_void_transaction(p_id uuid, p_reason text, p_expected_updated_at timestamptz)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  tx public.sf_transactions;
  clean_reason text := btrim(coalesce(p_reason, ''));
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
  update public.sf_distributions set voided_at = now(), voided_by = auth.uid(), void_reason = clean_reason where id = p_id;
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

-- 7. Settings -----------------------------------------------------------------------------------------------------------

create or replace function public.sf_set_default_prefill(p_value public.sf_prefill)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.require_owner();
  perform public.sf_lock();
  update public.sf_settings set default_interest_prefill = p_value;
end;
$$;

-- 8. Read wrapper for the forms --------------------------------------------------------------------------------------------

create or replace function public.sf_allowed_interest_range(p_loan uuid, p_amount bigint, p_exclude_payment uuid)
returns table (min_part bigint, max_part bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.sf_require_approved();
  return query select a.min_part, a.max_part from public.sf_allowed_interest(p_loan, p_amount, p_exclude_payment) a;
end;
$$;

-- 9. Grants: only what the app calls ----------------------------------------------------------------------------------------

revoke all on function
  public.sf_constants(), public.sf_lock(), public.sf_peso(bigint), public.sf_date_text(date), public.sf_loan_due_date(date),
  public.sf_savings_delta(public.sf_transactions), public.sf_savings_total(uuid, date), public.sf_fund_total(date),
  public.sf_assert_participant_timeline(uuid), public.sf_assert_fund_timeline(), public.sf_assert_loan(uuid),
  public.sf_allowed_interest(uuid, bigint, uuid), public.sf_require_approved(), public.sf_check_date(date),
  public.sf_check_amount(bigint), public.sf_stale(), public.sf_active_participant(uuid)
from public, anon, authenticated;

revoke all on function
  public.sf_add_participant(text, uuid, text), public.sf_rename_participant(uuid, text, timestamptz),
  public.sf_archive_participant(uuid, timestamptz), public.sf_record_deposit(uuid, date, bigint, text, uuid),
  public.sf_record_loan(uuid, date, bigint, text, uuid), public.sf_record_payment(uuid, date, bigint, bigint, text, uuid),
  public.sf_record_savings_withdrawal(uuid, date, bigint, text, uuid), public.sf_mark_loan_withdrawal(uuid, bigint),
  public.sf_change_interest_part(uuid, bigint, timestamptz), public.sf_distribute_interest(date, uuid[], text, uuid),
  public.sf_void_transaction(uuid, text, timestamptz), public.sf_void_distribution(uuid, text, timestamptz),
  public.sf_set_default_prefill(public.sf_prefill), public.sf_allowed_interest_range(uuid, bigint, uuid)
from public, anon, authenticated;

grant execute on function
  public.sf_add_participant(text, uuid, text), public.sf_rename_participant(uuid, text, timestamptz),
  public.sf_archive_participant(uuid, timestamptz), public.sf_record_deposit(uuid, date, bigint, text, uuid),
  public.sf_record_loan(uuid, date, bigint, text, uuid), public.sf_record_payment(uuid, date, bigint, bigint, text, uuid),
  public.sf_record_savings_withdrawal(uuid, date, bigint, text, uuid), public.sf_mark_loan_withdrawal(uuid, bigint),
  public.sf_change_interest_part(uuid, bigint, timestamptz), public.sf_distribute_interest(date, uuid[], text, uuid),
  public.sf_void_transaction(uuid, text, timestamptz), public.sf_void_distribution(uuid, text, timestamptz),
  public.sf_set_default_prefill(public.sf_prefill), public.sf_allowed_interest_range(uuid, bigint, uuid)
to authenticated;
