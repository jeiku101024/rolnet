# ROLNET Development Guide

ROLNET is a mobile-first tricycle fleet management application for one fleet owner and staff. It covers units, daily driver assignments, daily remittances, expenses (including parts and tires), mileage, documents, dashboard alerts, audit history, and Weekly, Monthly and Yearly Excel (.xlsx) reports.

## Quick start

Requirements: Node.js 24 LTS, Corepack/pnpm 12, Git, a Supabase project for backend mode, and Docker or Podman with a Linux VM backend for local Supabase integration tests.

Install:

    corepack enable
    corepack pnpm install

## Demo mode (no backend)

Demo mode lets another laptop review the complete UI without Docker, Supabase, Auth, Postgres, or Storage. Data is deterministic and in-memory; changes are not persisted.

Create .env.local with:

    NEXT_PUBLIC_DEMO_MODE=true
    DEMO_MASTER_EMAIL=owner@demo.local
    DEMO_MASTER_PASSWORD=demo1234

Start with:

    corepack pnpm dev

Open http://localhost:3000/login and use owner@demo.local / demo1234.

Demo mode exposes owner navigation and sample records for units, drivers, expenses, remittances, documents, dashboard, reports, and audit history. It is strictly for local UI review.

## Dockerized development

The repository includes Dockerfile, docker-compose.yml, .dockerignore, and .env.docker.example.

Start a portable demo container:

    Copy-Item .env.docker.example .env.docker
    docker compose up --build

Then open http://localhost:3000/login. The compose service runs Node 24, installs pinned pnpm dependencies, and starts Next.js with source/dependency volumes for live development.

Build/run a production-like image:

    docker build --target runner -t rolnet:local .
    docker run --rm -p 3000:3000 --env-file .env.docker rolnet:local

Podman users can use the equivalent compose command after starting a Podman Linux machine. On Windows, Podman still needs WSL2 or another approved Linux VM provider.

## Backend mode

Copy .env.example to .env.local and set:

    NEXT_PUBLIC_DEMO_MODE=false
    NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
    NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

Never commit .env.local or expose a service-role key through NEXT_PUBLIC_*.

With Docker or compatible Podman:

    corepack pnpm exec supabase start
    corepack pnpm exec supabase db reset
    corepack pnpm exec supabase gen types --lang typescript --local
    corepack pnpm exec supabase test db

All schema, RLS, Storage policies, triggers, and query functions belong in supabase/migrations/. Manual dashboard schema edits are prohibited.

## Tech stack

| Area | Technology |
|---|---|
| App | Next.js 16.4 App Router, React 19.3.1, TypeScript |
| UI | Tailwind CSS 4, shadcn/ui, class-variance-authority, lucide-react |
| Forms | React Hook Form and Zod |
| Backend | Supabase Auth, PostgreSQL, RLS, private Storage |
| Deployment | Cloudflare Workers through vinext and Wrangler |
| Tests | Vitest, Testing Library, Playwright, pgTAP |
| Package manager | pnpm 12 through Corepack |

## Useful commands

    corepack pnpm dev
    corepack pnpm dev:vinext
    corepack pnpm lint
    corepack pnpm typecheck
    corepack pnpm test
    corepack pnpm test:e2e
    corepack pnpm check
    corepack pnpm build:vinext

## Repository structure

    app/                  Next.js routes, actions, and route handlers
    components/           shadcn/ui and feature components
    lib/                  auth, Supabase, validation, money, uploads, reports
    supabase/migrations/  ordered SQL schema/RLS/Storage/query changes
    supabase/tests/       pgTAP constraint and RLS tests
    tests/                Vitest and Playwright tests
    specs/                constitution, spec, plan, tasks, validations
    docs/                 handoff and operations documentation

## Business/data rules

- Money is always integer centavos; display formatting is presentation-only.
- Returned remittance is 18,000 centavos; overnight/overtime is 30,000 centavos total. The screens
  call this amount the **Rental** (formerly "Due").
