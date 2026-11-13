-- Feature 015 (specs/015-sinking-fund), migration 1 of 3: Sinking fund tables, views, RLS.
--
-- A shared savings ledger: participants save, borrow from their own savings at 5% for one month, and
-- repay; loan interest goes to a shared Interest fund the owner divides equally. Money is integer
-- centavos. Nothing is stored that can be derived: Total savings, loan balances and status, and the
-- Interest fund are computed from non-voided ledger rows (research R2). Ledger rows are never deleted:
-- voiding sets voided_at/voided_by/void_reason (the "equivalent status" constitution III allows for
-- deleted_at). Tables are readable by approved users and writable only through the functions in
-- migration 2 (security definer, serialized by one advisory lock, research R4).

create type public.sf_transaction_type as enum
  ('deposit', 'loan', 'payment', 'loan_withdrawal', 'savings_withdrawal', 'interest_share');
create type public.sf_interest_set_by as enum ('owner', 'default');
create type public.sf_prefill as enum ('first', 'last');

-- 1. Participants ----------------------------------------------------------------------------------------

create table public.sf_participants (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  name_key text generated always as (lower(btrim(name))) stored,
  driver_id uuid references public.drivers(id),
  notes text check (notes is null or char_length(notes) <= 500),
  archived_at timestamptz,
  archived_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id)
);

-- Names are unique among active participants, case-insensitive; an archived participant's name can be reused.
create unique index sf_participants_active_name_idx on public.sf_participants (name_key)
  where archived_at is null and deleted_at is null;
-- A driver is linked to at most one participant.
create unique index sf_participants_driver_idx on public.sf_participants (driver_id)
  where driver_id is not null and deleted_at is null;

-- 2. Distributions -----------------------------------------------------------------------------------------

create table public.sf_distributions (
  id uuid primary key default gen_random_uuid(),
  dist_date date not null,
  available_before_centavos bigint not null check (available_before_centavos > 0),
  per_participant_centavos bigint not null check (per_participant_centavos > 0),
  participant_count integer not null check (participant_count > 0),
  total_distributed_centavos bigint not null check (total_distributed_centavos > 0),
  remainder_centavos bigint not null check (remainder_centavos >= 0),
  notes text check (notes is null or char_length(notes) <= 500),
  voided_at timestamptz,
  voided_by uuid references auth.users(id),
  void_reason text,
  idempotency_key uuid,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id),
  constraint sf_distributions_total check (total_distributed_centavos = per_participant_centavos * participant_count),
  constraint sf_distributions_remainder check (remainder_centavos = available_before_centavos - total_distributed_centavos and remainder_centavos < participant_count),
  constraint sf_distributions_void check (voided_at is null or char_length(btrim(coalesce(void_reason, ''))) between 3 and 300)
);

create unique index sf_distributions_idempotency_idx on public.sf_distributions (idempotency_key) where idempotency_key is not null;
create index sf_distributions_date_idx on public.sf_distributions (dist_date) where voided_at is null;

-- 3. Ledger ---------------------------------------------------------------------------------------------------

create table public.sf_transactions (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.sf_participants(id),
  type public.sf_transaction_type not null,
  amount_centavos bigint not null check (amount_centavos > 0),
  tx_date date not null,
  notes text check (notes is null or char_length(notes) <= 500),
  -- payment and loan_withdrawal point at the loan row; interest_share points at its distribution.
  loan_id uuid references public.sf_transactions(id),
  distribution_id uuid references public.sf_distributions(id),
  -- loan columns
  interest_rate_bp integer check (interest_rate_bp is null or interest_rate_bp between 1 and 10000),
  interest_centavos bigint check (interest_centavos is null or interest_centavos >= 0),
  amount_due_centavos bigint check (amount_due_centavos is null or amount_due_centavos > 0),
  due_date date,
  -- payment columns (stored exactly as chosen, never recalculated from a rule)
  interest_part_centavos bigint check (interest_part_centavos is null or interest_part_centavos >= 0),
  principal_part_centavos bigint check (principal_part_centavos is null or principal_part_centavos >= 0),
  interest_set_by public.sf_interest_set_by,
  -- loan_withdrawal column
  interest_waived_centavos bigint check (interest_waived_centavos is null or interest_waived_centavos >= 0),
  voided_at timestamptz,
  voided_by uuid references auth.users(id),
  void_reason text,
  idempotency_key uuid,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id),

  -- Which columns each type uses; every other column must be empty.
  constraint sf_transactions_shape check (
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
    end
  ),
  -- Loan math: principal in steps of ₱100 (10,000 centavos), interest = principal x rate, due = principal + interest.
  constraint sf_transactions_loan_math check (
    type <> 'loan' or (
      amount_centavos % 10000 = 0
      and interest_centavos = amount_centavos * interest_rate_bp / 10000
      and amount_due_centavos = amount_centavos + interest_centavos
      and due_date >= tx_date
    )
  ),
  constraint sf_transactions_payment_math check (
    type <> 'payment' or (
      interest_part_centavos <= amount_centavos
      and principal_part_centavos = amount_centavos - interest_part_centavos
    )
  ),
  constraint sf_transactions_withdrawal_math check (
    type <> 'loan_withdrawal' or interest_waived_centavos <= amount_centavos
  ),
  constraint sf_transactions_void check (voided_at is null or char_length(btrim(coalesce(void_reason, ''))) between 3 and 300)
);

