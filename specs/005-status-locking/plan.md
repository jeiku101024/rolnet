# Implementation Plan: Driver and Unit Status Toggles with Edit Locking

**Branch**: `005-status-locking` | **Date**: 2026-10-29 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/005-status-locking/spec.md`

## Summary

The owner can switch a driver between Active and Inactive, and a unit between Active, In repair
and Retired. The switch is on the record's page and in the Status column of the `/drivers` and
`/units` tables. While a driver is Inactive, or a unit is In repair or Retired, its own details are
locked: the page shows them read-only with a notice, and the database refuses detail changes from
any route. Daily operations (remittances, expenses, maintenance, parts, tires, mileage, documents)
keep working.

Approach (see [research.md](research.md)):
- **Database:** one migration adds two `BEFORE UPDATE` lock triggers (on `units` and `drivers`) and
  a trigger that refuses to deactivate a driver who has current or upcoming assignments. No new
  columns or enum values: drivers keep `is_active`, and units keep `unit_status`.
- **Status history:** comes from the existing `audit_events` rows, which already store
  before/after snapshots.
- **App:**
  - Two small server actions set the status, with an `updated_at` check against stale views.
  - The existing update actions stop writing `status`.
  - A shared client `StatusSelect` is used in the tables and on the detail pages.
  - New owner-only edit forms for unit and driver details. They exist only while the record is
    Active; today the app has no edit UI for either.

## Technical Context

**Language/Version**: TypeScript 5 on Node 24; SQL (PostgreSQL 17 on Supabase)

**Primary Dependencies**: Next.js 16.4 (App Router, Server Actions, Cache Components), React 19,
Supabase (`@supabase/ssr`, supabase-js), Zod 4, shadcn `base-nova` components in `components/ui/`

**Storage**: Supabase Postgres; existing tables `public.units`, `public.drivers`,
`public.driver_assignments`, `public.audit_events`

**Testing**: Vitest (unit tests for schemas and status helpers), pgTAP in `supabase/tests/`
(behaviour of the lock and deactivation triggers), Playwright/journey run at 360 px

**Target Platform**: Cloudflare Workers through vinext; mobile browsers first

**Project Type**: Single Next.js web application (monolith) with Supabase backend

**Performance Goals**: A status change saves and the row re-renders in under 2 s on a mid-range
phone (SC-001's 5 s includes the user's two taps)

**Constraints**:
- 360 px viewport with no horizontal scroll; free tier only; no new libraries.
- Every schema change is a new migration with pgTAP coverage.
- Money rules are untouched.

**Scale/Scope**: About 100 units and about 200 drivers; 2 list pages, 2 detail pages, 2 new edit
forms, 1 migration

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
|---|---|---|
| I. Free-Tier Sustainability | No new services or dependencies; triggers and server actions only | Pass |
| II. Monolithic Simplicity | Same app and database; reuses `is_active`, `unit_status`, `audit_events`; no new status table | Pass |
| III. Data Integrity and Auditability | Locks enforced in the database, so every route is covered; changes audited by the existing trigger; stale writes refused through `updated_at`; no hard deletes; no money touched | Pass |
| IV. Mobile-First | Native select control, touch-sized, inside existing table cells; locked notice in plain language with the recovery step ("Set the status to Active to edit") | Pass |
| V. Compliance Document Lifecycle | Documents stay allowed for locked records; a license renewal may still update a locked driver's expiry, because the renewal function changes the document and the profile together | Pass |
| Quality gates | New migration `supabase/migrations/20261030000100_status_locking.sql` plus `supabase/tests/constraints/250_status_locking.sql`; lint, typecheck, Vitest, `supabase test db`, 360 px journey | Pass |

**Post-design re-check (after Phase 1)**: Pass. Three design choices keep the gates:
- Reusing `audit_events` for the status history avoids a new table.
- Keying the lock on the row's old state keeps one rule for the UI, server actions and `/api/v1`.
- Allowing the license-expiry change only when it matches a current license document keeps
  Principle V's renewal flow working.

## Project Structure

### Documentation (this feature)

```text
specs/005-status-locking/
├── plan.md              # This file
├── research.md          # Phase 0 decisions
├── data-model.md        # Phase 1: statuses, lock rules, state transitions
├── quickstart.md        # Phase 1: validation run guide
├── contracts/
│   └── status-actions.md  # Server actions, /api/v1 behaviour, UI contract
└── tasks.md             # Phase 2 ($speckit-tasks)
```

### Source Code (repository root)

```text
supabase/
├── migrations/20261030000100_status_locking.sql    # lock triggers + driver deactivation guard
└── tests/constraints/250_status_locking.sql        # pgTAP behaviour tests

app/
├── actions/units.ts          # + setUnitStatus; updateUnit no longer writes status
├── actions/drivers.ts        # + setDriverStatus
├── (owner)/units/page.tsx            # Status column → StatusSelect (owner)
├── (owner)/units/[id]/page.tsx       # status control, locked notice, edit form when Active
├── (owner)/drivers/page.tsx          # Status column → StatusSelect (owner)
└── (owner)/drivers/[id]/page.tsx     # status control, locked notice, edit form when Active

components/
├── forms/status-select.tsx           # shared client select (optimistic, reverts on refusal)
├── forms/unit-details-form.tsx       # edit body/plate/model (Active only)
├── forms/driver-details-form.tsx     # edit name/kind/license/phone/address (Active only)
└── records/locked-notice.tsx         # read-only notice with recovery text

lib/
├── status/record-status.ts           # labels, tones, icons, isLocked helpers
├── validation/units.ts               # + unitDetailsSchema, unitStatusSchema
└── validation/drivers.ts             # + driverStatusSchema

tests/unit/record-status.test.ts      # schemas and lock helpers
```

**Structure Decision**: This feature fits the single Next.js app. Database rules go in
`supabase/migrations/`; server actions in `app/actions/`; shared UI in `components/forms/` and
`components/records/`; pure helpers in `lib/status/`. No new top-level directories.

## Complexity Tracking

No constitution violations; nothing to justify.
