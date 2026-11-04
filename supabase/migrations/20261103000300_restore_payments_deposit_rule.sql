-- Owner decision after feature 014: the app's Deposit goes back to feature 009's rule, active payments
-- minus the allowance (it may be negative and moves with each payment). This undoes the value change made by
-- 20261103000100_report_deposit_rule.sql, which is already pushed and is not edited.
--
-- The trigger keeps the name remittances_zz_set_deposit from that migration. Only the function body and the
-- stored values change.

-- Always recalculates, so a client can never store a wrong deposit. The allowance rate (4000) is inlined
-- (see feature 009): this trigger runs as the caller, who has no EXECUTE on new public functions.
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

revoke all on function public.remittances_set_deposit() from public, anon, authenticated;

-- Backfill every record, deleted ones included, as a derived-value correction: no change to updated_at or
-- updated_by and no business audit event (the same approach as 20261031000100 and 20261103000100).
alter table public.remittances disable trigger remittances_audit_fields;
alter table public.remittances disable trigger remittances_business_audit;
alter table public.remittances disable trigger remittances_lock_financial_facts;

update public.remittances r
set deposit_centavos = coalesce((
    select sum(p.amount_centavos) from public.remittance_payments p
    where p.remittance_id = r.id and p.deleted_at is null
  ), 0) - r.allowance_centavos
where r.deposit_centavos is distinct from coalesce((
    select sum(p.amount_centavos) from public.remittance_payments p
    where p.remittance_id = r.id and p.deleted_at is null
  ), 0) - r.allowance_centavos;

alter table public.remittances enable trigger remittances_audit_fields;
alter table public.remittances enable trigger remittances_business_audit;
alter table public.remittances enable trigger remittances_lock_financial_facts;
