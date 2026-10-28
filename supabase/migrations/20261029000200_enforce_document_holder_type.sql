-- FR-023 / data model: a document's holder must match its type. A driver license belongs to a
-- driver; OR/CR, MTOP franchise and insurance documents belong to a unit. document_holder_check
-- already requires exactly one holder, so it is enough to tie driver_id to the license type.
--
-- Soft-deleted rows are exempt so that wrongly paired documents saved before this migration can
-- still be archived (and are already excluded from current views). Restoring such a row would
-- have to fix the pairing first.

alter table public.documents
  add constraint document_holder_type_check check (
    deleted_at is not null
    or (document_type = 'driver_license') = (driver_id is not null)
  );
