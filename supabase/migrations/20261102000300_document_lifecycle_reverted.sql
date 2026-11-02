-- Feature 013 (specs/013-documents-page-redesign), migration 1 of 2.
--
-- A mistaken upload is marked 'reverted' instead of being deleted (research R2). Postgres can't use a
-- new enum value in the transaction that adds it, so the value gets its own migration and
-- 20261102000400 uses it.

alter type public.document_lifecycle add value if not exists 'reverted';
