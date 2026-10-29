begin;
select plan(6);

-- T127 (FR-022, FR-025): owner queries default to the fleet date in Asia/Manila. Between 00:00 and
-- 08:00 Manila the UTC current_date is a day behind; the behavioural checks below fail then if a
-- default still uses current_date, and the argument checks catch it at any hour.

select ok(pg_get_function_arguments('public.expiring_documents(date)'::regprocedure) like '%Asia/Manila%', 'expiring_documents() defaults to the Manila date');
select ok(pg_get_function_arguments('public.due_maintenance(date)'::regprocedure) like '%Asia/Manila%', 'due_maintenance() defaults to the Manila date');
select ok(pg_get_function_arguments('public.driver_outstanding_balances(date)'::regprocedure) like '%Asia/Manila%', 'driver_outstanding_balances() defaults to the Manila date');

insert into auth.users (id, email, aud, role)
values ('00000000-0000-0000-0000-000000230001', 'fleetdate-owner@rolnet.test', 'authenticated', 'authenticated');
update public.profiles
set role = 'owner', account_status = 'approved', approved_at = now(), approved_by = user_id
where user_id = '00000000-0000-0000-0000-000000230001';
insert into public.units (id, body_number, plate_number, make_model)
values ('00000000-0000-0000-0000-000000230101', 'FDT-230-A', 'FDT230A', 'Test Tricycle');
insert into public.documents (id, document_type, unit_id, expires_on, object_path, mime_type, size_bytes, sha256)
values ('00000000-0000-0000-0000-000000230401', 'insurance', '00000000-0000-0000-0000-000000230101',
        (now() at time zone 'Asia/Manila')::date - 1, 'documents/x/a.pdf', 'application/pdf', 100, 'abc');
insert into public.part_replacements (id, unit_id, part_name, cost_centavos, replaced_on, next_due_date)
values ('00000000-0000-0000-0000-000000230501', '00000000-0000-0000-0000-000000230101', 'Brake pads', 1000,
        (now() at time zone 'Asia/Manila')::date - 30, (now() at time zone 'Asia/Manila')::date);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000230001","role":"authenticated"}', true);
set local role authenticated;
select is((select bucket from public.expiring_documents() where id = '00000000-0000-0000-0000-000000230401'), 'expired',
  'a document that expired yesterday in Manila is expired by default');
select isnt_empty($$select 1 from public.due_maintenance() where item_id = '00000000-0000-0000-0000-000000230501'$$,
  'a part due today in Manila is due by default');
select is((select count(*) from public.expiring_documents()), (select count(*) from public.expiring_documents((now() at time zone 'Asia/Manila')::date)),
  'the default matches an explicit Manila date');
reset role;

select finish();
rollback;
