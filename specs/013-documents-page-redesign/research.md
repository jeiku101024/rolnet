# Research: Documents Page Redesign

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Date**: 2026-11-02

Each item records a decision, why, and what else was considered. Facts about today's code were
checked in the repository on 2026-11-02.

## Facts about today's system

- `public.documents` stores **one row per version**. `lifecycle_status` is `current`, `superseded`,
  or `void`, and `superseded_by_id` points at the row that replaced it. Partial unique indexes allow
  one `current`, non-deleted row per (type, unit) and per (type, driver).
- `renew_compliance_document(previous_id, jsonb)` (security invoker, granted to `authenticated`)
  supersedes the current row, updates the driver profile's `license_expiry_date` for licenses, and
  inserts the renewal, all in one transaction (20261029001500).
- Three triggers keep licenses in step: `validate_license_document_expiry` (a current license must
  match the profile date), `validate_driver_license_expiry_change` (the profile date can't move while a
  current license has another date), and `lock_inactive_driver_details` (an inactive driver's
  license date may change only while a license row was superseded in the same transaction,
  20261030000100).
- RLS: documents select, insert, and update are owner-only. Storage bucket `documents` is private,
  5 MB, and limited to JPG, PNG, WebP, and PDF. Read, insert, and delete are owner-only.
- `audit_business_change` already audits every write to `documents` into `audit_events`.
- No original file name is stored. The object path is `documents/<uuid>/<uuid>.<ext>`.
- `expiring_documents(as_of)` returns buckets `expired`, `due_7`, and `due_30` up to 30 days ahead.
  The dashboard tile says "Expired or within 30 days" and links to `/documents?expiry=due`.
- The app never uses `SUPABASE_SERVICE_ROLE_KEY` today. It is server-only in `.env.example`.
- `components/ui/toast.tsx` already supports one action ("Undo") and a per-toast timeout (feature 012).
- `dialog`, `alert-dialog`, `checkbox`, `popover`, `tooltip`, and `sheet` exist in `components/ui/`.

## R1. What is a "document"

**Decision**: A document is the set of version rows that share a document type and holder. Its
current version is the one row with `lifecycle_status = 'current'`. No new parent table is added.

**Rationale**: This matches today's schema, the unique indexes, the API, and the dashboard. The
spec says "reuse the existing document records and their history".

**Alternatives**: A new `compliance_documents` parent table with a `current_version_id`. It is
cleaner to describe, but it means a data move for every row, a second source of truth beside the
unique indexes, and changes to the API and dashboard queries. Rejected (Principle II).

## R2. Representing a reverted version

**Decision**: Add the lifecycle value `reverted`, plus the columns `reverted_at`, `reverted_by`,
`purge_after`, and `file_deleted_at`. A check constraint ties them together:
`(lifecycle_status = 'reverted') = (reverted_at is not null)`, and `purge_after` is required when
the version is reverted. The enum value is added in its own migration, because Postgres can't use a
newly added enum value in the same transaction.

**Rationale**: A reverted version must drop out of "current" and "History" but keep its record. A
lifecycle value keeps every existing `lifecycle_status = 'current'` query correct without changes.

**Alternatives**: Flag columns only, with lifecycle staying `superseded`. That would make every
History query add `reverted_at is null`, and a missed filter would show mistaken files as history.
Rejected.

## R3. A removed first upload

**Decision**: When the only non-reverted version is reverted, the document has no `current` row and
counts as **removed**. Nothing else changes, and `deleted_at` is not set. Bring back promotes the
reverted row to `current` again.

**Rationale**: Every list already reads only `current` rows, so the document vanishes from the
tree, the driver list, counts, the dashboard, and reports with no new filter. `deleted_at` stays
reserved for the legacy Archive action, which has its own meaning (`void`). The spec's data model asks
for a soft delete. This meets the intent (excluded from all lists and counts, all records kept)
without overloading `deleted_at`, which the read paths and API treat as "archived".

