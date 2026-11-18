# Quickstart: Dashboard Refinements

Prerequisites: `corepack pnpm install`. Demo mode (`NEXT_PUBLIC_DEMO_MODE=true`) needs no database.

## Automated

```powershell
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm test:e2e -g "dashboard"
```

Expected: all pass. `tests/unit/dashboard-ordering.test.ts` covers loan grouping, order, the overdue flag, and exclusion of paid and withdrawn loans. `tests/e2e/dashboard-refinements.spec.ts` covers the scenarios below.

## Manual scenarios (see [spec.md](spec.md))

1. **Equal height**: open `/dashboard` at about 1280 px wide. Daily collections and Collected vs expenses share top and bottom edges (US1).
2. **Pop-up**: click "Show all N units". A dialog lists every unit; page height is unchanged before and after; Escape, X and outside click close it with no network request (US2).
3. **Third card**: Needs attention shows three cards; the loans card lists borrowers largest first with "Overdue" where applicable; the empty state reads "No unpaid loans." (US3).
4. **360 px**: cards stack, the dialog fits, no sideways scroll.

Live data uses `sf_loans_v` under the owner's session; verify against rolnet-dev only with the owner's go-ahead.
