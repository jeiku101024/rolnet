# Implementation Plan: Participant Loans Redesign

**Branch**: `022-participant-loans-redesign` | **Date**: 2026-11-23 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/022-participant-loans-redesign/spec.md`

## Summary

Replace the tall per-loan cards on the participant page (`/sinking-fund/participants/[id]`) with a compact Loans section: **Active** and **Paid and closed** tabs, one compact row per loan, one row expanded at a time, urgency ordering, a two-segment progress bar, a per-loan payment list, and **Add payment** / **Pay full balance** / **Mark as withdrawal** actions. The closed tab pages 5 loans at a time with the shared `Pagination` control and a year filter.

No schema change. The page already loads every loan for the participant (`sf_loans_v`). The plan adds one read of that participant's non-voided payments (for the per-loan payment list), a small pure helper module for ordering, due text, summary, year filter and 5-per-page paging, one new client component, and a one-field extension of the Add transaction dialog's initial values (amount prefill).

## Technical Context

**Language/Version**: TypeScript (strict), React 19 with Next.js App Router (modified Next; docs read from `node_modules/next/dist/docs/`)

**Primary Dependencies**: existing only: shadcn `base-nova` components in `components/ui/`, `lucide-react`, tokens from `app/globals.css`. No new libraries.

**Storage**: Supabase Postgres. Read-only: `sf_loans_v` (already read) and `sf_ledger_v` payment rows (new read). No migration, no RLS or function change.

**Testing**: Vitest (new unit tests for the loan helpers); Playwright mobile project in demo mode (updated `tests/e2e/sinking-fund.spec.ts`)

**Target Platform**: Mobile-first web (360 px minimum), light and dark theme, Cloudflare Workers build via vinext

**Project Type**: Single Next.js monolith

**Performance Goals**: A participant's loans and payments are small (tens), so all are loaded once and sorted, filtered and paged in the browser. Tab, expand and page changes are instant with no request.

**Constraints**: Money is integer centavos formatted only with `formatPesos`. No hex colors or arbitrary sizes in components. Status is never shown by color alone. Tap targets are 44 px (`touch-target`). No new animation library, and nothing animates width or height.

**Scale/Scope**: One section of one page: 1 new component, 1 new helper module, and edits to the participant page, loader, types, add-transaction dialog and tests.

## Constitution Check

*GATE: passes before Phase 0 and again after Phase 1.*

| Principle | Result |
|---|---|
| I. Free-tier sustainability | Pass. No new service or dependency. |
| II. Monolithic simplicity | Pass. A client component inside the existing app, no new infrastructure. |
| III. Data integrity and auditability | Pass. Read-only feature. Percent paid and balance are display math on existing integer-centavo fields. "Pay full balance" only prefills the form; the server still validates and writes. |
| IV. Mobile-first | Pass by design: compact rows at 360 px, no horizontal scroll, 44 px targets. Verified in the quickstart. |
| V. Compliance documents | Not applicable. |

No violations, so Complexity Tracking is empty.

## Project Structure

### Documentation (this feature)

```text
specs/022-participant-loans-redesign/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── loans-section.md
├── checklists/requirements.md
└── tasks.md          # created by /speckit-tasks
```

### Source Code (repository root)

```text
lib/sinking-fund/
├── types.ts                 # + SfLoanPayment
├── loan-list.ts             # NEW: pure helpers (order, due text, summary, years, 5-per-page paging)
├── queries.ts               # loadParticipantPage also returns the participant's payments
└── demo-data.ts             # Hugo Dela Cruz gets several open, overdue, paid and withdrawn loans (demo and e2e)

components/sinking-fund/
├── participant-loans.tsx    # NEW: tabs, rows, expanded detail, closed list and pagination
├── participant-page.tsx     # renders <ParticipantLoans/> in place of the card list
└── dialogs/add-transaction-dialog.tsx   # TransactionDialogInitial gains amountCentavos

tests/
├── unit/sinking-fund-loan-list.test.ts  # NEW
└── e2e/sinking-fund.spec.ts             # loan-card test replaced by loans-section tests
```

**Structure Decision**: Keep the loans UI in its own client component beside `participant-history.tsx` (same folder and pattern as feature 021). Put every rule that is not rendering into `lib/sinking-fund/loan-list.ts` so it is unit-testable without a browser.

## Complexity Tracking

None.