**Alternatives**: Set `deleted_at` and `deleted_by` on the reverted row. That conflicts with the
`document_holder_type_check` exemption for soft-deleted rows, hides the row from API reads, and needs
a restore path through deleted rows. Rejected.

## R4. History order and "moves to history"

**Decision**: Add `superseded_at timestamptz`, set whenever a version leaves `current` for
`superseded`. History is ordered by `superseded_at desc, created_at desc`. The backfill takes each
superseded row's successor `created_at`, or its own `updated_at` when it has none.

**Rationale**: After a Restore or Bring back, the former current version must be the **newest**
History entry, even though it was uploaded later or earlier than others. `created_at` can't express
that.

**Alternatives**: Order by `updated_at`. Any unrelated edit (for example the API updating
`document_number`) would reorder History. Rejected.

## R5. One database function per action

**Decision**: Five new SQL functions, each one transaction, each taking an advisory lock on
(document type, holder) and checking the version the caller saw:

| Function | Replaces / adds |
|----------|-----------------|
| `save_compliance_document(p_document jsonb)` | First upload or renewal (replaces the app's insert-or-`renew_compliance_document` branch) |
| `revert_document_upload(p_current_id uuid)` | Revert upload and toast Undo |
| `restore_document_version(p_version_id uuid, p_current_id uuid)` | Restore from History |
| `bring_back_document_version(p_version_id uuid, p_current_id uuid)` | Bring back (swap or recreate) |
| `mark_document_files_deleted(p_ids uuid[])` | Retention job bookkeeping (service role only) |

**Implementation note (2026-11-02)**: the four user functions are `security definer` and start with
`require_owner()`. The rolnet-dev dry run showed that an invoker function can't call the private
helpers (`document_lock`, `document_set_license_date`, `document_log_event`) without granting them
to `authenticated`, and that would let users call them directly. The access rule is the same owner
check the RLS policies use. `mark_document_files_deleted` stays `security invoker`, granted to
`service_role` only, which bypasses RLS, so it needs no caller check (CLAUDE.md). The first four rely on the owner-only RLS on `documents`. That is the page's only
access rule (FR-046: no extra role checks).

**Rationale**: Every action swaps two rows, may change the driver profile, and writes an Activity
event. The constitution prefers one transactional function when the schema already changes, so no
sequential-write clause is needed. The `p_current_id` arguments make Undo and stale modals safe
(spec: "Undo does nothing if the document has changed since"; concurrent edits are rejected).

**Alternatives**: Server-action sequences of updates. These risk half-applied swaps and break the
unique index ordering. Rejected.

`renew_compliance_document` is kept (redefined to call `save_compliance_document`'s renewal path) so
existing tests and any external caller keep working.

## R6. Driver licenses and the profile date (clarified FR-044a)

**Decision**: Inside each function, the order is: (1) demote the current row, if any (`superseded`
or `reverted`), (2) update `drivers.license_expiry_date` to the expiry of the version about to become
current, (3) promote that version to `current`, or insert it for an upload. Every action that
changes the current license does this, **including a first upload**, so a first license with a new
expiry now updates the profile instead of being refused. When a revert removes the only license,
steps 2 and 3 are skipped and the profile keeps its date.

Inactive drivers: before step 2, each function sets a transaction-local flag,
`perform set_config('rolnet.document_license_sync', 'on', true)`. `lock_inactive_driver_details` is
redefined to allow the license-date change when
`current_setting('rolnet.document_license_sync', true) = 'on'`. It keeps today's
"superseded in this transaction" exception for `renew_compliance_document` callers. The flag ends
with the transaction, and PostgREST doesn't expose `set_config`, so app users can't set it.

**Rationale**: It satisfies all three existing license triggers in one transaction for every action:
first upload, renewal, revert, restore, bring back (swap and recreate). It also works for inactive
drivers, whose licenses stay visible (FR-023). The flag replaces the `updated_at = now()` heuristic,
which can't see a first upload (no earlier row) or a bring back of a removed license (the profile is
updated before the reverted row is touched).

**Alternatives**:
- Extend the `updated_at = now()` heuristic to `reverted` rows. That misses the two cases above.
  Rejected.
- Drop the profile-match triggers. They protect feature 001's FR-023. Rejected.

## R7. Activity events

**Decision**: A new append-only table `document_events` with `kind` (`uploaded`, `renewed`,
`reverted`, `removed`, `brought_back`, `restored`), the holder and type, the version acted on, the
related version (the one restored or moved to history), file names, and a plain `summary` ("Restored
OR-2025.pdf. OR-2026.pdf moved to history."). The five functions write it, it has the standard audit
columns and `reject_hard_delete`, and `audit_business_change` is attached, so each event also lands
in the audit log with the summary in `changed_fields`. The details modal reads the 5 newest events
for (type, holder). Versions created before this feature, or through the API's plain insert, show a
synthesized "Uploaded" entry from their `created_at` and `created_by`.

**Rationale**: The audit log records row changes, not intent. "Restored X, Y moved to history" can't
be reliably reconstructed from two row updates. A small events table is the simplest readable
source, and the audit trigger keeps the audit log complete (FR-044, SC-006).

**Alternatives**: Read Activity from `audit_events` only. That means decoding lifecycle diffs into
words, and it is fragile. Rejected.

## R8. "Revert upload" hidden after Restore (clarified)

**Decision**: Revert is allowed when the newest `document_events` row for (type, holder) is not
`restored`. `revert_document_upload` refuses otherwise with "This version was restored. Use Restore
to choose another version." The modal hides the link by the same rule. Undo is always on a fresh
upload, so it is never blocked by this rule.

**Rationale**: The rule lives in one place (the database) and the UI mirrors it.

## R9. File names

**Decision**: Add `file_name text` (1 to 200 characters, trimmed) to `documents`. The upload modal
sends the chosen file's name. Older rows have no name. The UI shows a derived label
"[Type] [holder] [created date].[ext]", for example "OR-CR T-001 2026-10-01.pdf". Search matches
the shown name.

**Alternatives**: Backfill names in SQL. The derived label is the same text, without a migration
that writes every row. Rejected.

## R10. Retention job (daily purge)

**Decision**: A route handler `app/api/cron/purge-document-files/route.ts` accepts `POST` with
`Authorization: Bearer $CRON_SECRET`. It uses a server-only service-role Supabase client
(`lib/supabase/service.ts`, never imported by client code) to:

1. Select reverted versions with `purge_after <= now()` and `file_deleted_at is null` (at most 100 per
   run).
2. Remove their objects through the Storage API.
3. Call `mark_document_files_deleted(ids)` for the objects removed (or already missing).

A GitHub Actions workflow `.github/workflows/purge-document-files.yml` calls it daily at 02:00
Asia/Manila (`cron: "0 18 * * *"` UTC), and it can also be run by hand (`workflow_dispatch`). Until the
job runs, the app treats `purge_after <= now()` as "File deleted": Bring back and View file are
hidden, and the functions refuse.

**Rationale**: It stays free. GitHub Actions scheduled workflows are free for this repository, and
the route is part of the monolith. Supabase blocks direct SQL deletes from `storage.objects`, so the
purge has to go through the Storage API with a privileged key. Hiding past-due files right away means users never see a past-due file, even if a run is late.

**Risk**: the repository is public, and GitHub turns off scheduled workflows after 60 days without a
commit. A backstop on the Documents page warns the owner when any due file is more than 2 days
late, so a stopped schedule is noticed and re-enabled (tasks T075, T076).

**Alternatives**:
- Cloudflare Workers Cron Triggers (free). The vinext Worker entry doesn't expose a `scheduled`
  handler today, so adding one means a custom Worker entry. Kept as a later option.
- Supabase `pg_cron` plus `pg_net` calling the route. This needs the app URL and secret stored in the
  database vault, which is more moving parts.
- Purge when the owner opens the page. Files could stay for months if nobody visits. Rejected.

## R11. Status tiers everywhere (clarified FR-011a)

**Decision**: A new pure helper, `lib/documents/status.ts`, returns `expired`, `due`, or `valid`
using the fleet date (`fleetToday`, Asia/Manila). `ExpiryStatus` uses it and gains icons (lucide
`CircleX`, `TriangleAlert`, `CircleCheck`). A migration redefines `expiring_documents` to return only
`expired` and `due_7`, up to `as_of + 7`. The dashboard tile reads "Expired or within 7 days", the
panel's empty text reads "No documents expire in the next 7 days.", and both link to the new filter
URL. The `expiry` bucket filter in `list-control-specs` drops the 30-day option, and pgTAP 050 tests
are updated.

## R12. Client-side tree, server-loaded data

**Decision**: The page (a server component) loads, in parallel: current versions for non-archived
units and non-deleted drivers (driver licenses only), non-archived units, non-deleted drivers, and
reverted versions from the last 30 days. A client component `DocumentsWorkspace` does search, filter,
sort, grouping, and highlighting in memory, so search is live without a server round trip. The
details modal loads its History, Reverted uploads, and Activity on open through a server action.

**Rationale**: About 100 units and 400 documents is a few hundred KB at most (SC-005). Paging is
dropped (spec assumption). Live search needs client filtering.

**Alternatives**: Server-side search per keystroke through the URL, as the other list pages do. It is
too slow for live file-explorer search. Rejected.

## R13. URL state (clarified FR-009a)

**Decision**: The params are `usearch`, `utype`, `ustatus`, `dsearch`, `dstatus` (multi-value as
comma lists, for example `ustatus=expired,due`), `sort` (`expiry`, `expiry-desc`, `name`, `type`),
and `doc` (an open details modal, by version id). The workspace writes them with
`router.replace(..., { scroll: false })`, debounced 300 ms for search. Expand state is in memory
only. The old `?expiry=due` maps to `ustatus=expired,due&dstatus=expired,due`. `/documents/[id]`
becomes a redirect to `/documents?doc=<current version id of that type and holder>`. If the
document was removed, it goes to `/documents`.

**Note**: `useSearchParams` in a client component needs a `<Suspense>` boundary under
`cacheComponents` (Next 16). Check `node_modules/next/dist/docs/` for the current guidance before
building.

## R14. Tree accessibility

**Decision**: The tree is built in-house in `components/documents/unit-tree.tsx` following the WAI-ARIA
tree pattern: `role="tree"`, `treeitem` with `aria-level`, `aria-expanded`, `aria-setsize`, and
`aria-posinset`, and a `role="group"` for children. Focus is roving `tabIndex`, and a small
`useTreeKeyboard` hook in `hooks/` handles Up, Down, Left, Right, Home, End, Enter, and Space. The
focus ring uses the existing `focus-visible` token classes.

**Alternatives**: A tree library. CLAUDE.md doesn't allow new component libraries. Rejected.

## R15. Upload modal

**Decision**: Reuse `components/forms/document-form.tsx` inside a `Dialog` as
`components/documents/upload-document-dialog.tsx`, with a `scope` prop (`unit` or `driver`) and
optional preset type and holder. The flow stays the same (prepare path, upload to Storage, save),
with `save_compliance_document` at the end, and the file name is sent. If saving fails, the uploaded
object is removed (existing `removeDocumentObject`). The messages change to the spec's wording
("Use a JPG, PNG, WebP or PDF file.", "File is larger than 5 MB.").

## R16. Demo mode

**Decision**: The demo data gains version history, one reverted renewal (kept), one removed first
upload, one old revert with "File deleted", events, an inactive driver's license, and one unit with no
documents. Demo mode stays read-only, as on the other pages (actions don't write in demo mode). So the
Playwright e2e covers the tree, search, filters, sort, URL state, the details modal, every confirmation
modal's text and Cancel path, and the upload modal's validation. The writes (save, revert, Undo,
restore, Bring back, and the license date) are covered by pgTAP and by the rolnet-dev walkthrough
in [quickstart.md](quickstart.md).
