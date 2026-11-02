# Implementation Plan: Documents Page Redesign

**Branch**: `013-documents-page-redesign` | **Date**: 2026-11-02 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/013-documents-page-redesign/spec.md`

## Summary

The Documents page becomes two panes. **Unit documents** is a file-explorer tree with one folder per
active unit. **Driver licenses** is a flat list. Each pane has its own multi-select filters, chips,
live search, and Upload button, and one Sort orders both. The upload form card is gone: upload,
renew, and every recovery action happen in modals. Search, filters, and sort live in the URL. The
separate detail page becomes a redirect into the details modal.

Documents keep today's **one row per version** model (R1). A new `reverted` lifecycle value, with
`reverted_at`, `reverted_by`, `purge_after`, and `file_deleted_at`, marks mistaken uploads. They are
never deleted. A document whose only version was reverted has no current row and counts as removed
(R3). `superseded_at` orders History so a restored or brought-back swap puts the former current
version on top (R4).

The database owns every action. Four security definer functions (each checks `require_owner()` first) each run in one transaction: save
(upload or renew), revert (also Undo), restore, and bring back. Each takes an advisory lock, checks
the current version the user saw (stale or Undo safety), keeps the driver profile's license expiry in
step (FR-044a), and writes a `document_events` row that Activity reads and the audit log records
(R5–R8).

Reverted files are kept 30 days. A daily GitHub Actions schedule calls an app route that deletes due
objects through the Storage API with the server-only service-role key and stamps `file_deleted_at`.
The app treats past-due files as deleted right away (R10). The 3-tier status rule (Expired, Due within
7 days, Valid) replaces the 30-day tier everywhere, including `expiring_documents` and the dashboard
(R11).

## Technical Context

**Language/Version**: TypeScript 5 (strict), SQL (Supabase Postgres 15), Next.js 16 App Router with `cacheComponents` and server actions

**Primary Dependencies**: Existing only (Supabase JS, Zod, `@base-ui/react`, lucide). **No new packages.** It reuses `dialog`, `alert-dialog`, `checkbox`, `popover`, `tooltip`, `button`, `input`, and the in-repo `toast` with its Undo action (feature 012).

**Storage**: Two ordered migrations:
1. `20261102000300_document_lifecycle_reverted.sql`: the enum value only (it can't be used in the same transaction).
2. `20261102000400_document_versions.sql`: columns, constraints, indexes, and the backfill on `documents`; the `document_events` table and enum with triggers and RLS; `save_compliance_document`, `revert_document_upload`, `restore_document_version`, `bring_back_document_version`, and `mark_document_files_deleted`; and the redefined `renew_compliance_document`, `lock_inactive_driver_details`, and `expiring_documents`, plus grants.

The Storage bucket `documents` is unchanged.

**Testing**:
- **pgTAP**: new `constraints/370_document_versions.sql`, `constraints/380_document_revert_restore.sql`, and `rls/240_document_versions_rls.sql`; updated `constraints/050_documents.sql`, `rls/050_documents_storage_rls.sql`, and `rls/120_function_execute_rls.sql`. They run against rolnet-dev through the rollback wrapper **after approval**, as the full suite.
- **Vitest**: `lib/documents/status`, `tree`, `search`, `url-state`, and `file-label`, the purge route handler (auth, batching, partial failure, with a mocked client), and the updated dashboard ordering and copy.
- **Playwright** (demo build on :3100, 1440 × 900 and 360 px): layout, tree and keyboard, search and filters and URL persistence, sort, details modal, confirmation text and Cancel paths, upload modal validation, and the old-link redirect.

**Target Platform**: Mobile-first web on Cloudflare Workers through vinext (`check` and `build:vinext` stay green). The scheduled caller is GitHub Actions (free).

**Project Type**: Single Next.js monolith

**Performance Goals**: The page renders in under 1 s from 5 parallel reads for about 100 units and 400 current documents. Search and filter run in memory and update on each keystroke with no visible lag (SC-005). The details modal loads in one action call (about 3 reads).

**Constraints**:
- Fleet time zone Asia/Manila for "today", the status tiers, and dates shown.
- Tokens only, no hex colours or arbitrary sizes, and every screen works at 360 px.
- Every multi-row change is **one database function**, so the constitution's sequential-write clause isn't used. Upload is still "Storage object first, then the record". If the record fails, the object is removed (existing pattern).
- The service-role key is used only in `lib/supabase/service.ts`, which only the purge route imports. It is never exposed through `NEXT_PUBLIC_*`.
- `types/database.ts` is hand-maintained. Add the enum value, columns, table, and functions by hand.
- Read `node_modules/next/dist/docs/` for `useSearchParams`/Suspense, `redirect`, and route handlers before coding (AGENTS.md).

**Scale/Scope**: 2 migrations, 3 new and 3 updated pgTAP files, about 6 lib modules, 1 action file reworked, 1 route, 1 workflow, about 12 components, 1 hook, 2 pages (list rebuilt, detail turned into a redirect), dashboard copy, demo data, and docs.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Result |
|-----------|-------|--------|
| I. Free-Tier Sustainability | No new package or paid service. The schedule is a free GitHub Actions cron calling the app's own route. Storage use goes **down** (reverted files purged after 30 days) | Pass |
| II. Monolithic Simplicity | No parent "document" table: it reuses the version rows (R1). Removal is derived, not a new state table (R3). The tree runs in memory for a small fleet (R12). The purge is a route in the same app, not a separate service (R10) | Pass |
| III. Data Integrity and Auditability | Each action is one transaction with an advisory lock and a stale check (R5). No row is ever deleted: reverted versions, events, and audit rows are permanent. Only Storage objects of reverted versions past 30 days are removed, and the record keeps `file_deleted_at`. `document_events` has audit columns, `reject_hard_delete`, and `audit_business_change`. The license profile date changes in the same transaction, through a transaction-local flag that the inactive-driver lock accepts (R6). No money is involved | Pass |
| IV. Mobile-First, Human-Centered | The panes stack at 360 px and the modals are full-width and scroll inside. Every refusal names the next step ("Use Restore…", "Reload and try again"). Undo is one tap | Pass |
| V. Compliance Document Lifecycle | Expiry stays queryable. Expired and due documents are surfaced with pills, badges, and filters, and the dashboard. The 7-day rule applies everywhere (R11). Every document still has type, holder, expiry, status, and timestamps | Pass |
| Workflow gates | Ordered migrations with pgTAP. New `public` functions start with no EXECUTE. The four user functions are granted to `authenticated` because the app calls them. They are **security definer** and start with `require_owner()` (changed from invoker during the rolnet-dev dry run, so the private helpers need no grant; research R5). `mark_document_files_deleted` is **security invoker**, granted to `service_role` only (which bypasses RLS), and limited to past-due reverted rows, so no definer function lacks a caller check. Lint, typecheck, Vitest, Playwright, `check`, `build:vinext`, and full pgTAP (rolnet-dev wrapper) | Pass (full pgTAP suite 56/56 on rolnet-dev, 2026-11-02) |

**Note on Storage purge**: Principle III protects *records*. The spec keeps every record and deletes
only the file bytes of uploads the owner marked as mistakes, after a 30-day recovery window. History
files (earlier renewals) are never purged (FR-048).

**Post-design re-check**: Pass. Phase 1 added one table, two enums (one value plus one new type), five
functions, and three redefinitions, with no packages and no services. Grants are listed in
[contracts/database.md](contracts/database.md).

## Project Structure

### Documentation (this feature)

```text
specs/013-documents-page-redesign/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── database.md        # migrations, functions, errors, RLS, grants, pgTAP files
│   ├── actions.md         # server actions, page data, purge route, redirect
│   └── ui.md              # URL params, components, layout, exact copy, keyboard
├── checklists/requirements.md
└── tasks.md               # next: /speckit-tasks
```

### Source Code (repository root)

```text
supabase/
├── migrations/20261102000300_document_lifecycle_reverted.sql
├── migrations/20261102000400_document_versions.sql
├── tests/constraints/370_document_versions.sql            # new
├── tests/constraints/380_document_revert_restore.sql      # new
├── tests/rls/240_document_versions_rls.sql                # new
├── tests/constraints/050_documents.sql                    # 7-day buckets
├── tests/rls/050_documents_storage_rls.sql                # 7-day buckets
└── tests/rls/120_function_execute_rls.sql                 # grant inventory
types/database.ts                                          # hand-edited
lib/
├── documents/status.ts, tree.ts, search.ts, url-state.ts, file-label.ts, page-query.ts   # new
├── validation/documents.ts            # fileName, expectedCurrentId, revert/restore/bring-back schemas, new messages
├── uploads/rules.ts                   # spec wording for file errors
├── supabase/service.ts                # new, server-only service-role client
├── pagination/list-control-specs.ts   # documents: drop Holder and the 30-day bucket
├── dashboard/ordering.ts, queries.ts  # 7-day window, new link
├── actions/errors.ts                  # 40001 → STALE_RECORD, P0001 rule messages
└── demo/mode.ts                       # versions, reverted (kept, deleted), removed, events, empty unit, inactive driver license
app/
├── (owner)/documents/page.tsx         # rebuilt: server reads → DocumentsWorkspace
├── (owner)/documents/[id]/page.tsx    # redirect to /documents?doc=
├── actions/documents.ts               # finalize via save_compliance_document; revert, restore, bring back, details; drop softDeleteDocument
└── api/cron/purge-document-files/route.ts   # new
components/
├── documents/                         # workspace, header actions, pane, filter panel, unit tree, license list,
│                                      # details, confirm, recently reverted, upload dialogs, highlight; expiry-status updated
├── forms/document-form.tsx            # scope, presets, file name, renewal banner, inline file errors
└── dashboard/fleet-stats.tsx, attention-panels.tsx   # "within 7 days" copy and link
hooks/use-tree-keyboard.ts             # new
.github/workflows/purge-document-files.yml   # new daily schedule
eslint.config.mjs                      # restrict imports of lib/supabase/service
tests/
├── unit/document-status.test.ts, document-tree.test.ts, document-search.test.ts,
│   document-url-state.test.ts, document-file-label.test.ts, purge-document-files.test.ts   # new
├── unit/dashboard-*.test.ts           # updated for 7 days
└── e2e/documents-page.spec.ts, documents-modals.spec.ts                                     # new (demo)
docs/DEVELOPMENT.md                    # version and revert rules, retention job, CRON_SECRET
.env.example                           # CRON_SECRET
```

**Structure Decision**: Stay in the monolith layout used by features 008–012. Pure builders in
`lib/documents/` feed one client workspace, a single query module serves the page, and the database
enforces every invariant (one current version, stale checks, license date sync, never deleting
records, retention scope). Only the purge route touches the service-role key.

## Complexity Tracking

No constitution violations. Three choices deserve a note:

| Item | Why needed | Simpler alternative rejected because |
|------|------------|--------------------------------------|
| `document_events` table | Activity and the audit log need the intent ("Restored A, B moved to history"), which row diffs don't carry | Decoding `audit_events` lifecycle diffs is fragile and can't name both files reliably |
| Service-role client plus a scheduled caller | Storage objects can't be deleted from SQL, and no user session exists at 02:00 | Purging on page visit can leave files for months, which breaks SC-007 |
| Separate migration for one enum value | Postgres can't use a new enum value in the transaction that adds it | Putting it in the main migration would fail the backfill and constraints |
