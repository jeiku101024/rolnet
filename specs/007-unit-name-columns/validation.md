# Validation: Unit Name and Register Columns

**Date**: 2026-10-30 · **Branch**: `007-unit-name-columns`

## Automated checks

| Check | Result |
|-------|--------|
| `corepack pnpm lint` | Pass: 0 errors; 4 old warnings in `app/actions/auth.ts` and `components/forms/demo-login-form.tsx`, which this feature doesn't touch |
| `corepack pnpm typecheck` | Pass |
| `corepack pnpm test` | Pass: 23 files, 109 tests, including the new `current-drivers.test.ts` and the unit-name error and sort cases |
| `corepack pnpm test:e2e` (demo build on :3100) | 27 passed, 6 failed. All 4 tests in `units-register.spec.ts` pass. The 6 failures (`accessibility-mobile`, 4 in `app-navigation`, `ui-system-refresh`) also fail on `main` without this feature, so they were already failing |
| `supabase db reset && supabase test db` | **Run against the linked `rolnet-dev` project instead of a local reset** (with the owner's go-ahead). Local Supabase can't start: Podman needs WSL or Hyper-V, and both need admin rights this machine doesn't have. See below |

## Database (rolnet-dev, 2026-10-30)

- `supabase db push --linked` applied only `20261030000200_add_unit_name.sql`; every earlier migration
  was already there. The backfill ran on real data: all 108 units were named after their body
  numbers, none is left without a name, and the `units_default_name` trigger and `units_name_unique`
  index exist.
- `supabase test db --linked` needs a container too, so the 39 pgTAP files were run through
  `supabase db query --linked`. Each file ran as one transaction: pgTAP was created inside it,
  assertion output went to a temp table, and a final exception rolled everything back while
  carrying the TAP output. Result: **39/39 files pass**, including all 14 assertions in
  `260_unit_name.sql`. Afterwards pgTAP was not installed and no test rows remained. A
  deliberately failing assertion was reported as `not ok`, which confirms the wrapper surfaces
  failures.
- This ran on a database already at the latest schema with existing data, not a clean `db reset`.
  The migrations' clean-setup path was not run again here.

## Manual checks (demo build, 360 px and desktop)

- Headers: Unit · Body number · Plate · Motorcycle · Current driver · Mileage · Status.
- ROLNET-1 shows Juan Dela Cruz; ROLNET-2 shows "Day off · no backup"; ROLNET-3 shows Pedro Santos
  with a Backup badge; ROLNET-9 to ROLNET-12 show "Unassigned".
- The page never scrolls sideways at 360 px (`scrollWidth - innerWidth = 0`); the table scrolls in its card.
  Names stay on one line. Plate numbers wrap at the hyphen, as they did before this feature.
- The add form shows "Unit name" (placeholder "e.g. ROLNET-1") and "Motorcycle" (placeholder "e.g. Yamaha YTX").

## Still to check signed in (T029)

This needs an owner login (and a staff login) on the app against `rolnet-dev`. There are no test
credentials in `.env.local`, so this is for the owner to do.

The owner and staff flows from [quickstart.md](quickstart.md) steps 2–8: adding and renaming units,
the duplicate-name error, the unit page title, assignment and day-off changes reflected in the
register, the staff read-only view, and 40-character names at 360 px.
