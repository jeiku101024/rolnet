# Implementation Plan: Remittances Daily View

**Branch**: `008-remittances-daily-view` | **Date**: 2026-10-30 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/008-remittances-daily-view/spec.md`

## Summary

Remittances gets a "List view | Daily view" toggle, and Daily view (on today) becomes the page's
default. Daily view shows one card per scheduled unit for a selected date. Each card shows the
driver who operated the unit that day, its due (₱180 or ₱300), the disposition, the payment, and
notes. It saves and locks, and an owner can assign a backup driver from the card. List view becomes
a full-width, read-only history whose row dates open that day in Daily view. The search placeholder
and toolbar borders are fixed to meet WCAG AA.

There is no migration. Everything Daily view needs is already stored: dated primary assignments,
days off, one-day backups that point to the primary they cover, and remittances that keep their own
`driver_id` and `assignment_id`. A new pure builder (`lib/remittances/daily-board.ts`) turns one
date's rows into cards, reusing `coverageOn`. A new client board renders the cards with the Base UI
primitives the app already depends on. Saves go through existing server actions, with two thin new
ones: a save that dates the payment on the card's date, and the owner's "lower the payment"
correction, which uses the existing `correct_remittance_payment` RPC.

## Technical Context

**Language/Version**: TypeScript 5 (strict), React 19.3, Next.js 16.4 App Router with `cacheComponents` (read `node_modules/next/dist/docs/01-app/02-guides/preserving-ui-state.md` and `01-getting-started/04-linking-and-navigating.md` before changing routing or page state)

**Primary Dependencies**: `@base-ui/react` 1.9 (popover, menu, tooltip, alert-dialog, toggle-group, progress; already installed), shadcn `base-nova` wrappers in `components/ui/`, `lucide-react`, Supabase JS, Zod. **No new packages.** The calendar is a small in-repo month grid, not `react-day-picker` (research R6).

**Storage**: Supabase Postgres, read and written through the existing tables, RLS, triggers, and RPCs. **No migration, no new RPC, no change to types/database.ts.**

**Testing**: Vitest (pure board builder, payment dating, payment-change planning, URL parsing) with Testing Library for the card's lock, edit, and validation states with mocked actions. Playwright in demo mode at 360 px and 1280 px (toggle, date control, grid columns, tags, not-operating cards, List view read-only, contrast). `supabase test db` is not needed because the schema doesn't change, though the existing suite must still pass.

**Target Platform**: Mobile-first web, deployed to Cloudflare Workers through vinext (`corepack pnpm check` and `build:vinext` must stay green)

**Project Type**: Single Next.js monolith (web app)

**Performance Goals**: A Daily view date loads in one round of 5 parallel queries scoped to that date. Changing the disposition updates the due on the client with no round trip. A save makes at most 2 writes for a new record, or 1 + N voids + 1 for an owner's lowering.

**Constraints**: Works at 360 px with no horizontal scroll. Shows 4 cards per row from 1200 px, 2 on tablet, 1 on phone. Uses only tokens from `app/globals.css` (two new tokens are added there, research R8 and R9). No hex values or arbitrary sizes in components. Money is integer centavos through `lib/money/centavos.ts`. No middle-dot strings in the new UI (DESIGN.md). Stays on the free tier.

**Scale/Scope**: A small fleet of tens of units and about 9 to 12 cards per day. One page with two views, about 6 new components, 2 new server actions, 1 pure builder, and 2 new tokens.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Result |
|-----------|-------|--------|
| I. Free-Tier Sustainability | No new service or package. Base UI is already a dependency | Pass |
| II. Monolithic Simplicity | It stays a page plus a pure builder plus thin server actions over existing tables and RPCs. No new RPC, view, or service. The calendar is about 80 lines in the repo instead of a new dependency | Pass |
| III. Data Integrity and Auditability | Amounts are centavos from end to end. The due is still set by `validate_remittance()`. Saved financial facts stay locked (FR-026 keeps the existing trigger's rule). Payment voids use the audited, owner-only `correct_remittance_payment`. Creates are idempotent (FR-028). Owner lowering is several writes, each in its own transaction, ordered so that no intermediate state overstates money received, and a retry converges on the same total (research R5). Saving a new record and its first payment is two ordered, idempotent writes. Both meet the multi-step clause added in constitution 1.1.0 | Pass (III, multi-step clause, amended 1.1.0) |
| IV. Mobile-First, Human-Centered | One column at 360 px. Touch targets are at least 44 px. Errors explain how to recover (FR-029, FR-014b). Status always has text (badges, tags, "Not operating"). Acceptance includes a 360 px pass | Pass |
| V. Compliance Documents | Not affected | N/A |
| Workflow gates | No schema change, so no migration or pgTAP is needed. No new SQL function, so no grants. Lint, typecheck, Vitest, Playwright, and vinext check are listed in quickstart.md | Pass |

**R5 note**: Owner lowering can't be one database transaction without a new SQL function, which the
spec rules out ("no changes to the database schema"). Constitution 1.1.0 (amended 2026-10-30) allows
this under principle III's multi-step clause: each write is atomic and audited, writes run void
first, insert last, so a partial failure can only understate what was received (the card shows "Owes
more" and says to save again) and never double-counts. **Decided by the project owner on 2026-10-30: keep
this multi-step approach with no migration.** The single-transaction alternative (one owner-only RPC
migration with pgTAP coverage) was considered and declined.

**Post-design re-check**: Pass. Phase 1 added no dependency, grant, migration, or service. The two
new tokens are documented in DESIGN.md with their measured contrast.

## Project Structure

### Documentation (this feature)

```text
specs/008-remittances-daily-view/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── remittances-page.md      # URL, views, and UI contract
│   └── daily-actions.md         # server actions used by Daily view
├── checklists/requirements.md
└── tasks.md                     # next: /speckit-tasks
```

### Source Code (repository root)

```text
app/
├── (operations)/remittances/page.tsx         # reads ?view & ?date; renders ListView or DailyView; no side panel
├── actions/remittances.ts                    # + saveDailyRemittance, editDailyRemittance (payment dating, owner lowering)
└── globals.css                               # + --token-info/-soft (Primary tag), --token-control-border
lib/
├── remittances/daily-board.ts                # new: buildDailyBoard(date, rows) -> cards + header totals (pure)
├── remittances/daily-query.ts                # new: loadDailyRows(supabase, date) and the demo equivalent
├── remittances/payment-plan.ts               # new: planPaymentChange(current, target, role) -> add | replace | none | blocked
├── remittances/view-params.ts                # new: parseRemittancesView(params, today) -> { view, date }
├── dates/fleet-date.ts                       # + paymentTimestampFor(date, now), formatLongDate, isAfterToday
├── dashboard/queries.ts                      # "View all" unpaid link gains view=list
└── demo/mode.ts                              # demo remittances include assignment_id/type and payments for today
components/
├── ui/segmented-toggle.tsx                   # new: base-nova wrapper over Base UI ToggleGroup
├── ui/popover.tsx, ui/dropdown-menu.tsx,     # new: shadcn base-nova wrappers (generated with `shadcn add`)
│   ui/tooltip.tsx, ui/alert-dialog.tsx, ui/progress.tsx
├── ui/month-calendar.tsx                     # new: accessible month grid, prev/next month, max date
├── ui/list-search.tsx                        # placeholder color, control border, explicit focus ring
├── ui/list-controls.tsx                      # control border token on date/filters/sort
├── ui/paged-list.tsx                         # `note` slot under the count (replaces the hint's middle dot)
└── remittances/
    ├── remittances-list.tsx                  # new: List view table, moved out of the page (read-only)
    ├── view-toggle.tsx                       # new: "List view | Daily view"
    ├── daily-view.tsx                        # new: client board (date control, header, grid, dirty guard, new-day banner)
    ├── date-control.tsx                      # new: prev/next arrows, date button + calendar popover, Today button
    ├── daily-card.tsx                        # new: one unit card (unrecorded / saved / editing / not operating)
    ├── driver-tag.tsx                        # new: Primary/Backup tag with "Covering for…" tooltip
    └── assign-backup-picker.tsx              # new: owner's on-card backup picker (calls assignBackupDriver)
