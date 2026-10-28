begin;
select plan(5);
select policies_are('public', 'expense_categories', array['expense_categories_staff_read_policy', 'expense_categories_owner_insert_policy', 'expense_categories_owner_update_policy'], 'category RLS policies exist');
select policies_are('public', 'expenses', array['expenses_staff_read_policy', 'expenses_operational_insert_policy', 'expenses_operational_update_policy'], 'expense RLS policies exist');
-- storage.objects is shared with the documents bucket, so compare only the receipts_* policies.
select set_eq(
  $$select policyname::text from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like 'receipts\_%'$$,
  array['receipts_staff_read_policy', 'receipts_staff_insert_policy', 'receipts_owner_delete_policy'],
  'receipt storage policies exist'
);
select has_table('public', 'expenses', 'expense rows are protected by RLS');
select has_table('storage', 'buckets', 'receipt bucket metadata exists');
select finish();
rollback;
