# Tasks: Documents Page Redesign

**Input**: Design documents from `specs/013-documents-page-redesign/`
**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests**: Included. CLAUDE.md requires pgTAP coverage for every migration, and a task is done only
when lint, typecheck, Vitest (and `supabase test db` when the schema changes) pass. Playwright specs
follow the plan.

**Hard rules for every task** (CLAUDE.md, constitution 1.1.0, memory):
- **Schema**: schema, RLS, Storage policies, and SQL functions change only in the two new migrations below, each with pgTAP coverage. Never edit a migration after it is pushed.
- **Grants**: every new `public` function starts with `revoke execute … from public, anon, authenticated`. Only the four user functions get `grant execute … to authenticated`. `mark_document_files_deleted` is granted to `service_role` only (contracts/database.md).
- **Data integrity (constitution III)**: no row is ever deleted. Reverting marks the row `reverted`; only the Storage object of a reverted row past `purge_after` is removed, by the retention job. `document_events` has the audit columns, `reject_hard_delete`, and `audit_business_change`. Every multi-row change runs inside one database function.
- **rolnet-dev needs the user's approval**: pushing migrations to rolnet-dev and running pgTAP there needs explicit approval (there's no local Supabase). Run the **full** pgTAP suite, not only the new files.
- **SQL edits from Node**: if a script edits SQL with `String.replace`, use a function replacer, because a string replacement turns `$$` into `$` (memory).
- **Fleet date**: `(now() at time zone 'Asia/Manila')::date` in SQL and `fleetToday()` in TypeScript.
- **Types**: `types/database.ts` is hand-maintained. Edit it by hand; don't regenerate it.
- **Next.js 16**: read the relevant guide in `node_modules/next/dist/docs/` before writing `useSearchParams`, `redirect`, or route-handler code (AGENTS.md).
- **UI (constitution IV)**: no new npm packages. Use shadcn `base-nova` components and tokens only (no hex or arbitrary sizes). Every screen works at 360 px, and every error says what to do next. Copy comes verbatim from contracts/ui.md.
- **Secrets**: `SUPABASE_SERVICE_ROLE_KEY` and `CRON_SECRET` are server-only. Never use `NEXT_PUBLIC_*` for them and never commit `.env*` (except `.env.example`).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: The user story the task belongs to (US1–US8 from spec.md)

## Path Conventions

