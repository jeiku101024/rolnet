begin;
select plan(10);

-- 20261103000300_restore_payments_deposit_rule.sql: after feature 014's detour the deposit is again the
-- remittance's active payments minus its allowance, and moves with each payment. The trigger kept the name
-- remittances_zz_set_deposit from 20261103000100.

insert into public.units (id, body_number, plate_number, make_model)
values ('00000000-0000-0000-0000-000000390101', 'DEP-390-A', 'DEP390A', 'Test Tricycle');
insert into public.drivers (id, full_name, license_number, license_expiry_date, phone)
values ('00000000-0000-0000-0000-000000390201', 'Deposit Rule Driver', 'DEP-390-L1', '2035-12-31', '09170000390');
insert into public.driver_assignments (id, unit_id, driver_id, assignment_type, starts_on)
values ('00000000-0000-0000-0000-000000390301', '00000000-0000-0000-0000-000000390101', '00000000-0000-0000-0000-000000390201', 'primary', '2031-10-01');
insert into public.unit_assignments (unit_id, driver_id, service_date)
values ('00000000-0000-0000-0000-000000390101', '00000000-0000-0000-0000-000000390201', '2031-10-01'),
  ('00000000-0000-0000-0000-000000390101', '00000000-0000-0000-0000-000000390201', '2031-10-02')
on conflict do nothing;
insert into public.remittances (id, unit_id, driver_id, service_date, disposition, idempotency_key)
values
  ('00000000-0000-0000-0000-000000390401', '00000000-0000-0000-0000-000000390101',
   '00000000-0000-0000-0000-000000390201', '2031-10-01', 'returned', gen_random_uuid()),
  ('00000000-0000-0000-0000-000000390402', '00000000-0000-0000-0000-000000390101',
   '00000000-0000-0000-0000-000000390201', '2031-10-02', 'overnight_overtime', gen_random_uuid());

select is((select array[allowance_centavos, deposit_centavos] from public.remittances where id = '00000000-0000-0000-0000-000000390401'),
  array[4000, -4000]::bigint[], 'a new remittance with no payment has deposit -4,000');

insert into public.remittance_payments (id, remittance_id, amount_centavos, idempotency_key)
values ('00000000-0000-0000-0000-000000390501', '00000000-0000-0000-0000-000000390401', 10000, gen_random_uuid());
select is((select deposit_centavos from public.remittances where id = '00000000-0000-0000-0000-000000390401'),
  6000::bigint, 'a 10,000 payment gives deposit 6,000');

insert into public.remittance_payments (remittance_id, amount_centavos, idempotency_key)
values ('00000000-0000-0000-0000-000000390401', 8000, gen_random_uuid());
select is((select deposit_centavos from public.remittances where id = '00000000-0000-0000-0000-000000390401'),
  14000::bigint, 'paying the rest gives deposit 14,000');

update public.remittance_payments set deleted_at = now() where id = '00000000-0000-0000-0000-000000390501';
select is((select deposit_centavos from public.remittances where id = '00000000-0000-0000-0000-000000390401'),
  4000::bigint, 'voiding a payment recalculates the deposit');

select is((select deposit_centavos from public.remittances where id = '00000000-0000-0000-0000-000000390402'),
  -4000::bigint, 'an unpaid overnight remittance has deposit -4,000 whatever its rental');

-- The trigger still sorts after remittances_validate, which sets the rental on insert.
select is((select count(*)::int from pg_trigger where tgrelid = 'public.remittances'::regclass and tgname in ('remittances_validate', 'remittances_zz_set_deposit') and not tgisinternal), 2,
  'both the validate and the deposit trigger exist');

-- A stored value that disagrees with the rule is replaced the next time the row is written.
update public.remittances set deposit_centavos = 999 where id = '00000000-0000-0000-0000-000000390401';
select is((select deposit_centavos from public.remittances where id = '00000000-0000-0000-0000-000000390401'),
  4000::bigint, 'a direct deposit write is replaced by the formula');

-- Backfill invariant: no record, deleted ones included, disagrees with the rule.
select is((select count(*)::int from public.remittances r
  where r.deposit_centavos <> coalesce((select sum(p.amount_centavos) from public.remittance_payments p
    where p.remittance_id = r.id and p.deleted_at is null), 0) - r.allowance_centavos), 0,
  'every remittance has deposit = active payments - allowance');

select ok(not has_function_privilege('authenticated', 'public.remittances_set_deposit()', 'execute')
  and not has_function_privilege('anon', 'public.remittances_set_deposit()', 'execute'),
  'remittances_set_deposit is not executable by anon or authenticated');
select ok(not has_function_privilege('authenticated', 'public.remittance_payments_sync_deposit()', 'execute')
  and not has_function_privilege('anon', 'public.remittance_payments_sync_deposit()', 'execute'),
  'remittance_payments_sync_deposit is not executable by anon or authenticated');

select finish();
rollback;
