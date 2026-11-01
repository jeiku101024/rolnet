# Implementation Plan: Units Daily Assignment, Archiving, and Blocked Units

**Branch**: `010-units-daily-assignment` | **Date**: 2026-11-01 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/010-units-daily-assignment/spec.md`

## Summary

Drivers stop being permanently attached to units. A new `unit_assignments` record holds one driver
per unit per day. Two unique indexes stop a driver or a unit from being double-booked, even when two
saves race. The Units page gets a **Daily assignment view** with a card per unit, a date picker that
allows future dates, pre-fill from the latest earlier assignment, save-and-lock, and blocked cards.
Its List view is simplified (Add a unit modal, row menu, read-only status, "Show archived").
**Archiving** replaces deleting. The unit detail page is redesigned. The Remittances Daily view reads
drivers from the daily assignments and grays out blocked units.

The database owns the rules:
- **Status history**: a new `unit_status_changes` table, written by trigger and backfilled from the
  audit trail, decides whether a unit is blocked on any date.
- **Release**: triggers on unit status, unit archive, and driver deactivate or archive release
  assignments from today onward.
- **Remittance link**: a new remittance must match that day's assignment.
- **Lock**: an assignment locks once its day has a remittance.

A one-time step in the migration copies each unit's current driver into an assignment for release
day. Old primary, day-off, and backup records stay read-only for history.

## Technical Context

**Language/Version**: TypeScript 5 (strict), SQL (Supabase Postgres 15), Next.js 16.4 App Router with `cacheComponents` and server actions

**Primary Dependencies**: Existing only (Supabase JS, Zod, `@base-ui/react`, lucide). **No new packages.** The shadcn `base-nova` `dialog` and `checkbox` components are added (built on Base UI). The toast is a small in-repo wrapper on Base UI's `Toast` (research R14).

**Storage**: Three ordered migrations:
1. `unit_assignments`: the table, unique indexes, RLS, the validation and lock trigger, `save_unit_assignment`, and `latest_unit_assignments_before`.
2. Unit status history and archive: `unit_status_changes` with its backfill, `unit_status_on`, the archive columns, release triggers, the dropped feature-005 deactivation block, and `soft_delete_record` refusing units.
3. Remittances on daily assignments: `unit_assignment_id`, the new `validate_remittance`, the extended facts lock, retired legacy write policies, and the release-day seed.

**Testing**:
- **pgTAP**: new files `constraints/280` to `310` and `rls/210`, plus updates to existing files that create legacy assignments or remittances (030, 110, 170, 240, 250, 270; rls 010, 030, 100, 140, 200). They run against rolnet-dev through the rollback wrapper, **after you approve it** (local Supabase can't run here).
- **Vitest**: `statusOn`, the assignment board (pre-fill, availability, blocked and locked cards, counts), the remittance board, the monthly allowance blocks, and URL params.
- **Playwright**: the demo build on :3100.

**Target Platform**: Mobile-first web on Cloudflare Workers through vinext (`check` and `build:vinext` stay green)

**Project Type**: Single Next.js monolith

**Performance Goals**:
- Switching views or dates shows the new board in under 1 s (SC-006). A board is 5 parallel reads for one date (units, status changes, assignments, drivers, plus the pre-fill RPC on future dates) for a 12-unit fleet.
- The unit page's 12-month blocks need 2 grouped reads.

**Constraints**:
- Fleet time zone Asia/Manila for "today", `effective_on`, and creation dates.
- Integer centavos.
- Tokens only, and every screen works at 360 px.
- The constitution's rule for multi-step writes doesn't apply: every action here is a single database write, with releases inside the same statement through triggers.

**Scale/Scope**: 3 migrations, 5 new and about 11 updated pgTAP files, about 8 lib modules, 4 action files, about 12 components, 3 pages, demo data, and docs.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Result |
|-----------|-------|--------|
| I. Free-Tier Sustainability | No service or package. The Base UI components come from an existing dependency | Pass |
| II. Monolithic Simplicity | Two small tables and plain triggers. Pre-fill is computed, not stored. One page URL with two views. Old structures are retired, not rebuilt (R1, R15) | Pass |
| III. Data Integrity and Auditability | Unique indexes enforce one driver per unit per day and one unit per driver per day (R1). Releases soft-delete and are audited (R8). Archiving replaces deleting, and `soft_delete_record` refuses units (R12). Remittances can't drift from assignments (R6, R7). Money is untouched. Status history is append-only, written by trigger. The backfill and seed preserve all existing rows (R3, R13) | Pass |
| IV. Mobile-First, Human-Centered | Cards stack to 1 column at 360 px. The dialogs and menus are keyboard-accessible Base UI. Every refusal message says what to do next | Pass |
| V. Compliance Documents | Documents are listed on the unit page and kept on archive | Pass |
| Workflow gates | Ordered migrations with pgTAP. `types/database.ts` regenerated (`--linked`). New public functions start with no EXECUTE. `save_unit_assignment` and `latest_unit_assignments_before` are granted to `authenticated` (the app calls them, invoker, RLS applies). Trigger functions and `unit_status_on` / `release_unit_assignments` are not granted, and the definer triggers check `is_owner()`. The remaining checks are lint, typecheck, Vitest, Playwright, `supabase test db` (rolnet-dev wrapper), the vinext check, and the Workers build | Pass, the rolnet-dev run needs your OK |

**Post-design re-check**: Pass. Phase 1 added two tables, four functions, and triggers. There is no package or service, and every grant is listed in [contracts/database.md](contracts/database.md).

## Project Structure

### Documentation (this feature)

```text
specs/010-units-daily-assignment/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── database.md        # tables, functions, triggers, RLS, grants, error messages
│   ├── actions.md         # server actions and API v1 changes
│   └── ui.md              # Units views, cards, dialogs, detail page, Remittances changes, copy
├── checklists/requirements.md
└── tasks.md               # next: /speckit-tasks
```

### Source Code (repository root)

```text
supabase/
├── migrations/20261101000100_unit_assignments.sql
├── migrations/20261101000200_unit_status_history_and_archive.sql
├── migrations/20261101000300_remittances_use_unit_assignments.sql   # includes the release-day seed
├── tests/constraints/280_unit_assignments.sql           # 1:1 per day, eligibility, save function, lock
├── tests/constraints/290_unit_status_blocking.sql       # history backfill, status_on, blocked writes
├── tests/constraints/300_unit_archive_release.sql       # archive/restore, release triggers, soft delete refused
├── tests/constraints/310_remittance_unit_assignments.sql # insert rules, legacy rows still update, seed
├── tests/rls/210_unit_assignments_rls.sql                # staff read/write assignments; owner-only unit changes
└── tests/…                                               # existing files updated for the new remittance path
types/database.ts                                         # regenerated
lib/
├── units/status-on.ts            # new: statusOn(changes, date), existsOn(createdAt, date)
├── units/assignment-board.ts     # new: pure board, cards (open/saved/locked/blocked), pre-fill, availability, counts
├── units/assignment-query.ts     # new: one date's rows (plus demo)
├── units/view-params.ts          # new: view and date from the URL, staff forced to daily
├── units/monthly-allowance.ts    # new: 12-month allowance vs expenses blocks
├── units/archive-summary.ts      # new: counts for the archive modal
├── validation/unit-assignments.ts# new
├── validation/units.ts           # archive/restore inputs
├── validation/remittances.ts     # unitId + driverId instead of assignmentId
├── remittances/daily-board.ts    # driver from unit_assignments; blocked cards; no day-off cards
├── remittances/daily-query.ts    # reads unit_assignments and unit_status_changes; hides archived
├── assignments/coverage.ts, current-drivers.ts   # removed or reduced to today's unit_assignments
├── dashboard/queries.ts          # current unit from today's unit_assignments; archived excluded
├── domain/resource-config.ts     # assignments and driver-days-off read-only; unit-assignments read-only
├── actions/errors.ts             # map 23505 and new messages
└── demo/mode.ts                  # demo daily assignments, status changes, an archived unit
app/
├── (owner)/units/page.tsx        # header toggle; list (owner) or daily board
├── (owner)/units/[id]/page.tsx   # redesigned, owner-only
├── (owner)/drivers/[id]/page.tsx # forms removed; assignment history from unit_assignments
├── (operations)/remittances/page.tsx  # unchanged shell
├── actions/unit-assignments.ts   # new: saveUnitAssignment, upcomingAssignmentCount
├── actions/units.ts              # archiveUnit, restoreUnit, archiveSummary; softDeleteUnit removed
├── actions/drivers.ts            # confirmation count before deactivate/archive
├── actions/remittances.ts        # insert by unit + driver + date
└── actions/assignments.ts        # removed
components/
├── ui/dialog.tsx, ui/checkbox.tsx, ui/toast.tsx   # new (base-nova / Base UI)
├── ui/date-control.tsx           # moved from remittances; allowFuture + Upcoming tag
├── units/units-view-toggle.tsx, units/units-list.tsx, units/unit-row-menu.tsx,
│   units/add-unit-dialog.tsx, units/archive-unit-dialog.tsx,
│   units/assignment-view.tsx, units/assignment-card.tsx,
│   units/unit-status-control.tsx, units/unit-details-section.tsx,
│   units/monthly-allowance.tsx, units/assignment-history.tsx   # new
├── records/status-history.tsx    # units read unit_status_changes
├── remittances/daily-card.tsx, daily-view.tsx, driver-tag.tsx   # blocked card, assign link, no coverage tooltip
├── remittances/assign-backup-picker.tsx, forms/assignment-forms.tsx   # removed
└── forms/unit-form.tsx, unit-details-form.tsx   # used inside the modal and inline edit
tests/
├── unit/status-on.test.ts, unit/assignment-board.test.ts, unit/monthly-allowance.test.ts,
│   unit/units-view-params.test.ts             # new
├── unit/daily-board.test.ts, unit/daily-card.test.tsx   # updated
└── e2e/units-daily-assignment.spec.ts, e2e/unit-archive.spec.ts   # new (demo)
docs/DEVELOPMENT.md                # daily assignment, blocking, release, archive rules
DESIGN.md                          # card exception covers assignment cards
```

**Structure Decision**: Stay in the monolith layout, mirroring feature 008. A pure board builder per
view is fed by one query module, and the database enforces every invariant (one per day, blocked
dates, the remittance link, the lock, and release). Units get their own `components/units/` folder.

## Complexity Tracking

No constitution violations. Two choices deserve a note:

| Item | Why needed | Simpler alternative rejected because |
|------|------------|--------------------------------------|
| A separate `unit_status_changes` table | Staff and triggers need "status on a date", and the audit trail is owner-only JSON | Reading `audit_events` would need a definer reader over unindexed JSON, or exposing every audited field to staff |
| `remittances.assignment_id` made nullable plus a new `unit_assignment_id` | New remittances link to daily assignments while legacy rows keep their links | A synthetic `driver_assignments` row per day would write fake history and fight that table's constraints |