- Remittance financials (feature 009): every remittance stores an **Allowance** of ₱40
  (`allowance_centavos = 4000`), fixed when it is saved, and a **Deposit** = paid − allowance
  (`deposit_centavos`, may be negative). The database keeps the deposit in step with the payments
  (triggers `remittances_set_deposit` and `remittance_payments_sync_deposit`), so it is correct for
  every entry path. A payment can't take a remittance's total above its rental; the database rejects
  it with "Payment can't exceed the rental of ₱X. At most ₱Y more can be recorded." There is no
  credit. Records that were already overpaid before this rule keep their payments, show "Paid", and
  accept no new payment.
- Remittances (feature 008, updated by feature 010): Daily view (`/remittances`, optional
  `?date=YYYY-MM-DD`, never after today) is where remittances are recorded and corrected, one card per
  non-archived unit; List view (`/remittances?view=list`) is the read-only history, newest first.
  Each card shows the unit's saved daily assignment for the date, tagged Primary or Backup from the
  driver record; a saved record keeps the driver it was saved under. A unit with no assignment shows
  "Assign driver", linking to `/units?view=daily&date=…`, and can't be saved until one exists. A unit
  In repair or Retired on the date is a grayed-out blocked card, left out of "N of M recorded" and
  the received total; a record saved before the status change still shows. Archived units are hidden
  on every date, but their records stay in List view and reports. The database refuses a new
  remittance without a matching daily assignment (`validate_remittance`).
- Payments entered from a Daily view card are dated on the card's date (now for today, noon in the
  fleet timezone for a past date), so monthly totals count them on that date. A saved record's
  disposition never changes (the owner reverses it on its details page); raising the payment adds the
  difference, and only the owner can lower it, which voids the earlier payments with a reason and
  records the new total.
- Reports (`/reports`, owner only) download Weekly (Monday to Sunday of any date), Monthly and Yearly
  .xlsx files for the whole fleet or one unit (retired units included), from
  `GET /api/reports/{weekly|monthly|yearly}`. They follow the client's template, with live
  formulas for subtotals, Net and grand totals. The workbook is written by `lib/reports/xlsx.ts`
  (no spreadsheet package). The old monthly CSV download is gone; the `monthly_report` SQL function
  and its pgTAP tests remain in the database but the app no longer calls it.
- Business rows have timestamps, actor IDs, and soft deletion.
- Driver profile license expiry must match the current license document. Uploading, renewing,
  reverting, restoring or bringing back a license sets the profile date in the same transaction
  (feature 013); removing the only license keeps the profile date.
- Receipts target 300 KB and hard-limit at 500 KB; documents hard-limit at 5 MB.
- Document status uses the fleet timezone and three tiers everywhere (feature 013): Expired (before
  today), Due within 7 days (today through 7 days ahead), Valid (`lib/documents/status.ts`). The
  dashboard's expiring-documents panel and `expiring_documents()` cover 7 days.
- Drivers are Active or Inactive; units are Active, In repair or Retired. Only the owner changes a
  status. Inactive drivers and In repair or Retired units have locked details (enforced in the
  database); daily operations, mileage, documents and license renewals still work for them.
- Each unit has a name (for example `ROLNET-1`) alongside its body number: 1–40 characters, unique
  among non-deleted units ignoring case and surrounding spaces. A missing or blank name defaults to
  the body number in the database, which is how existing units got theirs (feature 007).
- Daily assignments (feature 010): drivers are assigned to units day by day on the Units page's
  Daily assignment view (`/units?view=daily&date=YYYY-MM-DD`, any date, owner and staff). One driver
  per unit and one unit per driver per day, enforced by unique indexes on `unit_assignments`; saving
  goes through `save_unit_assignment` (insert, or overwrite with the `updated_at` the card showed).
  Future dates pre-fill each card with the unit's latest earlier driver
  (`latest_unit_assignments_before`); pre-fills are never stored. Once a remittance is saved for a
  unit and date, that day's assignment is locked until the remittance is reversed. A unit's current
  driver anywhere in the app is its saved assignment for today (`lib/assignments/current-drivers.ts`).
  Primary assignments, days off and backup coverage are read-only history.