Single Next.js monolith at the repo root: `app/`, `components/`, `hooks/`, `lib/`, `supabase/`, `tests/`, `types/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Small shared changes that several stories use.

- [X] T001 [P] Add `CRON_SECRET=server-only-random-string` under the server-only section of `.env.example`, with a comment saying the daily purge workflow sends it as a Bearer token (research R10).
- [X] T002 [P] Add an ESLint `no-restricted-imports` rule in `eslint.config.mjs` that forbids importing `@/lib/supabase/service` from everywhere except `app/api/cron/**` and `tests/**` (contracts/actions.md).
- [X] T003 [P] Change the document file messages in `lib/uploads/rules.ts` `documentFileProblem()` to exactly "Use a JPG, PNG, WebP or PDF file." and "File is larger than 5 MB.", keeping the empty-file message, and update any Vitest assertions that quote the old text.
- [X] T004 [P] Add the entity label `document_events: "Document activity"` to the entity label map in `lib/pagination/list-control-specs.ts`, so `/audit` names the new table.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The schema, the database functions, the shared status rule, the page data, and the
workspace shell. Every story depends on this phase.

### Database

- [X] T005 Create `supabase/migrations/20261102000300_document_lifecycle_reverted.sql` containing only `alter type public.document_lifecycle add value if not exists 'reverted';` with a header comment explaining why it is a separate file (research R2).
- [X] T006 Create `supabase/migrations/20261102000400_document_versions.sql`, part 1, columns and backfill. On `public.documents`, add `file_name text`, `superseded_at timestamptz`, `reverted_at timestamptz`, `reverted_by uuid references auth.users(id)`, `purge_after timestamptz`, and `file_deleted_at timestamptz`. Backfill `superseded_at` for `superseded` rows from the successor's `created_at` (via `superseded_by_id`), falling back to the row's own `updated_at`. Add these constraints verbatim from data-model.md: `documents_reverted_fields_check` (`(lifecycle_status = 'reverted') = (reverted_at is not null)`, and when reverted, `reverted_by` and `purge_after` are not null and `purge_after = reverted_at + interval '30 days'`), `documents_file_deleted_check` (`file_deleted_at is null or lifecycle_status = 'reverted'`), and `documents_file_name_check` (`file_name is null or length(btrim(file_name)) between 1 and 200`). Add the indexes `documents_reverted_recent_idx`, `documents_purge_due_idx`, and `documents_history_idx` as defined in data-model.md.
- [X] T007 Same migration, part 2, events. Create the enum `public.document_event_kind` (`uploaded`, `renewed`, `reverted`, `removed`, `brought_back`, `restored`) and the table `public.document_events` with the columns from data-model.md. Add a holder check matching `documents` (exactly one of `unit_id`/`driver_id`, with `driver_id` set exactly when the type is `driver_license`), `summary text not null` with `length(btrim(summary)) between 1 and 500`, and the index `(document_type, unit_id, driver_id, occurred_at desc)`. Attach the `set_audit_fields`, `reject_hard_delete`, and `audit_business_change` triggers, following the `driver_role_changes` pattern in `20261102000200_driver_role_history.sql`. Enable RLS with `document_events_owner_select` and `document_events_owner_insert` (`public.is_owner()`) and no update or delete policy.
- [X] T008 Same migration, part 3. Add a private helper `public.document_shown_name(public.documents)` (SQL, immutable-safe, not granted) that returns `file_name`, or the derived "[Type] [holder] [created date].[ext]" label (research R9), for event summaries. Add `public.save_compliance_document(p_document jsonb) returns jsonb` (security invoker) per contracts/database.md: idempotency return, a stale check against `expected_current_id` when present, archived-unit refusal (`P0001` "This unit is archived. Choose another unit."), the advisory lock `pg_advisory_xact_lock(hashtextextended('document:' || type || ':' || holder_id, 0))`, insert as `current` or demote the current row to `superseded` (`superseded_at = now()`, `superseded_by_id`), for licenses, `perform set_config('rolnet.document_license_sync', 'on', true)` and then the order demote, update `drivers.license_expiry_date`, insert (R6). This applies to a **first** license upload too, which now sets the profile date. Then a `document_events` row (`uploaded` or `renewed`). Return `{version_id, renewed, previous_id}`. Then redefine `public.renew_compliance_document(uuid, jsonb)` to delegate to the same renewal path, keeping its signature, return type, and grant.
- [X] T009 Same migration, part 4. Add `public.revert_document_upload(p_current_id uuid) returns jsonb` (security invoker) per contracts/database.md. It takes the lock and checks staleness (`40001` "This document changed since you opened it. Reload and try again."). It refuses when the newest event is `restored` (`P0001` "This version was restored. Use Restore to choose another version."). It marks the current row `reverted` (`reverted_at = now()`, `reverted_by = auth.uid()`, `purge_after = now() + interval '30 days'`), then promotes the `superseded` row with the newest `superseded_at` (clearing `superseded_at`). For licenses it sets the `rolnet.document_license_sync` flag and updates the profile date before promoting, or skips the profile when no version remains (FR-044a). It logs `reverted` ("Reverted A. B restored.") or `removed` ("Reverted A. Document removed.") and returns `{result, version_id, restored_id}`.
- [X] T010 Same migration, part 5. Add `public.restore_document_version(p_version_id uuid, p_current_id uuid) returns jsonb` and `public.bring_back_document_version(p_version_id uuid, p_current_id uuid) returns jsonb` (both security invoker) per contracts/database.md: the lock, the stale check (`p_current_id` null means "no current row"), the target checks (`P0002` "That version is no longer in the history. Reload and try again."; `P0001` "This file was deleted after 30 days and can't be brought back." when `file_deleted_at is not null or purge_after <= now()`), archived-unit and deleted-driver refusal for bring back, and, for licenses, the `rolnet.document_license_sync` flag; then demote (current → `superseded`, `superseded_at = now()`, when there is one), then the profile date, then promote. A bring back that recreates a removed license also sets the profile date. Bring back clears `reverted_at`, `reverted_by`, and `purge_after`, and promoting clears `superseded_at`. Log `restored` ("Restored A. B moved to history.") or `brought_back` ("Brought back A. B moved to history." / "Brought back A.").
- [X] T011 Same migration, part 6. Add `public.mark_document_files_deleted(p_ids uuid[]) returns integer` (security invoker, `set search_path = public`; `service_role` bypasses RLS, so no definer rights are needed) that sets `file_deleted_at = now()` only where `id = any(p_ids) and lifecycle_status = 'reverted' and purge_after <= now() and file_deleted_at is null`, and returns the row count. Revoke from `public, anon, authenticated` and grant to `service_role` only.
- [X] T012 Same migration, part 7. Redefine `public.lock_inactive_driver_details()` with the same body as 20261030000100, except that the license-date change is also allowed when `current_setting('rolnet.document_license_sync', true) = 'on'`, keeping today's superseded-in-this-transaction exception (research R6). Redefine `public.expiring_documents(as_of date default (now() at time zone 'Asia/Manila')::date)`, keeping the `is_owner()` filter, so it returns only `expired` and `due_7` buckets with `expires_on <= as_of + 7` (research R11). Add the `revoke`/`grant execute … to authenticated` lines for the four user functions.
- [X] T013 Hand-edit `types/database.ts`. Add `"reverted"` to `document_lifecycle`; the six new `documents` columns to Row, Insert, and Update; the `document_events` table and the `document_event_kind` enum; and the Args and Returns types for `save_compliance_document`, `revert_document_upload`, `restore_document_version`, `bring_back_document_version`, and `mark_document_files_deleted` (memory: don't regenerate).
- [X] T014 [P] Write `supabase/tests/constraints/370_document_versions.sql` (pgTAP): the column and constraint shape, the `superseded_at` backfill, `save_compliance_document` first upload and renewal (the old row is `superseded` with `superseded_at` and `superseded_by_id` set), idempotency, the archived-unit refusal, a stale `expected_current_id`, the events written with summaries, an audit row for each event, and `renew_compliance_document` still working.
- [X] T015 [P] Write `supabase/tests/constraints/380_document_revert_restore.sql` (pgTAP): revert with history and as removal; reverting twice steps back twice; revert refused after a restore; a stale `p_current_id` (`40001`); restore swap and History order (`superseded_at`); bring back swap, recreate, and refusal once the file is deleted or `purge_after` has passed; the license profile date after every action (first upload with a new expiry, renewal, revert, restore, bring back swap, bring back recreate), for an active **and an inactive** driver, plus keeping its date when the only license is removed, and a direct profile date edit on an inactive driver still refused (the flag is not set); `mark_document_files_deleted` touching only past-due reverted rows; and no row ever deleted (counts before and after).
- [X] T016 [P] Write `supabase/tests/rls/240_document_versions_rls.sql` (pgTAP): the owner can call the four functions and read and insert events; staff, an unapproved user, and anon can't; `authenticated` can't execute `mark_document_files_deleted`; events can't be updated or deleted.
- [X] T017 [P] Update `supabase/tests/constraints/050_documents.sql` and `supabase/tests/rls/050_documents_storage_rls.sql` for the 7-day buckets (no `due_30`, nothing past `as_of + 7`), and add the five new functions to the grant inventory in `supabase/tests/rls/120_function_execute_rls.sql`.
- [X] T018 With the user's approval, push the two migrations to rolnet-dev and run the **full** pgTAP suite through the rollback wrapper. Fix the migration (before it is merged) until every file passes.

### Shared app layer

- [X] T019 [P] Create `lib/documents/status.ts` with `documentStatus(expiresOn, today): "expired" | "due" | "valid"` (expired if `expiresOn < today`, due if `<= addDays(today, 7)`, else valid), `statusLabels` ("Expired", "Due within 7 days", "Valid"), and `statusIcons` (lucide `CircleX`, `TriangleAlert`, `CircleCheck`), using `lib/dates/fleet-date.ts`.
- [X] T020 [P] Write `tests/unit/document-status.test.ts`: yesterday is expired, today and today+7 are due, today+8 is valid, and the labels.
- [X] T021 Rewrite `components/documents/expiry-status.tsx` to use `documentStatus` with the 3 tiers, and pass the icon through `StatusBadge`'s `icon` prop (tones danger, warning, success). Check every caller (`components/documents/document-list.tsx`, `app/(owner)/units/[id]/page.tsx`, `app/(owner)/drivers/[id]/page.tsx`) still renders (FR-011a).
- [X] T022 [P] Update the dashboard for 7 days: the tile detail in `components/dashboard/fleet-stats.tsx` becomes "Expired or within 7 days", the empty text in `components/dashboard/attention-panels.tsx` becomes "No documents expire in the next 7 days.", both links go to `/documents?ustatus=expired,due&dstatus=expired,due`, the demo branch in `lib/dashboard/queries.ts` uses 7 days and no `due_30`, and the related dashboard Vitest files are updated (FR-011a).
- [X] T023 [P] In `lib/pagination/list-control-specs.ts`, drop the Holder filter and the 30-day expiry bucket from the `documents` spec, keeping anything the API (`lib/domain/resource-config.ts`) still relies on.
- [X] T024 [P] Extend `lib/validation/documents.ts`. `documentSchema` gains `fileName` (trimmed, 1–200 characters) and an optional `expectedCurrentId` (uuid). Add `revertDocumentSchema { currentId: uuid }`, `restoreVersionSchema { versionId, currentId }`, `bringBackSchema { versionId: uuid, currentId: uuid | null }`, `documentIdSchema`, and the scope type lists `unitDocumentTypes = ["or_cr", "mtop_franchise", "insurance"]` and `driverDocumentTypes = ["driver_license"]`.
- [X] T025 [P] Map the new database errors in `lib/actions/errors.ts`: raised `40001` and `23505` on documents map to `STALE_RECORD`; `P0001` and `P0002` keep their message (`RULE` / `NOT_FOUND`) so the exact sentence from contracts/database.md reaches the user.
- [X] T026 [P] Create `lib/documents/file-label.ts` with `shownFileName({ fileName, documentType, holderName, createdAt, mimeType })`, which returns the stored name or "[Type label] [holder] [YYYY-MM-DD].[ext]" (research R9), and `tests/unit/document-file-label.test.ts`.
- [X] T027 Create `lib/documents/page-query.ts` with `loadDocumentsPage()`, which returns the page data from contracts/actions.md (`unitDocs`, `units`, `licenses`, `drivers`, `recentlyReverted`, `today`) in 5 parallel reads: current documents with unit name, non-archived units `{ id, name, body_number }`, current `driver_license` rows for non-deleted drivers, non-deleted drivers, and reverted rows from the last 30 days that are still kept, with holder names and the reverter's `profiles.display_name` (joined on `profiles.user_id = reverted_by`, falling back to "Unknown user"). It excludes archived units and deleted drivers, applies `shownFileName` and `documentStatus`, and has a demo branch.
- [X] T028 Extend the demo data in `lib/demo/mode.ts`: add `file_name`, `superseded_at`, `reverted_at`, `reverted_by`, `purge_after`, and `file_deleted_at` to `demoDocuments`. Add 2 superseded versions on one OR/CR, one reverted renewal still kept, one removed first upload (insurance, kept), one revert older than 30 days with `file_deleted_at`, `demoDocumentEvents` for each, one unit with no documents, and a license for an inactive driver (research R16). Keep existing demo IDs stable.
- [X] T029 Create `lib/documents/url-state.ts`: `parseDocumentsParams(searchParams)` and `serializeDocumentsParams(state)` for `sort`, `usearch`, `utype`, `ustatus`, `dsearch`, `dstatus`, and `doc` (comma lists, unknown values dropped, legacy `expiry=due` mapped to `ustatus=expired,due&dstatus=expired,due`), and `tests/unit/document-url-state.test.ts` (round trip and the legacy mapping) (FR-009a, contracts/ui.md).
- [X] T030 Rebuild `app/(owner)/documents/page.tsx`: `requirePermission("manage_documents")`, `loadDocumentsPage()`, then `<PageHeader eyebrow="Records and compliance" title="Documents" />` and `<Suspense>` around a client `components/documents/documents-workspace.tsx`. For now the workspace renders the two empty pane cards in the `lg:grid-cols-20` layout (Unit `lg:col-span-11`, Driver `lg:col-span-9`, stacked below `lg` with Unit first) and owns the URL state through `url-state.ts` and `router.replace(…, { scroll: false })`. Remove the old `DocumentForm` aside and `PagedList` (FR-001, FR-002).
- [X] T031 Create `components/documents/pane.tsx`: a bordered card with a title and count line, a right-aligned Filters button with count badge, and a primary Upload button with a lucide `Plus` icon and an `aria-label` prop. It has slots for the filter panel, chips with "Clear all", the search field, a summary line with optional trailing actions, and the body (FR-003, FR-004). Use it for both panes in the workspace.

**Checkpoint**: the migrations pass pgTAP on rolnet-dev, the status rule is 3-tier everywhere, and
`/documents` renders two empty panes from real data.

---

## Phase 3: User Story 1 - Browse unit documents as a folder tree (Priority: P1) 🎯 MVP

**Goal**: One collapsed folder per active unit with pills, counts, an indented document row layout,
empty folders, Expand all and Collapse all, and full keyboard support.

**Independent Test**: The spec's US1 test: units with mixed statuses, one with no documents, and one
archived. Check folder order, pills, counts, the empty message, the hidden archived unit, and the
keyboard, without search, filters, or upload.

- [X] T032 [P] [US1] Create `lib/documents/tree.ts` with `buildUnitFolders({ units, docs, today })`, which returns folders `{ unitId, unitName, docs, expiredCount, dueCount, count }` for every non-archived unit, including those with no documents, and the pane count text "{n} document(s) · {m} unit(s)" with correct plurals (FR-012, FR-013, contracts/ui.md).
- [X] T033 [P] [US1] Create `hooks/use-tree-keyboard.ts`. Given the flat list of visible rows (`{ id, kind: "folder" | "doc", parentId, expanded }`), it manages the roving `tabIndex` and handles ArrowDown/ArrowUp, ArrowRight (expand, or move to the first child), ArrowLeft (collapse, or move to the parent), Home/End, and Enter/Space (toggle or activate) as in contracts/ui.md (FR-017).
- [X] T034 [US1] Create `components/documents/unit-tree.tsx`: `role="tree"` with an `aria-label`. Folder rows are `role="treeitem"` with `aria-level=1`, `aria-expanded`, `aria-setsize`, and `aria-posinset`, a chevron (`ChevronRight`/`ChevronDown`), a folder icon (`Folder`/`FolderOpen`), the bold unit name, a red "N expired" pill and an amber "N due" pill when above 0, and the count at the right, and the whole row toggles. Children sit in `role="group"` with a left border indent guide (token border). Document rows show a `FileText`/`FileImage` icon by MIME type, the type label, the `ExpiryStatus` badge, and line 2 "{number or 'No number'} · Expires {YYYY-MM-DD}". An expanded empty folder shows "Empty. Add or upload a document." with "upload a document" as a link-styled button that calls `onUpload(unitId)`. The focused row shows a visible focus ring. Use `use-tree-keyboard` (FR-012–FR-017).
- [X] T035 [US1] Wire the unit pane in `components/documents/documents-workspace.tsx`: the expand state (`Set<unitId>`, all collapsed at first), the Expand all and Collapse all icon buttons (`ChevronsDownUp`/`ChevronsUpDown` with a `Tooltip` and `aria-label` "Expand all folders" / "Collapse all folders") on the summary line, and the tree with `onOpenDocument(id)` setting `doc` in the URL.
- [X] T036 [P] [US1] Write `tests/unit/document-tree.test.ts` (folders part): empty units are included, archived units are excluded, the pill counts, and the count text plurals.
- [X] T037 [US1] Write `tests/e2e/documents-page.spec.ts` (tree part, demo, 1440 px and 360 px): collapsed by default, the pills and counts, row click toggles, the empty folder message, Expand all and Collapse all, the keyboard path (Tab, Down, Right, Left, Enter) with focus visible and one tab stop, the archived unit absent, and no horizontal scroll at 360 px.

**Checkpoint**: the unit tree is fully browsable.

---

## Phase 4: User Story 2 - Open a document's details and renew it (Priority: P1)

**Goal**: A details modal with fields, View file, History, Reverted uploads, Activity, and a footer.
Renew opens the upload modal (wired in US3).

**Independent Test**: Open a document with two earlier renewals. Check every field, the History
order, Activity, View file, and that Renew opens a prefilled upload modal.

- [X] T038 [US2] Add `getDocumentDetails({ id })` to `app/actions/documents.ts`. It resolves the document (type and holder) from any version id, then reads in parallel: the current row, History (`superseded`, ordered `superseded_at desc, created_at desc`), reverted rows (with `fileKept = file_deleted_at is null and purge_after > now()` and `keptUntil = purge_after`), and the 5 newest `document_events` with the actor's `profiles.display_name` (by `created_by`, falling back to "Unknown user"). For versions with no `uploaded`/`renewed` event, it synthesizes "Uploaded" entries from `created_at`/`created_by`. It computes `canRevert` (a current row exists and the newest event isn't `restored`) and `hasPrevious`, and returns the `DocumentDetails` shape from contracts/actions.md, with a demo branch.
- [X] T039 [US2] Change `getDocumentUrl` in `app/actions/documents.ts` to accept any version of the document (current, superseded, or a kept reverted row). Refuse rows whose file is deleted or past `purge_after` with "This file was deleted after 30 days.", and remove `softDeleteDocument` and its import sites (research R15, FR-027a).
- [X] T040 [US2] Create `components/documents/document-details-dialog.tsx` (Base UI `Dialog`, full-width at 360 px with a scrolling body). The title is "[Type] · [holder]", with the `ExpiryStatus` below it. It has rows for Holder, Document number, Issued on, Expiry date, File name, and a "View file" button using `SignedFileButton` with `getDocumentUrl`. History rows show the file name, "expired {date}", "View {file name}", and "Restore" (`aria-label` "Restore {file name}"), or "No previous versions.". The Reverted uploads section appears only when there are entries, each showing "Reverted {date} by {name}" and either "File kept until {date}" plus "View {file name}" and "Bring back", or "File deleted" with no buttons. Activity shows date, actor, and summary, or "No activity yet.". The footer has a red "Revert upload" text button on the left only when `canRevert`, and Close plus a primary Renew on the right. It takes callbacks `onRenew`, `onRevert`, `onRestore(versionId)`, and `onBringBack(versionId)` (FR-025–FR-029).
- [X] T041 [US2] Open the details dialog from the workspace when `doc` is in the URL (load through `getDocumentDetails`, show a loading state, and drop `doc` from the URL on close). Opening a document from the tree or the list sets `doc`.
- [X] T042 [US2] Turn `app/(owner)/documents/[id]/page.tsx` into a redirect: look up the version's type and holder, find the current version, and `redirect("/documents?doc=<current id>")`, or to `/documents` when there's no current row. Delete `app/(owner)/documents/[id]/loading.tsx` if it no longer applies. Dashboard and unit/driver links keep working (spec edge case).
- [X] T043 [US2] Write `tests/e2e/documents-modals.spec.ts` (details part, demo): the fields, History order with Restore buttons, "No previous versions.", the Reverted uploads entries (kept and "File deleted"), Activity, Escape closes, and an old `/documents/<superseded id>` link opens the current document's modal.

**Checkpoint**: every document opens in the modal and old links still land correctly.

---

## Phase 5: User Story 3 - Upload or renew from a modal (Priority: P1)

**Goal**: Per-pane Upload opens one scoped modal with a renewal banner, inline file checks, and a
toast with Undo.

**Independent Test**: A first upload for a unit, then a renewal, then a driver's license. Check the
scoping, the banner, the inline validation, the folder expanding, and the toasts.

- [X] T044 [US3] Change `finalizeDocumentUpload` in `app/actions/documents.ts` to call `save_compliance_document` with `file_name` and `expected_current_id`, returning `{ id, renewed, previousId }`. Keep `prepareDocumentUpload` and the idempotency key, and revalidate `/documents`, `/dashboard`, and the holder page (contracts/actions.md).
- [X] T045 [US3] Rework `components/forms/document-form.tsx` for the modal. Props are `scope: "unit" | "driver"`, `units`, `drivers`, `preset?: { documentType, unitId?, driverId? }`, `currentByKey` (which (type, holder) pairs have a current document), and `onSaved(result)`. Fields in order: Document type* (unit types only, or fixed to Driver's license), Unit* or Driver* (disabled until a type is chosen), Document number, Issued on, Expiry date*, File*. The file is checked on selection with the T003 messages inline, and shows the chosen file name with a "Remove" button. The helper text is "Uploading a type the holder already has renews it. The previous file stays in the history.", and when a current pair exists, an info banner "[Holder] already has a [type]. This upload renews it." appears and the submit label becomes "Renew document". Required fields show inline errors on save. Send `fileName: file.name` and keep removing the uploaded object when the save fails (FR-030–FR-034).
- [X] T046 [US3] Create `components/documents/upload-document-dialog.tsx` wrapping the form in a `Dialog` titled "Upload document" (focus trap and Escape come from Base UI). On success: close, expand the unit's folder (unit scope), refresh with `router.refresh()`, and toast "Document uploaded for {holder}." or "Renewed {type} for {holder}. Previous file kept in history." with `{ action: { label: "Undo", onClick }, timeout: 7000 }`. The Undo handler comes from US5 (until then, pass none) (FR-035).
- [X] T047 [US3] Wire it into the workspace: the unit pane's Upload (`aria-label` "Upload unit document"), the driver pane's Upload ("Upload driver license"), the empty-folder link (preset unit), and Renew in the details dialog (preset type and holder, closing details first).
- [X] T048 [US3] Add the upload modal tests to `tests/e2e/documents-modals.spec.ts` (demo): unit scope offers 3 types and the Unit field is disabled until a type is chosen; driver scope fixes Driver's license; the renewal banner and "Renew document" for an existing pair; the .docx and over-5 MB errors; the Remove chip; required-field errors; and Escape closes.

**Checkpoint**: P1 complete. The tree, details, and upload and renew work end to end on rolnet-dev.

---

## Phase 6: User Story 4 - Search, filter, and sort each pane (Priority: P2)

**Goal**: Per-pane live search and multi-select filters with chips, one shared Sort that also orders
the folders, and all of it kept in the URL.

**Independent Test**: The spec's US4 scenarios on known data. Check results, summaries, chips, that
the panes stay independent, the sort order, and reload persistence.

- [X] T049 [P] [US4] Create `lib/documents/search.ts`: `matchDocument(doc, query)` over unit or driver name, type label, number, the `expires_on` text, status text ("expired", "due within 7 days", "valid"), and the shown file name, case-insensitive. Also `highlightRanges(text, query)`, which returns match ranges (FR-018, FR-022).
- [X] T050 [US4] Extend `lib/documents/tree.ts` with `filterAndSortFolders({ folders, query, types, statuses, sort, today })`. Filters are OR within a filter and AND across filters. A folder whose unit name matches keeps all its filtered docs; otherwise it keeps only the matching docs. Folders with nothing to show are hidden. An empty folder is shown during a search only if its name matches and no filter is active, and is hidden whenever any filter is active. Folders are sorted by their earliest (or latest) visible expiry for the expiry sorts, with no-doc folders last, and A to Z by unit name for name and type sorts. Docs inside are sorted by the same key, with holder then type for "name" and type then expiry for "type". It returns the summary "{n} result(s) in {m} folder(s)" or "No documents match." Add `sortLicenses` and `filterLicenses` for the driver list (FR-005–FR-009, FR-016, FR-019, FR-020).
- [X] T051 [P] [US4] Add search, filter, and sort cases to `tests/unit/document-tree.test.ts` and create `tests/unit/document-search.test.ts`, covering every acceptance scenario of US4 plus the empty-folder rules. Add a performance case (SC-005): generate 100 units and 400 documents, run `filterAndSortFolders` 50 times with different queries, and assert the median run is under 16 ms.
- [X] T052 [P] [US4] Create `components/documents/highlight.tsx` (`<mark>` with token classes, rendering `highlightRanges`) and use it in the unit name, type, number, and date in `unit-tree.tsx`.
- [X] T053 [P] [US4] Create `components/documents/filter-panel.tsx` with `Checkbox` groups per filter (unit pane: Document type and Status; driver pane: Status), and the chips row in `pane.tsx`: one removable chip per value ("Status: Expired", "Type: OR/CR") plus "Clear all", with the Filters badge equal to the number of chosen values (FR-005, FR-006).
- [X] T054 [US4] Create `components/documents/documents-header-actions.tsx` with the Sort `select` labelled "Sort (both panes)" and the options "Expiry, soonest first" (default), "Expiry, latest first", "Name, A to Z", "Document type". Place it in the page header area (the "Recently reverted" slot is filled in US6) (FR-001, FR-008).
- [X] T055 [US4] Wire the search and filter state in the workspace through `url-state.ts`: search inputs with the placeholders "Search unit documents" / "Search driver licenses", debounced URL writes (300 ms), and filter and sort writes applied immediately. During a unit search, folders with results are forced open and the manual set is ignored. When the search clears, restore the expand set saved when the search began (FR-020, FR-021, FR-009a).
- [X] T056 [US4] Add the search, filter, and sort tests to `tests/e2e/documents-page.spec.ts` (demo): live search with auto-expand and highlight, the summary text, "No documents match.", the restored expand state, multi-select Status with 2 chips and badge 2, the driver pane unaffected, each sort option, reload keeping search, filters, and sort, and the dashboard tile link opening with Expired and Due within 7 days chosen in both panes.

**Checkpoint**: both panes are searchable and filterable, and the URL holds the state.

---

## Phase 7: User Story 5 - Revert a mistaken upload (Priority: P2)

**Goal**: Undo on the toast, plus Revert upload from the modal, for both variants.

**Independent Test**: Renew and Undo; renew again and revert from the modal; revert a first upload.
Check the current version, the removed document, the toasts, and the audit entries.

- [X] T057 [US5] Add `revertDocumentUpload({ currentId })` to `app/actions/documents.ts`. It calls `revert_document_upload`, revalidates, and returns `{ result, restoredId }`.
- [X] T058 [US5] Create `components/documents/confirm-version-dialog.tsx` (Base UI `AlertDialog`) with variants `revert-previous` ("Revert to the previous version?", text from FR-037, rows "Current file" / "Will be restored" with name and expiry, confirm "Revert upload" in the danger style), `revert-remove` ("Remove this upload?", text from FR-038, confirm "Remove upload"), plus the `restore`, `bring-back-swap`, and `bring-back-recreate` variants (filled in by US6 and US7). Cancel returns to the opener. The confirm button shows a pending state and errors inline.
- [X] T059 [US5] Wire Revert in the workspace: the details "Revert upload" opens the right variant from `hasPrevious`. On confirm, call the action, close both dialogs, `router.refresh()`, and toast "Upload reverted. {Holder}'s {type} is back to the previous version." or "Upload removed for {holder}.". Wire the toast Undo from T046 to call `revertDocumentUpload({ currentId: savedId })` with no confirmation and toast "Upload reverted. You can bring it back from Recently reverted.", or on `STALE_RECORD`, "Nothing changed. This document was updated since." (FR-036–FR-039).
- [X] T060 [US5] Add the revert tests to `tests/e2e/documents-modals.spec.ts` (demo): both confirmation texts and rows, Cancel returning to details, and "Revert upload" hidden on the demo document whose newest event is `restored`.

**Checkpoint**: mistaken uploads can be undone or reverted.

---

## Phase 8: User Story 6 - Bring back a reverted file (Priority: P2)

**Goal**: The Recently reverted list and Bring back, from it and from the modal.

**Independent Test**: Revert a renewal and a first upload, open Recently reverted, and bring both
back. Check the lists, the toasts, and the audit entries.

- [X] T061 [US6] Add `bringBackDocumentVersion({ versionId, currentId })` to `app/actions/documents.ts`. It calls `bring_back_document_version`, revalidates, and returns `{ result, id, movedId }`.
- [X] T062 [US6] Create `components/documents/recently-reverted-dialog.tsx`, listing `recentlyReverted` newest first: the file name, "{Holder} · {type}" plus " · document removed" when removed, "Reverted {date} by {name} · kept until {date}", and "Bring back". The empty state is "Nothing reverted in the last 30 days.", with the footnote "Older reverts no longer have a file. Each document's Activity keeps the record." (FR-040).
- [X] T063 [US6] Add the "Recently reverted" button with a count badge equal to `recentlyReverted.length` to `documents-header-actions.tsx`, before Sort.
- [X] T064 [US6] Fill in the `bring-back-swap` ("Bring back this file?", rows "Will become current" / "Moves to history") and `bring-back-recreate` ("Bring back this document?", row "File") variants in `confirm-version-dialog.tsx`. Wire Bring back from Recently reverted and from the details dialog's Reverted uploads, choosing the variant by whether the document has a current row now. On confirm: call the action, refresh, expand the unit folder when recreated, and toast "Brought back {file} for {holder}'s {type}." (FR-041, FR-042).
- [X] T065 [US6] Add the bring back tests to `tests/e2e/documents-modals.spec.ts` (demo): the Recently reverted entries and badge count, the removed-document label, both confirmation variants and Cancel, and "File deleted" entries with no Bring back.

**Checkpoint**: every revert in the last 30 days can be brought back.

---

## Phase 9: User Story 7 - Restore any earlier version (Priority: P3)

**Goal**: Restore from History with a confirmation.

**Independent Test**: With three versions, restore the oldest. Check the swap, the status, the toast,
Activity, and that Revert upload is hidden.

- [X] T066 [US7] Add `restoreDocumentVersion({ versionId, currentId })` to `app/actions/documents.ts`. It calls `restore_document_version`, revalidates, and returns `{ id, movedId }`.
- [X] T067 [US7] Fill in the `restore` variant in `confirm-version-dialog.tsx` ("Restore this version?", text from FR-043, rows "Will become current" / "Moves to history", buttons "Cancel" and "Restore version"). Wire the History "Restore" buttons. On confirm: call the action, refresh the lists, reload the details (now with Revert upload hidden), and toast "Restored {file} as the current version of {holder}'s {type}.".
- [X] T068 [US7] Add the restore tests to `tests/e2e/documents-modals.spec.ts` (demo): the confirmation text and rows, and Cancel returning to details.

**Checkpoint**: any earlier version can be made current.

---

## Phase 10: User Story 8 - Browse driver licenses (Priority: P3)

**Goal**: The flat driver license list with the shared sort, its own search and Status filter, and
the same modal.

**Independent Test**: Licenses for active and inactive drivers. Check the rows, sorting, search,
filter, and empty states.

- [X] T069 [US8] Create `components/documents/driver-license-list.tsx`: rows with the bold driver name and the `ExpiryStatus` at the right, the license number, and "Expires {YYYY-MM-DD}", with highlighting. Each row is a button that opens the details modal. The empty states are "No driver licenses yet." and "No licenses match.", and the summary is "{n} result(s)". Inactive drivers get no special treatment (FR-023, FR-024).
- [X] T070 [US8] Wire the driver pane in the workspace: the title count "{n} license(s) · {m} driver(s)", the Status filter, the search, `sortLicenses`, and `filterLicenses`.
- [X] T071 [US8] Add the driver pane tests to `tests/e2e/documents-page.spec.ts` (demo): an inactive driver's license is listed, sorting, search, the Status filter, and both empty states.

**Checkpoint**: all eight stories work.

---

## Phase 11: Retention job (FR-047, SC-007; serves US5 and US6)

- [X] T072 [P] Create `lib/supabase/service.ts`: `import "server-only"`, then `createSupabaseServiceClient()` using `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, with no session persistence, throwing a clear error when the key is missing.
- [X] T073 Create `app/api/cron/purge-document-files/route.ts` (`POST`): return `503` when `CRON_SECRET` is unset and `401` unless `Authorization: Bearer ${CRON_SECRET}`. Select up to 100 rows with `lifecycle_status = 'reverted' and purge_after <= now() and file_deleted_at is null`. Remove their `object_path`s from the `documents` bucket (a missing object counts as removed), call `mark_document_files_deleted` with the ids removed, and return `{ purged, failed }`. Disable caching per the Next 16 route-handler docs.
- [X] T074 [P] Write `tests/unit/purge-document-files.test.ts` with a mocked service client: the 401/503 cases, batching, partial Storage failure leaving failed ids unmarked, and the missing object treated as removed.
- [X] T075 [P] Create `.github/workflows/purge-document-files.yml`: `on: schedule: - cron: "0 18 * * *"` (02:00 Asia/Manila) and `workflow_dispatch`, one job that runs `curl --fail -X POST -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" "${{ secrets.PURGE_URL }}"`, with minimal `permissions: {}`. Because the repository is public, GitHub turns off scheduled workflows after 60 days without commits. So also add a backstop: `lib/documents/page-query.ts` reads the oldest due row (`purge_after <= now() - interval '2 days' and file_deleted_at is null`). When one exists, the Documents page shows an owner-only warning notice, "File cleanup is overdue. Re-enable the daily purge workflow in GitHub Actions." Document the re-enable step in T076 (research R10).

---

## Phase 12: Polish & Cross-Cutting Concerns

- [X] T076 [P] Update `docs/DEVELOPMENT.md` with the version model (current, History, reverted, removed), the revert and restore and bring back rules, the 7-day status rule, the retention job (route, workflow, `CRON_SECRET`, `PURGE_URL`, service-role key server-only), and the URL params.
- [X] T077 [P] Remove dead code: `components/documents/document-list.tsx` callers that only served the old page, the old `Groups`/`groupBy` helpers, and unused imports. Keep `DocumentList` if the unit and driver pages still use it.
- [X] T078 Check 360 px for every screen and modal in the Playwright specs (no horizontal scroll, the header actions wrap, the pane header buttons fit) and fix the layout with token utilities only (constitution IV).
- [X] T079 Run `corepack pnpm lint`, `corepack pnpm typecheck`, `corepack pnpm test`, `corepack pnpm test:e2e`, `corepack pnpm check`, and `corepack pnpm build:vinext`, and fix any failures.
- [ ] T080 With the user's approval, run the full pgTAP suite on rolnet-dev again, then the [quickstart.md](quickstart.md) manual walkthrough (steps 1–13) and the retention job check, on rolnet-dev at 1440 px and 360 px. Record the results in `specs/013-documents-page-redesign/validation.md`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies.
- **Foundational (Phase 2)**: T005 → T006–T012 (one migration file, in order) → T013 → T014–T017 [P] → T018 (approval). The app-layer tasks T019–T029 can start alongside the SQL. T030 needs T027 and T029; T031 needs T030.
- **US1–US3 (P1)**: after Phase 2. US2's Renew needs US3's dialog (T047) for the full flow, but the modal can be built and tested first.
- **US4**: after US1 (it extends `tree.ts` and `unit-tree.tsx`).
- **US5**: after US2 and US3 (the details footer and the upload toast).
- **US6**: after US5 (it needs reverted rows and `confirm-version-dialog.tsx`).
- **US7**: after US2 and US5 (`confirm-version-dialog.tsx`).
- **US8**: after Phase 2; it uses `sortLicenses` and `filterLicenses` from T050 (US4) for sorting and filtering.
- **Retention (Phase 11)**: after T018. It is independent of the UI stories.
- **Polish (Phase 12)**: after everything.

### Within Each User Story

Pure lib and tests first, then actions, then components, then wiring, then e2e.

### Parallel Opportunities

- Phase 1: T001–T004 all [P].
- Phase 2: T014–T017 in parallel after T013; T019/T020, T022–T026 in parallel with the SQL work.
- US1: T032 and T033 in parallel, then T034.
- US4: T049, T052, T053 in parallel; T051 after T050.
- Phase 11: T072, T074, and T075 in parallel; T073 after T072.

## Parallel Example: User Story 4

```text
Task: "T049 [P] [US4] Create lib/documents/search.ts …"
Task: "T052 [P] [US4] Create components/documents/highlight.tsx …"
Task: "T053 [P] [US4] Create components/documents/filter-panel.tsx …"
```

## Implementation Strategy

### MVP First (User Stories 1–3)

1. Phases 1 and 2 (the database and shell, with pgTAP green on rolnet-dev).
2. US1 tree, then US2 details, then US3 upload. That replaces the old page with no loss of function.
3. Stop and validate quickstart steps 1–3, 7 (upload part), and 8.

### Incremental Delivery

4. US4 search, filter, and sort.
5. US5 revert, then US6 bring back, then the retention job (Phase 11).
6. US7 restore, then US8 driver list polish.
7. Phase 12, then the full validation.

## Notes

- One branch and one PR (`013-documents-page-redesign`). The migrations are pushed to rolnet-dev only with approval.
- `renew_compliance_document` stays for compatibility. The API's plain inserts keep working, and their Activity entries are synthesized.
- Commit after each phase checkpoint.
