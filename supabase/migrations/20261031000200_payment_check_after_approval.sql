-- Feature 009 follow-up: validate_remittance_payment() is security definer and BEFORE triggers run
-- before RLS WITH CHECK, so a signed-in user who isn't approved got the over-rental message (which
-- reveals the rental and how much is paid) and could take a row lock on the remittance. For such a
-- caller the trigger now does nothing, and the insert policy rejects the row with 42501 as before.
-- Calls without a JWT (migrations, the service role) are still checked.

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
  if auth.uid() is not null and not public.is_approved_user() then
    return new;
  end if;

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

-- create or replace keeps the earlier grants; restate the rule for this trigger function.
revoke execute on function public.validate_remittance_payment() from public, anon, authenticated;
