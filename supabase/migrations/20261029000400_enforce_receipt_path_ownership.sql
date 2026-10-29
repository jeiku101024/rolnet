-- FR-017 / Constitution III: an expense's receipt must be its own file. Receipts are uploaded to
-- receipts/<expense id>/<file> (the Storage insert policy checks the expense id segment), but the
-- metadata column accepted any path, so one expense could point at another expense's receipt.

alter table public.expenses
  add constraint receipt_object_path_owner_check check (
    receipt_object_path is null
    or receipt_object_path ~ ('^receipts/' || id::text || '/[^/]+$')
  );