- Unit status over time (feature 010): every status change is recorded in `unit_status_changes`
  (written by a trigger, effective on its fleet date). A unit is blocked on a date when its status in
  effect then is In repair or Retired (`unit_status_on`, mirrored by `lib/units/status-on.ts`); dates
  before the change are never affected. A unit appears in the daily views from the fleet day it was
  added.
- Releasing (feature 010): setting a unit to In repair or Retired, archiving it, or deactivating or
  archiving a driver soft-deletes their assignments dated today or later, except days that already
  have a remittance. The screens confirm first when any exist. Released assignments are not restored.
- Archive (feature 010): units are archived (`units.archived`), never deleted; `soft_delete_record`
  refuses units. Archived units are hidden from the Units list (unless "Show archived"), both daily
  views, and pickers for new records; their history stays in remittance List view and reports.
- Release day: migration `20261101000300` seeds today's assignments from the old model (the primary,
  or the backup covering the primary's day off). Apply it on the morning the app is deployed.
- Expenses (feature 011): one **Expenses** page (`/expenses`) replaces Expenses and Maintenance.
  Every expense has a fixed category (`expense_category` enum, in this order): Change Oil, Front
  Tire, Rear Tire, Engine Sprocket, Chain, Rear Sprocket, Battery, or Others. Main categories carry
  a **date replaced** (`replaced_date`); Others carries a typed **category name**
  (`custom_category`, 1–80 characters, spaces tidied) and shows "N/A" in Last Replaced. The check
  `expenses_category_shape_check` enforces this. Dates can't be in the future (checked by the app's
  validation; the database accepts them so far-future pgTAP fixtures keep working). Staff add and
  edit; only the owner deletes, through `soft_delete_record` with a stale check, and the delete is
  audited with the full old values. There is no restore on any screen.
- The maintenance move (migration `20261101000600`): every non-deleted part replacement and tire
  installation was copied into expenses by `move_maintenance_into_expenses()`. Part names map to a
  main category through a fixed variant list (`maintenance_category_for`, mirrored by
  `mainCategoryFor` in `lib/expenses/categories.ts`), otherwise they become Others with the part
  name. Tires map Front to Front Tire and Rear left/right to Rear Tire. Mileage and next-due values
  go into the notes. ₱0 records are marked **Needs review** (`needs_review`; only migrations can set
  it, and saving a real amount clears it), and every moved row keeps `source_table`/`source_id`
  ("Moved from maintenance" filter). `verify_maintenance_move()` checks per unit that counts and
  peso sums match, and the migration rolls back on any mismatch. **Back up `expenses`,
  `part_replacements` and `tire_installations` before applying it to a database with real data.**
- Retired maintenance writes (migration `20261101000700`): `part_replacements`,
  `tire_installations` and the old `expense_categories` list are read-only (no write policies, not
  soft-deletable, read-only in API v1). `replace_tire_installation` and `due_maintenance` are no
  longer callable by the app, so next-due reminders and the dashboard's maintenance panel are gone.
  `/maintenance` and `/maintenance/{unitId}` redirect to `/expenses` (filtered to the unit).
- Mileage (feature 011): the owner records readings on the unit detail page, which lists them
  newest first; staff use "Record mileage" on each unit card in the Units Daily view. The rules are
  unchanged (`validate_mileage_reading`).
