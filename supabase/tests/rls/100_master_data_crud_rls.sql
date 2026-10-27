begin;
select plan(2);
select policies_are('public','units',array['units_staff_read_policy','units_owner_insert_policy','units_owner_update_policy'],'unit policies remain explicit');
select policies_are('public','documents',array['documents_owner_select','documents_owner_insert','documents_owner_update'],'document policies remain explicit');
select finish();
rollback;
