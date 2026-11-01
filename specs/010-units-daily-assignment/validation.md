# Validation: Units Daily Assignment, Archiving, and Blocked Units

**Date**: 2026-11-01 | **Branch**: `010-units-daily-assignment`

## Automated checks

| Check | Result |
|-------|--------|
| `corepack pnpm lint` | Pass (0 errors; 4 existing warnings in files this feature didn't touch) |
| `corepack pnpm typecheck` | Pass |
| `corepack pnpm test` (Vitest) | Pass, 38 files / 239 tests (new: `status-on`, `units-view-params`, `assignment-board`, `monthly-allowance`, `assignment-card`, `unit-dialogs`; rewritten: `daily-board`, `current-drivers`) |
| pgTAP, full suite on rolnet-dev (rollback wrapper) | Pass, 46/46 files, including the new 280, 290, 300, 310 and rls/210 and 11 updated legacy files |
| `corepack pnpm check` (vinext) | 95% compatible, 0 issues (same partials as before: turbopack loaders, cacheComponents) |
| `corepack pnpm build:vinext` | Build complete |
| Playwright, feature specs (demo build on :3100) | Pass: `units-daily-assignment`, `unit-archive`, `units-register`, `remittances-daily-view` (32 tests) |
| Playwright, full suite (demo build) | 63 passed, 8 failed, none in this feature's screens. Six need a signed-out home page or a real email/password sign-in, which demo mode replaces with a fixed owner session (`accessibility-mobile`, `app-navigation` ×4, `ui-system-refresh`). Two depend on the date: on the 1st of the month the demo fleet's only remittance belongs to ROLNET-1, so the fleet and one-unit report totals are equal (`remittance-financials`), and the "This month" preset spans one day (`list-sort-filter`). |

## Database rollout

- Migrations 20261101000100 to 20261101000300 were dry-run in a rolled-back transaction, then pushed to rolnet-dev. The release-day seed created 38 assignments for 2026-11-01, and the status history backfill created 133 rows.
- The full suite found one bug: `record_unit_status_change()` stamped `changed_at` with `now()`, so a unit created and changed in one transaction had two rows with the same time. It was fixed by migration 20261101000400 (`clock_timestamp()`), also pushed.
- `types/database.ts` was not regenerated. The committed file is a hand-written 73-line file (only `AppRole` and `ProfileStatus`), and the Supabase clients aren't typed with `Database`. Replacing it with the 1,500-line generated file is a separate change.

## Screens (demo build, screenshots in `screenshots/`)

- Daily assignment view at 1440 px (4 per row) and 360 px (1 per row, no sideways scroll): saved, locked, blocked and open cards, "5 of 9 units assigned".
- Units list with Show archived, the row menu, and the archive confirmation with counts.
- Remittances Daily view with blocked cards and the Assign driver link.

## Not yet verified (manual, against the live dev server)

Demo mode has no write path, so these need the quickstart walkthrough (section 4) on the live dev server against rolnet-dev, as owner and as a staff account:

- Saving and overwriting an assignment, and the "Driver already assigned today" race with two cards.
- Archive and restore with their toasts, Add a unit with its toast, and Edit details save on the unit page.
- The status change confirmation releasing real assignments, and driver deactivation releasing assignments.
- Staff access: the Units page opens in Daily assignment view and `/units/<id>` is forbidden.
- Timings: SC-006 (view and date switches under 1 s) and SC-001 (12 units under 3 minutes).

The unit detail page has no demo-mode data source (it didn't before this feature either), so it is covered by component tests (`unit-dialogs.test.tsx`: details section, status confirmation) rather than a demo e2e spec.