- Driver absences (feature 012): a **Day-off** covers one date; an **On-leave** covers a date range
  or is open-ended (`driver_absences`, reason from a fixed list). The driver stores only Active or
  Inactive (`is_active`); **Status today** is derived: Inactive, else Day-off/On-leave when an
  absence covers today, else Active. An absence covers a date when it isn't cancelled, the date is on
  or after `start_date`, on or before `end_date` (if any), and before `ended_early_on` (if any)
  (`driver_absent_on`, mirrored by `covers()` in `lib/drivers/absences.ts`). Absences end by date on
  their own; nothing runs on a schedule and the system never ends a leave. The exclusion constraint
  `driver_absences_no_overlap` stops one driver's absences from covering the same date. Inactive
  drivers can't get absences. Owner and staff manage absences; past start dates are allowed and past
  assignments and remittances never change.
- Availability (feature 012): a driver is offered in the Units Assign driver dropdown on a date only
  when Active, not absent that date, licensed that date, and not saved on another unit that date
  (`lib/drivers/availability.ts`); `validate_unit_assignment` also refuses an absent driver. Pre-fill
  skips a driver who is absent. The dashboard's backup list leaves out drivers absent today.
- Releasing for absences (feature 012): `save_driver_absence` adds or edits an absence and
  soft-deletes the today-and-later assignments it newly covers, in one transaction, only when the
  caller passes exactly that list (the dialog confirms it first; a changed list returns "Assignments
  for these dates changed. Review them again."). An assignment with a remittance is never released:
  the absence save is refused. Marking a driver Inactive keeps those locked assignments (feature 010).
  Cancel (upcoming only), End early (covering today; sets `ended_early_on` to today, optionally
  cancelling upcoming absences), and "Still on leave" go through `cancel_driver_absence`,
  `end_driver_absence`, and `confirm_driver_leave`.
- Role history (feature 012): Primary/Backup is a label only. `set_driver_role` (security definer,
  any approved user, because driver updates are owner-only under RLS) changes `driver_kind` and logs
  `driver_role_changes` together; `undo_driver_role_change` reverts the caller's latest change within
  60 seconds and withdraws (soft-deletes) its entry. The role on a past date is the latest change on
  or before it, or the first change's previous role, or the current role when nothing is logged
  (`roleOn` in `lib/drivers/role-on.ts`); the Remittances cards, the unit and driver pages use it.
  Existing drivers have no history rows. API v1 no longer updates `driver_kind`.
- Stale leave flag (feature 012): an open-ended leave open `stale_leave_amber_days` (14) or more is
  flagged amber, `stale_leave_red_days` (30) or more red; "Still on leave" hides the flag until the
  check date plus `stale_leave_snooze_days` (7). The thresholds are `fleet_settings` columns (no
  screen yet). Flags are informational only: they never change availability or end a leave, and no
  notification is sent. The Drivers list banner's dismiss lasts for the browser session.
- Documents (feature 013): a document is every `documents` row with one type and holder; the one
  `current` row is the current version, `superseded` rows are History (newest `superseded_at`
  first), and `reverted` rows are Reverted uploads. A document whose only version was reverted has no
  current row and counts as removed. Every action is one security definer function that starts with
  `require_owner()`, takes an advisory lock, and checks the current version the caller saw:
  `save_compliance_document` (first upload or renewal), `revert_document_upload` (modal and toast
  Undo; refused right after a Restore), `restore_document_version`, and
  `bring_back_document_version` (only while the file is kept). Each writes a `document_events` row
  (Activity, also in the audit log). No row is ever deleted.
- Document retention (feature 013): a reverted file is kept 30 days (`purge_after`). The app hides
  it once that date passes. `POST /api/cron/purge-document-files` (Bearer `CRON_SECRET`) deletes due
  Storage objects with the server-only service-role client (`lib/supabase/service.ts`, importable
  only from `app/api/cron/**`) and stamps `file_deleted_at` through `mark_document_files_deleted`
  (service_role only). `.github/workflows/purge-document-files.yml` calls it daily at 02:00 Manila
  using the repository secrets `PURGE_URL` and `CRON_SECRET`. GitHub turns scheduled workflows off
  after 60 days without commits in a public repository; the Documents page then shows "File cleanup
  is overdue". Turn it back on from the repository's Actions tab ("Enable workflow").
- Documents page URL (feature 013): `sort` (`expiry`, `expiry-desc`, `name`, `type`), `usearch`,
  `utype`, `ustatus`, `dsearch`, `dstatus` (comma lists) and `doc` (the open details modal). The
  old `?expiry=due` maps to Expired and Due in both panes, and `/documents/<id>` redirects to the
  current version's modal.

## Lists and dashboard (feature 006)

- Every record list shows 10 rows per page. The page and search live in the URL: `?page=N&q=text`
  for a page's main list, and a per-list prefix on detail pages (`assignments_page`, `documents_q`,
  …). Changing the search drops that list's page; page 1 and empty values are left out of the URL.