create unique index sf_transactions_idempotency_idx on public.sf_transactions (idempotency_key) where idempotency_key is not null;
create index sf_transactions_participant_date_idx on public.sf_transactions (participant_id, tx_date) where voided_at is null;
create index sf_transactions_type_date_idx on public.sf_transactions (type, tx_date) where voided_at is null;
create index sf_transactions_loan_idx on public.sf_transactions (loan_id) where loan_id is not null;
create index sf_transactions_distribution_idx on public.sf_transactions (distribution_id) where distribution_id is not null;
-- One non-voided Withdrawal per loan.
create unique index sf_transactions_one_withdrawal_idx on public.sf_transactions (loan_id)
  where type = 'loan_withdrawal' and voided_at is null;

-- 4. Settings (single row) ---------------------------------------------------------------------------------

create table public.sf_settings (
  -- A fixed uuid keeps the shared audit trigger (which reads the row's id as a uuid) working.
  id uuid primary key default '00000000-0000-0000-0000-000000000002'::uuid
    check (id = '00000000-0000-0000-0000-000000000002'::uuid),
  default_interest_prefill public.sf_prefill not null default 'first',
  timezone text not null default 'Asia/Manila',
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id)
);

insert into public.sf_settings default values;

-- 5. Triggers: audit fields, no hard delete, business audit ------------------------------------------------

do $$
declare table_name text;
begin
  foreach table_name in array array['sf_participants', 'sf_distributions', 'sf_transactions', 'sf_settings']
  loop
    execute format('create trigger %I_audit_fields before insert or update on public.%I for each row execute function public.set_audit_fields()', table_name, table_name);
    execute format('create trigger %I_no_hard_delete before delete on public.%I for each row execute function public.reject_hard_delete()', table_name, table_name);
    execute format('create trigger %I_business_audit after insert or update on public.%I for each row execute function public.audit_business_change()', table_name, table_name);
    execute format('alter table public.%I enable row level security', table_name);
    execute format('create policy %I_read_policy on public.%I for select to authenticated using (public.is_approved_user())', table_name, table_name);
    -- No insert, update, or delete policies and no table privileges: every write goes through a function.
    execute format('revoke all on public.%I from anon, authenticated', table_name);
    execute format('grant select on public.%I to authenticated', table_name);
  end loop;
end;
$$;

-- 6. Helper used by the views: the business date -----------------------------------------------------------

create or replace function public.sf_today()
returns date
language sql
stable
security invoker
set search_path = public
as $$ select (now() at time zone coalesce((select timezone from public.sf_settings limit 1), 'Asia/Manila'))::date; $$;

grant execute on function public.sf_today() to authenticated;

-- 7. Views (security invoker, so the read policies above apply) ------------------------------------------------

-- One row per non-voided loan with its paid and unpaid parts, balance, status, and overdue flag.
create view public.sf_loans_v with (security_invoker = true) as
select
  s.*,
  case when s.withdrawn_on is not null then 'withdrawn'
       when s.balance_centavos = 0 then 'paid'
       else 'open' end as status,
  (s.withdrawn_on is null and s.balance_centavos > 0 and s.due_date < public.sf_today()) as overdue
from (
  select
    l.id,
    l.participant_id,
    l.tx_date as loan_date,
    l.amount_centavos as principal_centavos,
    l.interest_centavos,
    l.amount_due_centavos,
    l.due_date,
    coalesce(p.interest_paid, 0)::bigint as interest_paid_centavos,
    coalesce(p.principal_paid, 0)::bigint as principal_paid_centavos,
    (l.interest_centavos - coalesce(p.interest_paid, 0))::bigint as unpaid_interest_centavos,
    (l.amount_centavos - coalesce(p.principal_paid, 0))::bigint as unpaid_principal_centavos,
    (case when w.tx_date is not null then 0
          else l.amount_due_centavos - coalesce(p.interest_paid, 0) - coalesce(p.principal_paid, 0) end)::bigint as balance_centavos,
    w.tx_date as withdrawn_on,
    l.updated_at
  from public.sf_transactions l
  left join lateral (
    select sum(x.interest_part_centavos) as interest_paid, sum(x.principal_part_centavos) as principal_paid
    from public.sf_transactions x
    where x.loan_id = l.id and x.type = 'payment' and x.voided_at is null
  ) p on true
  left join lateral (
    select x.tx_date from public.sf_transactions x
    where x.loan_id = l.id and x.type = 'loan_withdrawal' and x.voided_at is null
    limit 1
  ) w on true
  where l.type = 'loan' and l.voided_at is null
) s;

-- The list the Transactions view reads: every ledger row (voided ones too) with the participant, the loan it
-- belongs to, the loan balance after a payment, the participant's savings after the row, and the distribution.
create view public.sf_ledger_v with (security_invoker = true) as
select
  t.id, t.participant_id, pa.name as participant_name, (pa.driver_id is not null) as participant_is_driver,
  pa.archived_at is not null as participant_archived,
  t.type, t.amount_centavos, t.tx_date, t.notes, t.loan_id, t.distribution_id,
  t.interest_rate_bp, t.interest_centavos, t.amount_due_centavos, t.due_date,
  t.interest_part_centavos, t.principal_part_centavos, t.interest_set_by, t.interest_waived_centavos,
  t.voided_at, t.void_reason, t.created_at, t.updated_at,
  lt.tx_date as loan_date,
  -- The loan this row is (or belongs to): its current status ('overdue' when past due with a balance), balance, and interest paid.
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

revoke all on public.sf_loans_v, public.sf_ledger_v from anon, authenticated;
grant select on public.sf_loans_v, public.sf_ledger_v to authenticated;
