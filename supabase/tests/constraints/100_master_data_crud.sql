begin;
select plan(3);
select has_function('public','renew_compliance_document',array['uuid','jsonb'],'document renewal is atomic');
select has_index('public','documents','documents_current_unit_unique','one current unit document is enforced');
select has_index('public','documents','documents_current_driver_unique','one current driver document is enforced');
select finish();
rollback;
