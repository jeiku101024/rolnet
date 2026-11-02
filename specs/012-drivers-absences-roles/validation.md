# Validation: Feature 012

**Date**: 2026-11-02 | **Branch**: `012-drivers-absences-roles`

## Automated checks (T076)

| Check | Result |
|-------|--------|
| `corepack pnpm lint` | Pass: 0 errors, 4 warnings, none from this feature (2 in `app/actions/auth.ts` and `components/forms/demo-login-form.tsx`, plus the same 2 in the `.claude/worktrees/` copy) |
| `corepack pnpm typecheck` | Pass |
| `corepack pnpm test` (Vitest) | Pass: 49 files, 351 tests. New files: `driver-absences`, `driver-availability`, `role-on`, `drivers-list-board`, `driver-tab-params`, `absence-dialog`; updated: `assignment-board`, `list-controls`, `unit-dialogs` |
| `corepack pnpm check` (vinext) | Pass (same report as before) |
| `corepack pnpm build:vinext` | Pass (`Build complete.`) |
| Playwright, new specs (demo build on :3100) | Pass: 16 of 16 (`drivers-list`, `driver-profile`, `driver-absences`) |
| Playwright, full suite (demo build on :3100) | 89 passed, 3 skipped. Not caused by this feature: `accessibility-mobile`, `app-navigation` (4), and `ui-system-refresh` fail on the sign-in and navigation pages, which a demo build skips with its built-in owner session. `units-daily-assignment` "blocks a unit from the day it went into repair" fails sometimes (1 of 2 runs): it clicks "Previous day" four times without waiting. `paged-lists` was updated for the new "No drivers match." empty message |
| pgTAP on rolnet-dev (rollback wrapper) | Pass: 53 of 53 files, 748 assertions, after both migrations were pushed on 2026-11-02 (owner approved). A dry run first (both migrations plus every pgTAP file, rolled back) caught that `save_driver_absence` couldn't release assignments as an invoker function: a soft-deleted row fails the read policy. It was changed to `security definer` with an `is_approved_user()` check before the push. The dry run then passed 53 of 53 |

Screenshots of the demo build are in `screenshots/`: `drivers-list-1440.png`, `driver-profile-1440.png`, and `driver-profile-360.png`.

## Manual walkthrough (T078)

Not done yet. The migrations are now on rolnet-dev. Run `quickstart.md` steps 1–12 on the :3000 live dev server, including a staff login and a 360 px viewport.

## Constitution compliance review (T079)

| Principle | Check | Result |
|-----------|-------|--------|
| I. Free-Tier Sustainability | No new packages or services. `btree_gist` was already enabled. Toast Undo, tabs, and the popover use the existing Base UI components | Pass |
| II. Monolithic Simplicity | Status today, absence status, the stale level, and the role on a date are computed, not stored. No scheduler. The Drivers list filters in memory | Pass |
| III. Data Integrity and Auditability | Every new table has the audit columns plus `set_audit_fields`, `reject_hard_delete`, and `audit_business_change`. The exclusion constraint `driver_absences_no_overlap` blocks overlaps even when two people save at once. Absence plus release, role plus history, confirm plus snooze, and end plus cancel-upcoming each run in one database function. Cancel, end early, Undo, and release only mark rows. Release only touches today and later, and locked assignments are refused (absence) or kept (Inactive). No money logic changed (Balance owed reuses `remittanceTotals`) | Pass |
| IV. Mobile-First, Human-Centered | The list and profile have no horizontal scroll at 360 px (e2e). Summary cards go 2 per row. Tabs scroll sideways. Modals trap focus and close on Escape. The role switch is a radio group with arrow keys. Every refusal names the conflict or what to do | Pass |
| V. Compliance Documents | Driver licence documents are kept in an owner-only Documents tab. Assignment still requires a valid licence | Pass |
| Workflow gates | Two new ordered migrations, each with pgTAP. New functions start with no EXECUTE, and only the six app-called functions are granted. The two definer role functions check `is_approved_user()` (clarified FR-050). `types/database.ts` edited by hand | Pass |

## Deviations from tasks.md

- **T035 `drivers-table.tsx`**: the table rows are written in `app/(owner)/drivers/page.tsx`, because the table is only used there. It uses `DataTable` the same way.
- **T046 `daily-board.test.ts`**: the role on a date is worked out in `lib/remittances/daily-query.ts` before the pure board runs, so it is tested in `role-on.test.ts`. `daily-board.test.ts` needed no change.
- **T074 absence dialog**: demo mode disables saving, so the dialog's rules are tested in `tests/unit/absence-dialog.test.tsx` with mocked actions. The e2e spec checks the Absences tab.
- **Extra**: API v1 no longer accepts `driver_kind` in driver updates, so every role change goes through `set_driver_role` and its history (FR-026). `components/forms/driver-form.tsx` and `driver-details-form.tsx` were removed, and `StatusSelect` is now used for units only.
