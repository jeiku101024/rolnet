-- FR-016 / US3 scenario 4: driver_outstanding_balances() joined remittances to payments and then
-- summed the due, so a remittance with two payments counted its due twice. Payments are now
-- totalled per remittance first; each remittance's balance is greatest(due - paid, 0) (data model)
-- and a driver's outstanding total is the sum of those balances, so an overpayment on one day does
-- not hide an unpaid day.
--
-- The function now also returns, for each driver with an unpaid balance, the count and service
-- period of the unpaid remittances and an unpaid_remittances JSON array with each remittance's
-- unit (id and body number), service date, due, paid and balance. Only drivers with an outstanding
-- balance are returned (FR-027 "drivers with outstanding balances").
--
-- as_of defaults to the fleet date in Asia/Manila (T127), and payments received after as_of (in
-- the fleet time zone) are not counted. The return type changes, so the function is dropped and
-- recreated: EXECUTE is granted to authenticated again (lib/dashboard/queries.ts calls it) and
-- the is_owner() filter is kept.

drop function public.driver_outstanding_balances(date);

create function public.driver_outstanding_balances(as_of date default (now() at time zone 'Asia/Manila')::date)
returns table(
  driver_id uuid,
  driver_name text,
  outstanding_centavos bigint,
  unpaid_remittance_count integer,
  first_unpaid_service_date date,
  last_unpaid_service_date date,
  unpaid_remittances jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  with unpaid as (
    select
      r.id as remittance_id,
      r.driver_id,
      r.unit_id,
      u.body_number,
      r.service_date,
      r.amount_due_centavos,
      coalesce(paid.paid_centavos, 0) as paid_centavos,
      r.amount_due_centavos - coalesce(paid.paid_centavos, 0) as balance_centavos
    from public.remittances r
    join public.units u on u.id = r.unit_id
    left join lateral (
      select sum(p.amount_centavos)::bigint as paid_centavos
      from public.remittance_payments p
      where p.remittance_id = r.id
        and p.deleted_at is null
        and p.paid_at < ((as_of + 1)::timestamp at time zone 'Asia/Manila')
    ) paid on true
    where r.deleted_at is null
      and r.service_date <= as_of
      and r.amount_due_centavos > coalesce(paid.paid_centavos, 0)
      and public.is_owner()
  )
  select
    d.id,
    d.full_name,
    sum(x.balance_centavos)::bigint,
    count(*)::integer,
    min(x.service_date),
    max(x.service_date),
    jsonb_agg(
      jsonb_build_object(
        'remittance_id', x.remittance_id,
        'unit_id', x.unit_id,
        'body_number', x.body_number,
        'service_date', x.service_date,
        'amount_due_centavos', x.amount_due_centavos,
        'paid_centavos', x.paid_centavos,
        'balance_centavos', x.balance_centavos
      )
      order by x.service_date, x.body_number
    )
  from public.drivers d
  join unpaid x on x.driver_id = d.id
  where d.deleted_at is null
  group by d.id, d.full_name
  order by sum(x.balance_centavos) desc, d.full_name;
$$;

grant execute on function public.driver_outstanding_balances(date) to authenticated;
