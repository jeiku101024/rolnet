-- FR-013a: after a remittance is saved, its service date, disposition, calculated due, unit,
-- driver and assignment cannot change for anyone (staff or owner). Notes stay editable, and
-- payments are separate rows. Owners correct a wrong entry with reverse_remittance() and a new
-- replacement remittance, both of which are audited.
--
-- The trigger is named so it fires before remittances_validate (BEFORE triggers fire in name
-- order); otherwise validate_remittance() would silently reset a changed amount due instead of
-- rejecting it.

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
     or new.unit_id is distinct from old.unit_id
     or new.driver_id is distinct from old.driver_id
     or new.assignment_id is distinct from old.assignment_id
  then
    raise exception using errcode = '23514',
      message = 'A saved remittance''s date, disposition, amount due, unit, driver and assignment cannot be changed. Reverse it and record a replacement entry.';
  end if;
  return new;
end;
$$;

create trigger remittances_lock_financial_facts
  before update on public.remittances
  for each row execute function public.lock_remittance_financial_facts();

-- The facts validate_remittance() checks can no longer change after insert, so it only needs to
-- run on insert. Running it on update would also block note edits and reversals once the
-- assignment later ends or is edited.
drop trigger remittances_validate on public.remittances;
create trigger remittances_validate
  before insert on public.remittances
  for each row execute function public.validate_remittance();
