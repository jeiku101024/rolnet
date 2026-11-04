-- Feature 014: a remittance's deposit is its rental minus its allowance, whatever was paid that day. The
-- weekly, monthly and yearly report workbooks write Deposit as the formula Rental - Allowance, and the app
-- must show the same figure. This replaces feature 009's rule (active payments - allowance, which could be
-- negative).
--
-- Old rule, for recovery: a record's previous deposit can be recomputed as the sum of its non-deleted
-- remittance_payments.amount_centavos minus its allowance_centavos.
--
-- Payments still touch the parent row (remittance_payments_sync_deposit), so a payment keeps moving
-- remittances.updated_at, which the Daily view uses as its concurrency token. Only the value changes.

-- Always recalculates, so a client can never store a wrong deposit. The allowance rate (4000) is inlined
-- rather than read from a helper function: this trigger runs as the caller, who has no EXECUTE on new public
-- functions. It matches ALLOWANCE_CENTAVOS in lib/remittances/financials.ts.
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
  new.deposit_centavos := new.amount_due_centavos - new.allowance_centavos;
  return new;
end;
$$;

revoke all on function public.remittances_set_deposit() from public, anon, authenticated;

-- The new rule reads amount_due_centavos, which remittances_validate sets on insert. Triggers of one kind
-- fire in name order, and "remittances_set_deposit" sorts before "remittances_validate", so the deposit would be
-- worked out from a null rental. The trigger is renamed to sort after it.
drop trigger remittances_set_deposit on public.remittances;
create trigger remittances_zz_set_deposit
  before insert or update on public.remittances
  for each row execute function public.remittances_set_deposit();

-- Backfill every record, deleted ones included so a restored record is right, as a derived-value
-- correction: no change to updated_at or updated_by and no business audit event (the same approach as
-- 20261031000100_remittance_financials.sql). The triggers are switched off only around this update.
alter table public.remittances disable trigger remittances_audit_fields;
alter table public.remittances disable trigger remittances_business_audit;
alter table public.remittances disable trigger remittances_lock_financial_facts;

update public.remittances
set deposit_centavos = amount_due_centavos - allowance_centavos
where deposit_centavos is distinct from amount_due_centavos - allowance_centavos;

alter table public.remittances enable trigger remittances_audit_fields;
alter table public.remittances enable trigger remittances_business_audit;
alter table public.remittances enable trigger remittances_lock_financial_facts;
