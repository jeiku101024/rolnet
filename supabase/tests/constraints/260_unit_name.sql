begin;
select plan(14);

-- Feature 007 (20261030000200_add_unit_name.sql): units have a 1–40 character name, unique among
-- non-deleted units ignoring case and surrounding spaces; a missing or blank name becomes the body
-- number; renames are audited; the name is locked with the other details while out of service.

select col_not_null('public', 'units', 'name', 'units.name is required');
select is((select count(*)::int from public.units where length(trim(name)) = 0), 0,
  'every existing unit has a non-blank name');

insert into public.units (id, body_number, plate_number, make_model)
values ('00000000-0000-0000-0000-000000260101', ' 0633 ', 'NAME260A', 'Yamaha YTX');
select is((select name from public.units where id = '00000000-0000-0000-0000-000000260101'), '0633',
  'a unit inserted without a name gets its trimmed body number');

insert into public.units (id, name, body_number, plate_number, make_model)
values ('00000000-0000-0000-0000-000000260102', 'ROLNET-1', 'NAME-260-B', 'NAME260B', 'Yamaha YTX');
select is((select name from public.units where id = '00000000-0000-0000-0000-000000260102'), 'ROLNET-1',
  'an explicit name is kept');

insert into public.units (id, name, body_number, plate_number, make_model)
values ('00000000-0000-0000-0000-000000260103', '   ', 'NAME-260-C', 'NAME260C', 'Honda TMX');
select is((select name from public.units where id = '00000000-0000-0000-0000-000000260103'), 'NAME-260-C',
  'a blank name falls back to the body number');

select throws_ok($$insert into public.units (name, body_number, plate_number, make_model) values (repeat('x', 41), 'NAME-260-D', 'NAME260D', 'Honda TMX')$$,
  '23514', null, 'a 41-character name is rejected');
select throws_ok($$insert into public.units (name, body_number, plate_number, make_model) values (' rolnet-1 ', 'NAME-260-E', 'NAME260E', 'Honda TMX')$$,
  '23505', null, 'a name that differs only in case and spacing is rejected');
select throws_ok($$update public.units set name = 'rolnet-1' where id = '00000000-0000-0000-0000-000000260103'$$,
  '23505', null, 'renaming a unit to a name in use is rejected');

update public.units set deleted_at = now() where id = '00000000-0000-0000-0000-000000260102';
select lives_ok($$insert into public.units (name, body_number, plate_number, make_model) values ('ROLNET-1', 'NAME-260-F', 'NAME260F', 'Honda TMX')$$,
  'a deleted unit''s name can be reused');

update public.units set name = 'ROLNET-7' where id = '00000000-0000-0000-0000-000000260101';
select isnt_empty($$select 1 from public.audit_events
  where entity_type = 'units' and entity_id = '00000000-0000-0000-0000-000000260101' and action = 'update'
    and changed_fields -> 'before' ->> 'name' = '0633' and changed_fields -> 'after' ->> 'name' = 'ROLNET-7'$$,
  'a rename is recorded in the audit history');

update public.units set status = 'in_repair' where id = '00000000-0000-0000-0000-000000260101';
select throws_ok($$update public.units set name = 'ROLNET-8' where id = '00000000-0000-0000-0000-000000260101'$$,
  '23514', null, 'an In repair unit refuses a name change');
select lives_ok($$update public.units set current_mileage = 100 where id = '00000000-0000-0000-0000-000000260101'$$,
  'an In repair unit still accepts other updates');

select ok(not has_function_privilege('authenticated', 'public.units_default_name()', 'execute')
  and not has_function_privilege('anon', 'public.units_default_name()', 'execute'),
  'the default-name trigger function is not executable by anon or authenticated');
select ok(not has_function_privilege('authenticated', 'public.lock_out_of_service_unit_details()', 'execute'),
  'the replaced lock function is still not executable by authenticated');

select finish();
rollback;
