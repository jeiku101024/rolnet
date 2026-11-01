# Implementation Plan: Merged Expenses Page

**Branch**: `011-merged-expenses-page` | **Date**: 2026-11-01 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/011-merged-expenses-page/spec.md`

## Summary

Expenses and Maintenance become one **Expenses** page.

**Categories** (R1, R2):
- An expense gets a fixed category from a new enum: Change Oil, Front Tire, Rear Tire, Engine
  Sprocket, Chain, Rear Sprocket, Battery, or Others.
- Others carries a typed name. Main categories carry a **date replaced**.
- One check constraint enforces the shape.
- Existing expenses become Others with their old category name.

**The move** (R3, R4):
- A migration copies every part replacement and tire installation into expenses, with a
  deterministic name mapping.
- ₱0 rows are marked "Needs review".
- The migration verifies counts and sums per unit, and rolls back on any mismatch.
- The old tables, and the old category list, become read-only in RLS, the soft-delete allow-list,
  and API v1 (R9).

**The page** (R11):
- It reuses the feature 010 patterns: the `listView` toolbar, a primary "Add expense" button, the
  Base UI dialog for add and edit, the 3-dot row menu, an alert dialog for the owner-only delete,
  and toasts.
- The count line shows the filtered peso total, computed by summing the same filtered query (R8).

**Delete** is a soft delete through `soft_delete_record` with a stale check, and is audited by the
existing trigger (R7).

**Unit detail** gains "Last replaced" per main category (R15) and a Mileage section. Staff record
mileage from a dialog on the Units Daily card (R13).

**Retired**:
- next-due reminders, the dashboard's maintenance tile and panel, and the tire positions view (R14)
- the Maintenance routes, which now redirect (R12)

## Technical Context

**Language/Version**: TypeScript 5 (strict), SQL (Supabase Postgres 15), Next.js 16.4 App Router with `cacheComponents` and server actions

**Primary Dependencies**: Existing only (Supabase JS, Zod, `@base-ui/react`, lucide, the in-repo
`components/ui/*` from 010). **No new packages.**

**Storage**: Three ordered migrations ([contracts/database.md](contracts/database.md)):
1. `20261101000500_expense_fixed_categories.sql`: the enum, columns, constraints, indexes, backfill,
   `normalize_expense` trigger, and the rebuilt `dashboard_monthly_unit_summary`.
2. `20261101000600_move_maintenance_into_expenses.sql`: `maintenance_category_for`, the move, and
   the self-check.
3. `20261101000700_retire_maintenance_writes.sql`: dropped write policies, the narrowed
   soft-delete allow-list, and revoked execute on `replace_tire_installation` and `due_maintenance`.

**Testing**:
- **pgTAP**: new `constraints/320`, `constraints/330`, and `rls/220`. Updates to every file that
  inserts expenses, parts, or tires, or that calls `due_maintenance`. They run on rolnet-dev through
  the rollback wrapper, **after you approve it**.
- **Vitest**: categories and mapping, validation, last-replaced, list total, dialog, row menu,
  plus the updated navigation, dashboard, list-control, and API tests.
- **Playwright**: on the demo build (:3100).

**Target Platform**: Mobile-first web on Cloudflare Workers through vinext (`check` and
`build:vinext` stay green)

**Project Type**: Single Next.js monolith

**Performance Goals**:
- The Expenses page is 3 parallel reads: the page, the filtered total (1 read under 1,000 matching
  rows), and the units.
- Unit detail adds 2 small reads (last replaced, mileage).
- Search and filter changes render in under 1 s on a 12-unit fleet.

**Constraints**:
- Integer centavos only.
- The fleet date is in Asia/Manila.
- Tokens only. 360 px.
- The constitution's multi-step write rule is met by the existing expense form flow, kept
  unchanged: the expense is saved, then the receipt is uploaded and finalized, with idempotency keys
  and cleanup on failure.
- Every other action is a single write.

**Scale/Scope**:
- 3 migrations, 3 new pgTAP files and about 18 updated
- about 6 lib modules
- 2 action files changed, 2 removed
- about 7 new or changed components
- 3 pages changed, 2 turned into redirects
- demo data and docs

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Result |
|-----------|-------|--------|
| I. Free-Tier Sustainability | No service or package. The filtered total costs at most 1 extra read per page view at fleet scale (R8) | Pass |
| II. Monolithic Simplicity | An enum column instead of a lookup table. One trigger. A one-time SQL move. Old tables frozen, not rebuilt. Page-level redirects (R1, R9, R12) | Pass |
| III. Data Integrity and Auditability | Centavos. A check constraint for the category shape. Delete is a **soft delete** through `soft_delete_record` with a stale check, audited with the full before row (R7). The move preserves every source row, is idempotent, verifies counts and sums, and rolls back on mismatch (R3). `needs_review` can only be set by the migration (R4). The legacy tables are kept read-only | Pass |
| IV. Mobile-First, Human-Centered | One modal form with inline plain-language errors. Keyboard-accessible Base UI dialogs and menus. 360 px checked in e2e. Every refusal says what to do | Pass |
| V. Compliance Documents | Not touched | Pass |
| Workflow gates | Ordered migrations with pgTAP. `types/database.ts` regenerated (`--linked`). The 4 new functions have **no** EXECUTE grant. `dashboard_monthly_unit_summary` keeps its existing grant. A backup before migration 2 is documented as the recovery plan (quickstart). The remaining checks are lint, typecheck, Vitest, Playwright, `supabase test db` (rolnet-dev wrapper), the vinext check, and the Workers build | Pass, the rolnet-dev run needs your OK |

**Post-design re-check**: Pass. Phase 1 added one enum, six columns, three checks, one trigger, and
four functions with no grants (`normalize_expense`, `maintenance_category_for`,
`move_maintenance_into_expenses`, `verify_maintenance_move`). It removes write paths only. Every change is listed in
[contracts/database.md](contracts/database.md).

## Project Structure

### Documentation (this feature)

```text
specs/011-merged-expenses-page/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── database.md        # migrations, trigger, checks, retired writes, pgTAP coverage
│   ├── actions.md         # server actions and API v1 changes
│   └── ui.md              # page, dialogs, row menu, unit detail, daily card, nav/dashboard, copy
├── checklists/requirements.md
└── tasks.md               # next: /speckit-tasks
```

### Source Code (repository root)

```text
supabase/
├── migrations/20261101000500_expense_fixed_categories.sql
├── migrations/20261101000600_move_maintenance_into_expenses.sql
├── migrations/20261101000700_retire_maintenance_writes.sql
├── tests/constraints/320_expense_fixed_categories.sql   # new
├── tests/constraints/330_maintenance_move.sql           # new
├── tests/rls/220_expenses_merge_rls.sql                 # new
└── tests/…                                              # fixtures updated (contracts/database.md)
types/database.ts                                        # regenerated
lib/
├── expenses/categories.ts        # new: enum order, labels, isMainCategory, mainCategoryFor, categoryText
├── expenses/last-replaced.ts     # new: lastReplacedByCategory
├── expenses/list-total.ts        # new: loadExpenseTotal (shared filter, paged sum)
├── validation/expenses.ts        # category rules, future-date rule
├── validation/maintenance.ts     # removed
├── pagination/list-control-specs.ts  # expenses: fixed categories + review filter; maintenance removed
├── pagination/search-specs.ts    # expenses: custom_category + enum; maintenanceUnits removed
├── pagination/search-filter.ts   # RelatedSearch drops expense_categories
├── domain/resource-config.ts     # expenses fields; parts/tires/categories readOnly + readOnlyMessage
├── domain/crud.ts                # use readOnlyMessage
├── dashboard/queries.ts, ordering.ts  # maintenance due + recent maintenance removed; category label
├── navigation/items.ts, page-context.ts  # Maintenance removed; expenses copy
├── actions/errors.ts             # map the new constraint names
└── demo/mode.ts                  # demo expenses with categories (some moved, one needs_review); demo maintenance removed
app/
├── (operations)/expenses/page.tsx          # full-width list, toolbar action, total, new columns
├── (operations)/maintenance/page.tsx       # permanentRedirect → /expenses
├── (operations)/maintenance/[unitId]/page.tsx  # permanentRedirect → /expenses?unit=
├── (owner)/units/[id]/page.tsx             # Last replaced + Mileage sections
├── (owner)/dashboard/page.tsx              # copy
├── api/v1/[...segments]/route.ts           # tire replace → 405
├── actions/expenses.ts                     # create/update new fields; deleteExpense
├── actions/mileage.ts                      # revalidation paths
├── actions/parts.ts, actions/tires.ts      # removed
├── manifest.ts, forbidden/page.tsx         # copy
components/
├── expenses/expense-dialog.tsx, expense-form-fields.tsx, expense-row-menu.tsx,
│   delete-expense-dialog.tsx, category-cell.tsx       # new
├── forms/expense-form.tsx                  # removed (fields move to expense-form-fields)
├── units/last-replaced.tsx, units/mileage-section.tsx, units/record-mileage-dialog.tsx  # new
├── units/assignment-card.tsx               # "Record mileage" button
├── units/unit-details-section.tsx          # link → /expenses?unit=
├── ui/paged-list.tsx                       # optional emptyText on ListView
├── dashboard/attention-panels.tsx, fleet-stats.tsx, recent-data-glimpse.tsx  # maintenance removed
├── maintenance/*                           # removed
└── forms/part-replacement-form.tsx, tire-installation-form.tsx  # removed
tests/
├── unit/expense-categories.test.ts, expense-validation.test.ts, last-replaced.test.ts,
│   expense-list-total.test.ts, expense-dialog.test.tsx, expense-row-menu.test.tsx   # new
├── unit/…                                  # navigation, dashboard, list-controls, action-errors, unit-dialogs updated
├── integration/api/…                       # readOnly lists, expenses fields
└── e2e/expenses-merged.spec.ts             # new; app-navigation, list-sort-filter, dashboard-refresh, ui-system-refresh updated
docs/DEVELOPMENT.md                          # categories, move, retired maintenance, mileage location
```

**Structure Decision**: Stay in the monolith layout. Expense rules live in the database (check plus
trigger) and are mirrored in Zod. Pure helpers live in `lib/expenses/`, and UI pieces in
`components/expenses/`, following the `components/units/` pattern from 010. The legacy code is
deleted, and its tables stay, read-only.

## Complexity Tracking

No constitution violations. Two choices deserve a note:

| Item | Why needed | Simpler alternative rejected because |
|------|------------|--------------------------------------|
| `needs_review` with a relaxed amount check | The spec requires ₱0 moved records to be flagged, not dropped or invented (FR-037, FR-040) | Skipping ₱0 rows breaks SC-002 (every source appears). A placeholder ₱0.01 would falsify totals. |
| The filtered total sums a second paged read | The total must match the search and filters to the centavo (SC-003) | A SQL aggregate RPC would reimplement search and drift. PostgREST aggregates need a project-wide setting. |
