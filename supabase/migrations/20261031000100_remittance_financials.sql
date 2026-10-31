-- Feature 009: every remittance stores a fixed allowance (₱40 at save) and a deposit equal to
-- its active payments minus that allowance. The deposit may be negative. Payments can no longer
-- take a remittance's total above its rental; records that were already overpaid keep their
-- payments but accept no new ones.
--
-- The deposit is kept by the database because payments arrive from several paths (the Daily
-- view actions, the details page, the API and correct_remittance_payment()).

alter table public.remittances
  add column allowance_centavos bigint not null default 4000 check (allowance_centavos >= 0),
  add column deposit_centavos bigint not null default -4000;

-- Backfill without touching updated_at, updated_by or the business audit trail (FR-016).
-- Reversed rows are included so their figures stay right if one is ever restored.
alter table public.remittances disable trigger remittances_audit_fields;
alter table public.remittances disable trigger remittances_business_audit;
alter table public.remittances disable trigger remittances_lock_financial_facts;

update public.remittances r
set allowance_centavos = 4000,
    deposit_centavos = coalesce((
      select sum(p.amount_centavos) from public.remittance_payments p
      where p.remittance_id = r.id and p.deleted_at is null
    ), 0) - 4000;

alter table public.remittances enable trigger remittances_audit_fields;
alter table public.remittances enable trigger remittances_business_audit;
alter table public.remittances enable trigger remittances_lock_financial_facts;

-- The allowance is fixed at save, like the other financial facts.
create or replace function public.lock_remittance_financial_facts()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.service_date is distinct from old.service_date
     or new.disposition is distinct from old.disposition
     or new.amount_due_centavos is distinct from old.amount_due_centavos
     or new.allowance_centavos is distinct from old.allowance_centavos
     or new.unit_id is distinct from old.unit_id
     or new.driver_id is distinct from old.driver_id
     or new.assignment_id is distinct from old.assignment_id
  then
    raise exception using errcode = '23514',
      message = 'A saved remittance''s date, disposition, amount due, allowance, unit, driver and assignment cannot be changed. Reverse it and record a replacement entry.';
  end if;
  return new;
end;
$$;

-- Always recalculates, so a client can never store a wrong deposit. The allowance rate (4000) is
-- inlined rather than read from a helper function: this trigger runs as the caller, who has no
-- EXECUTE on new public functions. It matches ALLOWANCE_CENTAVOS in lib/remittances/financials.ts.
create or replace function public.remittances_set_deposit()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.allowance_centavos := 4000;
  end if;
  new.deposit_centavos := coalesce((
    select sum(p.amount_centavos) from public.remittance_payments p
    where p.remittance_id = new.id and p.deleted_at is null
  ), 0) - new.allowance_centavos;
  return new;
end;
$$;

create trigger remittances_set_deposit
  before insert or update on public.remittances
  for each row execute function public.remittances_set_deposit();

create or replace function public.validate_remittance_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rental bigint;
  others bigint;
begin
  select amount_due_centavos into rental from public.remittances
  where id = new.remittance_id and deleted_at is null
  for update;
  if not found then
    raise exception using errcode = '23514', message = 'Payment requires an active remittance';
  end if;

  if new.deleted_at is null and (
    tg_op = 'INSERT'
    or old.deleted_at is not null
    or new.amount_centavos is distinct from old.amount_centavos
    or new.remittance_id is distinct from old.remittance_id
  ) then
    select coalesce(sum(amount_centavos), 0) into others from public.remittance_payments
    where remittance_id = new.remittance_id and deleted_at is null and id is distinct from new.id;
    if others + new.amount_centavos > rental then
      raise exception using errcode = '23514',
        message = format('Payment can''t exceed the rental of ₱%s. At most ₱%s more can be recorded.',
          to_char(rental / 100.0, 'FM999,999,990.00'),
          to_char(greatest(rental - others, 0) / 100.0, 'FM999,999,990.00'));
    end if;
  end if;
  return new;
end;
$$;

-- Touch the parent so remittances_set_deposit recalculates. Runs as the caller, under RLS.
create or replace function public.remittance_payments_sync_deposit()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  update public.remittances set deposit_centavos = deposit_centavos where id = new.remittance_id;
  if tg_op = 'UPDATE' and old.remittance_id is distinct from new.remittance_id then
    update public.remittances set deposit_centavos = deposit_centavos where id = old.remittance_id;
  end if;
  return null;
end;
$$;

create trigger remittance_payments_sync_deposit
  after insert or update on public.remittance_payments
  for each row execute function public.remittance_payments_sync_deposit();

create index remittances_service_date_idx on public.remittances (service_date) where deleted_at is null;

revoke all on function public.remittances_set_deposit() from public, anon, authenticated;
revoke all on function public.remittance_payments_sync_deposit() from public, anon, authenticated;
