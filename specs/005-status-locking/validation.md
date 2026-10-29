# Feature 005 validation: status toggles and edit locking

## Baseline (T001, 2026-10-29)

- Branch `005-status-locking` with `origin/main` (`5924966`, after PR #17) merged in.
- `corepack pnpm lint`: 0 errors (4 existing warnings). `corepack pnpm typecheck`: clean.
  `corepack pnpm test`: 15 files, 68 tests passed.
- Docker is not installed on this machine, so `supabase db reset` and `supabase test db` cannot
  run locally. Database tests run on rolnet-dev inside a rolled-back transaction (the migration
  and the test in one `begin … rollback` script, with the pgTAP stand-in), as for earlier
  migrations; CI runs `supabase test db` on a fresh database.

## Database tests (T002–T004)

- `supabase/tests/constraints/250_status_locking.sql` ran on rolnet-dev inside one rolled-back
  transaction with the migration: **16/16 passed**. Without the migration the test fails (the new
  trigger functions do not exist), so it tests the new behaviour.
- `types/database.ts` was not regenerated: there is no local database here, and the migration adds
  only trigger functions, which the generated types do not include.
- The migration was applied to rolnet-dev with `supabase db push --linked` on 2026-10-29, at the
  owner's request, before the PR. CI runs `supabase test db` on a fresh database.

## Quality gates (T025)

- `corepack pnpm lint`: 0 errors (the same 4 existing warnings). `typecheck`: clean.
- `corepack pnpm test`: 16 files, 72 tests passed (4 new in `tests/unit/record-status.test.ts`).
- `corepack pnpm exec next build`: compiled with no prerender errors.

## 360 px check (T013, T019, T022, T026), run `NSLY` and `RCCM`, 2026-10-29

Chromium at 360 × 800 (mobile, touch) against the dev server on this branch, rolnet-dev data,
owner and approved staff. The script is kept out of git (`.git/status-lock-check.mjs`).

| Quickstart row | Check | Result |
|---|---|---|
| 1 | Units list: set In repair from the row, reload, kept; no horizontal scroll | Pass (saved in 335 ms) |
| 1 | Search "retired" hides an In repair row; search by body number still finds it | Pass |
| 2 | Locked unit page: notice, no edit form, history "Active → In repair", no scroll | Pass |
| 3 | Mileage reading on an In repair unit | Pass in pgTAP (not repeated in the browser) |
| 4 | REST `PATCH` of `make_model` on a locked unit | Pass after the migration was applied (400, value unchanged; run `VHAH`); first run `NSLY` got 200 before it was applied |
| 5 | Set Active on the unit page: edit form appears without reload; details save | Pass |
| 6 | Drivers list: set Inactive, kept; driver page notice, no form, history, no scroll | Pass |
| 7 | Inactive refused for a driver with a current assignment | Pass (run `VHAH`): the "End or remove them" message is shown and the dropdown returns to Active |
| 8 | No new assignment for an Inactive driver | Existing rule, unchanged |
| 9 | License renewal for an Inactive driver updates the expiry | Pass in pgTAP |
| 10 | Picking the current status again adds no history entry | Pass |
| 11 | Stale change: "This unit was changed by someone else. It is now Retired." | Pass |
| 12 | Staff: lists show read-only badges with no dropdown; staff REST status change updates no row | Pass |
| SC-001 | Status change from a list: two taps, saved in well under 5 s | Pass (335 ms save) |

Found and fixed during the check: the table search matched every option of a status dropdown
(a search for "retired" matched every unit). `components/ui/table-search.tsx` now searches only a
select's chosen option.

Correction to the spec: staff can already view the units and drivers pages (they are not
owner-only), so they see the status as a read-only badge. The edge case and quickstart row 12
were updated.

Re-run `VHAH` after the migration was applied: **23/23 passed**.

## Status colours (run `VRRX`)

The dropdowns use the same colours as the status badges: Active green, In repair yellow, Retired
red, and Inactive red (Inactive was grey before). The computed colour and background of each
dropdown equal the matching badge's: **5/5 passed**.
## Dropdown size and refusal message (run `HPKZ`, 2026-10-30)

The status dropdown is badge-like: 2.125rem (34 px) tall, 1.52x the 22.4 px status badge, and only
as wide as its text. A refusal message now floats under the dropdown, with a Dismiss button, so it
no longer changes the row or cell size. Checked at 360 px and 1280 px: **12/12 passed** (row
height and dropdown width unchanged, message fully visible, no page overflow). Regression re-runs:
`YBJP` 23/23 and `AXSC` 5/5.