components/forms/remittance-form.tsx          # removed (its only use was the side panel)
DESIGN.md                                     # document the new tokens and the card grid exception
tests/
├── unit/daily-board.test.ts                  # new
├── unit/payment-plan.test.ts                 # new
├── unit/remittances-view-params.test.ts      # new
├── unit/fleet-date.test.ts                   # new or extended: paymentTimestampFor, formatLongDate
├── unit/month-calendar.test.tsx              # new: grid, month navigation, max date, keyboard
├── unit/daily-view.test.tsx                  # new: new-day banner and unsaved-changes guard (fake timers)
├── unit/daily-card.test.tsx                  # new: lock/edit/blocked states with mocked actions
└── e2e/remittances-daily-view.spec.ts        # new: demo mode, 360 px and 1280 px
```

**Structure Decision**: Stay inside the monolith layout. The domain logic lives in pure `lib/remittances/*`
modules so it can be unit tested. The UI lives in `components/remittances/`, built from base-nova
primitives in `components/ui/`. The page stays a server component that loads one date's rows (or the
list page) and passes plain data to the client board.

## Complexity Tracking

No constitution violations to justify. The multi-write flows (the R5 note above) comply with
principle III's multi-step clause in constitution 1.1.0, which the project owner approved on
2026-10-30 instead of the one-migration alternative.
