begin;
select plan(2);
set local role anon;
select throws_ok($$select * from public.units$$,'42501',null,'anonymous API reads are denied');
select throws_ok($$select * from public.documents$$,'42501',null,'anonymous document reads are denied');
select finish();
rollback;
