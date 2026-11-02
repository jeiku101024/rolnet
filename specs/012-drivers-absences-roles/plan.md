# Implementation Plan: Drivers Page, Primary/Backup Role Switch, Dated Absences, and Stale Leave Flag

**Branch**: `012-drivers-absences-roles` | **Date**: 2026-11-02 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/012-drivers-absences-roles/spec.md`

## Summary

Drivers get **dated absences**. A new `driver_absences` table holds Day-offs (one date) and On-leaves
(a range, or open-ended). Status today is derived from it: Inactive, Day-off, On-leave, or Active.
An exclusion constraint stops two absences for one driver from covering the same date. The
assignment validation trigger from feature 010 now also refuses a driver who is absent that day, so
the Units Daily assignment dropdowns and the database agree.

Saving an absence that covers today or later dates with saved assignments releases those
assignments in the **same transaction**, after the user confirms the list. A new
`driver_role_changes` table logs every Primary/Backup switch. Pages that show a past record work out
the role on that date from it, so old remittances keep their old tag. Open-ended leaves past the amber
or red threshold are flagged. "Still on leave" logs a confirmation and snoozes the flag. All three
thresholds are new `fleet_settings` columns.

The Drivers list becomes a full-width table with derived Status today, Current unit, a next-absence
line, a stale-leave banner, and an availability preview. Add driver moves into a modal. The profile
becomes one column: header with role switch and status dropdown, notices, a 4-card summary strip, an
inline-edit details grid, and URL-driven tabs that show 8 rows and load 8 more at a time.

The database owns the rules:
- **No overlap**: a gist exclusion constraint on each absence's effective date range (R2).
- **Absent means unassignable**: `validate_unit_assignment` calls `driver_absent_on()` (R4).
- **Release with the save**: `save_driver_absence` checks the release list it was given and releases
  in one transaction. Locked assignments (with a remittance) refuse through the existing trigger (R5).
- **Staff can switch roles**: a narrow `security definer` function, because driver updates are
  owner-only under RLS (R7).

## Technical Context

**Language/Version**: TypeScript 5 (strict), SQL (Supabase Postgres 15), Next.js 16.4 App Router with `cacheComponents` and server actions

**Primary Dependencies**: Existing only (Supabase JS, Zod, `@base-ui/react`, lucide). **No new packages.** It reuses the shadcn `base-nova` `dialog`, `checkbox`, `toggle-group`, `segmented-toggle`, `popover`, `tooltip`, `alert-dialog`, and the in-repo `toast` (extended with an optional action button for Undo, R10).

**Storage**: Two ordered migrations:
1. `20261102000100_driver_absences.sql`: enums, `driver_absences` (exclusion constraint), `driver_absence_confirmations`, `drivers.notes`, three `fleet_settings` columns, the absence validation trigger, `driver_absent_on`, the updated `validate_unit_assignment`, the functions `save_driver_absence`, `cancel_driver_absence`, `end_driver_absence`, and `confirm_driver_leave`, plus RLS and grants.
2. `20261102000200_driver_role_history.sql`: `driver_role_changes`, `set_driver_role`, `undo_driver_role_change`, and `lock_inactive_driver_details` no longer blocking `driver_kind`. RLS and grants.

**Testing**:
- **pgTAP**: new `constraints/340_driver_absences.sql` (shape, overlap, coverage, Inactive refusal, assignment refusal), `constraints/350_driver_absence_release.sql` (release list check, locked refusal, end early, cancel, confirm and snooze), `constraints/360_driver_role_history.sql` (switch, undo, inactive driver, from/to), and `rls/230_driver_absences_rls.sql` (staff and owner can manage absences and roles, unapproved users can't, no anon). They run against rolnet-dev through the rollback wrapper, **after you approve it**, because local Supabase can't run here.
- **Vitest**: `lib/drivers/absences.ts` (coverage, status today, absence status, next absence, stale level, snooze), `lib/drivers/role-on.ts`, `lib/drivers/availability.ts`, the drivers list builder (filters, Current unit, banner), the summary strip, tab paging params, and the absence form schema.
- **Playwright**: the demo build on :3100, at 1440 × 900 and 360 px.

**Target Platform**: Mobile-first web on Cloudflare Workers through vinext (`check` and `build:vinext` stay green)

**Project Type**: Single Next.js monolith

**Performance Goals**:
- The Drivers list renders in under 1 s for a fleet of about 30 drivers, from 4 parallel reads: drivers, open absences, today's assignments, and settings.
- The profile is about 7 parallel reads. Each tab reads only rows up to its current limit plus one.

**Constraints**:
- Fleet time zone Asia/Manila for "today", days open, coverage, and end-early dates.
- Integer centavos (Balance owed reuses `lib/remittances/financials.ts`).
- Tokens only, no hex colours or arbitrary sizes, and every screen works at 360 px.
- Every multi-write user action is **one database function call**: absence plus release, confirm plus snooze, end plus cancel upcoming, and role plus history. So the constitution's sequential-write clause isn't needed.
- `types/database.ts` is hand-maintained (see memory). New tables, enums, and functions are added by hand, not regenerated.

**Scale/Scope**: 2 migrations, 4 new pgTAP files and about 3 updated (assignment tests that create drivers), about 6 lib modules, 2 action files, about 14 components, 2 pages rebuilt, demo data, and docs.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Result |
|-----------|-------|--------|
| I. Free-Tier Sustainability | No new service or package. `btree_gist` is already enabled (first migration) and free on Supabase | Pass |
| II. Monolithic Simplicity | Three small tables. Status today, stale level, and role on a date are computed, not stored (R1, R8). The list filters in memory for a ~30-driver fleet instead of building SQL views (R9). No scheduler: nothing ends a leave automatically | Pass |
| III. Data Integrity and Auditability | An exclusion constraint guarantees no overlap even under concurrent saves (R2). Absence plus release, and role plus history, each commit in one transaction (R5, R7). Cancel, end early, and undo all mark rows, never delete them (R6, R7). Every new table has audit fields, `reject_hard_delete`, and `audit_business_change`. Past assignments and remittances are never touched: release only targets today and later, and locked rows refuse. Money is unchanged | Pass |
| IV. Mobile-First, Human-Centered | Summary cards go 2 per row and tabs scroll at 360 px. Modals and the radio group are keyboard-operable Base UI. Every refusal names the conflict and the next step | Pass |
| V. Compliance Documents | Driver licence documents move into an owner-only Documents tab, unchanged | Pass |
| Workflow gates | Ordered migrations with pgTAP. New public functions start with no EXECUTE. Granted to `authenticated` because the app calls them: `cancel_driver_absence`, `end_driver_absence`, `confirm_driver_leave` (invoker, RLS applies), plus `save_driver_absence`, `set_driver_role` and `undo_driver_role_change` (definer, check `is_approved_user()`; `save_driver_absence` is definer because a soft-deleted assignment fails the read policy, so an RLS-bound release is refused). `driver_absent_on` is not granted (used by the definer trigger only). The remaining checks are lint, typecheck, Vitest, Playwright, `supabase test db` (rolnet-dev wrapper), the vinext check, and the Workers build | Pass (full pgTAP suite on rolnet-dev, 2026-11-02) |

**Note on the definer role functions**: CLAUDE.md asks definer functions to check the caller with
`require_owner()` or `is_owner()`. Here the caller check is `is_approved_user()`, because the
clarified spec (FR-050) lets staff switch roles. The function touches only `driver_kind` and the
history row, so it doesn't widen staff write access to anything else (R7).

**Post-design re-check**: Pass. Phase 1 added three tables, two enums, seven functions, and two
triggers, with no packages or services. Every grant is listed in [contracts/database.md](contracts/database.md).

## Project Structure

### Documentation (this feature)

```text
specs/012-drivers-absences-roles/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── database.md        # tables, constraints, functions, triggers, RLS, grants, messages
│   ├── actions.md         # server actions, inputs, results, error codes
│   └── ui.md              # list page, modals, profile, tabs, notices, copy, URL params
├── checklists/requirements.md
└── tasks.md               # next: /speckit-tasks
```

### Source Code (repository root)

```text
supabase/
├── migrations/20261102000100_driver_absences.sql
├── migrations/20261102000200_driver_role_history.sql
├── tests/constraints/340_driver_absences.sql
├── tests/constraints/350_driver_absence_release.sql
├── tests/constraints/360_driver_role_history.sql
└── tests/rls/230_driver_absences_rls.sql
types/database.ts                       # hand-edited: new tables, enums, functions, drivers.notes, settings
lib/
├── drivers/absences.ts                 # new: coverage, statusToday, absenceStatus, nextAbsence, staleLevel
├── drivers/role-on.ts                  # new: roleOn(changes, currentKind, date)
├── drivers/availability.ts             # new: available drivers on a date + hidden counts by reason
├── drivers/list-board.ts               # new: list rows (Current unit, second lines), filters, banner
├── drivers/list-query.ts               # new: list reads (plus demo)
├── drivers/profile-query.ts            # new: profile reads, summary strip, tab pages (plus demo)
├── drivers/tab-params.ts               # new: tab + rows from the URL
├── validation/drivers.ts               # notes, status on create
├── validation/driver-absences.ts       # new
├── units/assignment-query.ts           # drops absent drivers; prefill skips absent
├── units/assignment-board.ts           # availability via lib/drivers/availability
├── remittances/daily-query.ts          # role on the service date via role-on
├── dashboard/queries.ts                # backup list leaves out drivers absent today (FR-064)
├── actions/errors.ts                   # map 23P01 (exclusion) and the new messages
└── demo/mode.ts                        # demo absences, a stale leave, role changes
app/
├── (owner)/drivers/page.tsx            # rebuilt list
├── (owner)/drivers/[id]/page.tsx       # rebuilt profile
├── (owner)/units/[id]/page.tsx         # assignment history role via role-on (FR-029)
├── actions/drivers.ts                  # createDriver (+notes/status), updateDriver (+notes), setDriverRole, undoDriverRole, previewAvailability
└── actions/driver-absences.ts          # new: previewAbsence, saveAbsence, cancelAbsence, endAbsence, confirmLeave
components/
├── ui/toast.tsx                        # optional action (Undo) and per-toast timeout
├── drivers/drivers-toolbar.tsx, drivers-table.tsx, stale-leave-banner.tsx,
│   availability-preview.tsx, add-driver-dialog.tsx, driver-status-badge.tsx         # new (list)
├── drivers/profile-header.tsx, role-switch.tsx, driver-status-control.tsx,
│   driver-notices.tsx, summary-strip.tsx, driver-details-section.tsx,
│   profile-tabs.tsx, absences-table.tsx, absence-dialog.tsx,
│   release-confirm-dialog.tsx, return-to-active-dialog.tsx                          # new (profile)
├── forms/driver-form.tsx               # fields reused inside the modal
├── forms/driver-details-form.tsx       # replaced by driver-details-section
└── forms/status-select.tsx             # drivers no longer use it
tests/
├── unit/driver-absences.test.ts, role-on.test.ts, driver-availability.test.ts,
│   drivers-list-board.test.ts, driver-tab-params.test.ts       # new
├── unit/assignment-board.test.ts, daily-board.test.ts           # updated
└── e2e/drivers-list.spec.ts, driver-profile.spec.ts, driver-absences.spec.ts   # new (demo)
docs/DEVELOPMENT.md                     # absence, availability, role history, stale flag rules
```

**Structure Decision**: Stay in the monolith layout used by features 008 and 010. Pure builders in
`lib/drivers/` are fed by one query module per page, and the database enforces every invariant
(no overlap, absent drivers unassignable, release with the save, locked assignments, role history
written with the role). Drivers get their own `components/drivers/` folder.

## Complexity Tracking

No constitution violations. Two choices deserve a note:

| Item | Why needed | Simpler alternative rejected because |
|------|------------|--------------------------------------|
| `set_driver_role` is `security definer` and allows staff | Clarified FR-050 lets staff switch roles, but `drivers` updates are owner-only under RLS | A staff update policy on `drivers` would let staff change any column. Column privileges don't combine cleanly with the existing policies and triggers |
| `ended_early_on` (date) stored alongside `ended_early_at` | The exclusion constraint needs an immutable expression for the covered range | Deriving the date from `ended_early_at` needs a time-zone conversion, which isn't immutable and can't be indexed |