- Top-level lists page and search in the database (`lib/pagination/list-page.ts`,
  `lib/pagination/search-filter.ts`, specs in `lib/pagination/search-specs.ts`). Names on related
  rows are matched through an id lookup; enum columns are matched by their display labels.
  Detail-page lists are already fully loaded for coverage logic, so they page in memory (`pageRows`).
- The main lists also have sort and filter (`sort`, `from`/`to` dates, and per-list filters such
  as `status`, `unit`, `category`): a date button with quick ranges and a Filters panel next to
  search, removable chips, and a Sort menu beside the record count (`components/ui/list-controls.tsx`). Each list declares its sorts and filters once in
  `lib/pagination/list-control-specs.ts`; `lib/pagination/list-controls.ts` validates the URL,
  applies it to the Supabase query, and does the same in memory for demo mode. Unknown values are
  ignored; changing a sort or filter drops the page. The dashboard's "View all" links use these
  filters: `/units?status=in_repair`, `/drivers?kind=backup`, `/documents?ustatus=expired,due&dstatus=expired,due` (feature 013), and the
  owner-only `/remittances?view=list&balance=unpaid`.
- The dashboard has four bands, in this order on phones: Needs attention (expiring documents and
  unpaid balances, most urgent first; the maintenance panel was retired in feature 011), Fleet status (extradors today, units in repair),
  This month (figures and charts from `dashboard_monthly_unit_summary`, matching the monthly
  report), and Recent activity. Panels show 3 rows on phones and up to 5 on wider screens.

## Validation and release

Run lint, typecheck, tests, vinext check, and build:vinext. With a database runtime, also run all Supabase migrations, pgTAP, Storage/RLS tests, Playwright journeys, 100-unit/24-month dashboard performance checks, report reconciliation (a month's XLSX totals against List view and the Expenses page), and the acceptance protocol in specs/001-fleet-management/quickstart.md.

The remaining integration checkpoints are tracked in specs/001-fleet-management/tasks.md: T026, T043, T054, T065, T077, T090, T101, T108, T112, T115. They remain unchecked until a working Supabase runtime is available.

## Troubleshooting

- Demo login fails: verify .env.local has NEXT_PUBLIC_DEMO_MODE=true, restart Next.js, and use the credentials shown on the login page.
- Supabase connection refused: start the local stack or switch to demo mode.
- Docker/Podman on Windows: the CLI alone is insufficient; WSL2 or an approved Linux VM is required.
- Cloudflare build warning: vinext currently reports known partial support for middleware/cache behavior; treat vinext check and the Workers build as release gates.

## Deployment outline

1. Run all code, database, RLS, Storage, E2E, performance, and report checks.
2. Apply reviewed Supabase migrations with supabase db push --dry-run, then supabase db push.
3. Configure Cloudflare Workers environment variables/secrets.
4. Build and deploy through the vinext Cloudflare workflow.
5. Smoke-test login, one mutation, private upload/download, dashboard, and an XLSX report download.

