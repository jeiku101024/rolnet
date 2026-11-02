# Contract: Database

**Feature**: [../spec.md](../spec.md) | **Data model**: [../data-model.md](../data-model.md)

## Migrations

1. `supabase/migrations/20261102000300_document_lifecycle_reverted.sql`:
   `alter type public.document_lifecycle add value 'reverted';` and nothing else (R2).
2. `supabase/migrations/20261102000400_document_versions.sql`: the new columns, constraints,
   indexes, and backfill on `documents`; the `document_event_kind` enum and `document_events` table
   with its triggers and RLS; the five functions below; `renew_compliance_document` redefined to call
   the shared renewal path; `lock_inactive_driver_details` redefined to accept the `rolnet.document_license_sync` flag (R6); `expiring_documents`
   redefined for the 7-day rule (R11); and grants.

## Functions

All functions use `set search_path = public` and start with `revoke execute ... from public, anon,
authenticated`.

| Function | Security | Granted to | Returns |
|----------|----------|------------|---------|
| `save_compliance_document(p_document jsonb)` | definer + `require_owner()` | `authenticated` | `jsonb {version_id, renewed, previous_id}` |
| `revert_document_upload(p_current_id uuid)` | definer + `require_owner()` | `authenticated` | `jsonb {result: 'previous'\|'removed', version_id, restored_id}` |
| `restore_document_version(p_version_id uuid, p_current_id uuid)` | definer + `require_owner()` | `authenticated` | `jsonb {version_id, moved_id}` |
| `bring_back_document_version(p_version_id uuid, p_current_id uuid)` | definer + `require_owner()` | `authenticated` | `jsonb {result: 'swapped'\|'recreated', version_id, moved_id}` |
| `mark_document_files_deleted(p_ids uuid[])` | invoker | `service_role` only | `integer` (rows marked) |
| `renew_compliance_document(uuid, jsonb)` | definer + `require_owner()` (unchanged grant) | `authenticated` | `documents` (kept for compatibility) |
| `expiring_documents(date)` | definer (unchanged, `is_owner()` filter) | `authenticated` | buckets `expired`, `due_7` only, up to `as_of + 7` |

The definer functions start with `require_owner()`, the same rule as the owner-only RLS on
`documents`, `document_events` and `drivers` (FR-046). The private helpers they call get no grant. `mark_document_files_deleted` updates only `file_deleted_at` on rows that are `reverted`,
have `purge_after <= now()`, and have `file_deleted_at is null`.

### Shared behaviour of the four user functions

1. Take `pg_advisory_xact_lock(hashtextextended('document:' || type || ':' || holder_id, 0))`.
2. Read the document's rows `for update`.
3. **Stale check**: the current row id must equal `p_current_id` (null means "no current row").
   Otherwise raise `40001` with "This document changed since you opened it. Reload and try again."
4. For licenses, set the transaction-local flag `rolnet.document_license_sync` (R6). Then demote,
   update the license profile date, and promote or insert. A first upload also sets the profile date.
5. Insert one `document_events` row with a summary.
6. Return the JSON result.

### `save_compliance_document(p_document jsonb)`

Keys: `document_type`, `unit_id` or `driver_id`, `document_number`, `issued_on`, `expires_on`,
`object_path`, `mime_type`, `size_bytes`, `sha256`, `file_name`, `idempotency_key`, and
`expected_current_id` (optional, used as the stale check when present).
- If `idempotency_key` already exists, return that version (`renewed` as originally saved).
- With no current row: insert as `current` and log `uploaded`.
- With a current row: demote it to `superseded` (`superseded_at = now()`, `superseded_by_id` = the
  new row), insert the new `current` row, and log `renewed`.
- The unit must not be archived (`P0001` "This unit is archived. Choose another unit.").

### `revert_document_upload(p_current_id uuid)`

- Refuses (`P0001`) when the newest event is `restored`: "This version was restored. Use Restore to
  choose another version."
- The current row becomes `reverted` (`reverted_at = now()`, `reverted_by = auth.uid()`,
  `purge_after = now() + 30 days`).
- If a `superseded` row exists, the newest by `superseded_at` becomes `current` (`superseded_at`
  cleared). Log `reverted` with the summary "Reverted A. B restored." The result is `previous`.
- Otherwise log `removed` with the summary "Reverted A. Document removed." The result is `removed`.

### `restore_document_version(p_version_id uuid, p_current_id uuid)`

- `p_version_id` must be a `superseded` row of the same document (`P0002` "That version is no longer
  in the history. Reload and try again.").
- The current row becomes `superseded` (`superseded_at = now()`), and the target becomes `current`.
  Log `restored` with the summary "Restored A. B moved to history."

### `bring_back_document_version(p_version_id uuid, p_current_id uuid)`

- `p_version_id` must be `reverted` with the file kept (`P0001` "This file was deleted after 30 days
  and can't be brought back.").
- If a current row exists, it becomes `superseded`. The result is `swapped`. Otherwise the result is
  `recreated`.
- Clear `reverted_at`, `reverted_by`, and `purge_after` on the target and make it `current`. Log
  `brought_back` with the summary "Brought back A. B moved to history." or "Brought back A."
- The unit must not be archived and the driver must not be deleted.

## Error codes the app maps (`lib/actions/errors.ts`)

| SQLSTATE | Meaning | App code |
|----------|---------|----------|
| `40001` (raised) | Stale: the document changed | `STALE_RECORD` |
| `P0001` | Rule refused (restored, file deleted, archived unit) | `RULE` (message shown) |
| `P0002` | Version not found / not in history | `NOT_FOUND` |
| `23505` | Concurrent current-row race (should not happen under the lock) | `STALE_RECORD` |
| `23514` | License date triggers | message shown |

## RLS and Storage

- `documents`: unchanged (owner select, insert, update).
- `document_events`: owner select only. No insert, update or delete policy, plus `reject_hard_delete`;
  events are written only by the private definer helper `document_log_event`.
- Storage `documents` bucket: unchanged. Owner read is needed for View file on History and kept
  reverted files. The retention job deletes with the service role.

## pgTAP coverage

| File | Covers |
|------|--------|
| `supabase/tests/constraints/370_document_versions.sql` | New columns and constraints, backfill of `superseded_at`, `save_compliance_document` first upload and renewal and idempotency, events written, archived unit refused |
| `supabase/tests/constraints/380_document_revert_restore.sql` | Revert with history and as removal, stepping back twice, refusal after restore, stale `p_current_id`, restore swap and History order, bring back (swap, recreate, file deleted, past `purge_after`), license profile date after every action (first upload, renewal, revert, restore, bring back swap and recreate), for an active and an inactive driver, plus the only-license removal, `mark_document_files_deleted` scope |
| `supabase/tests/rls/240_document_versions_rls.sql` | Staff, unapproved, and anon can't call the four functions or read events; owner can; `mark_document_files_deleted` not executable by `authenticated` |
| `supabase/tests/constraints/050_documents.sql`, `rls/050_documents_storage_rls.sql` | Updated for the 7-day `expiring_documents` buckets |
| `supabase/tests/rls/120_function_execute_rls.sql` | New functions in the execute-grant inventory |

They run against rolnet-dev through the rollback wrapper, **after you approve it** (no local
Supabase). Run the full suite, not just the new files.
