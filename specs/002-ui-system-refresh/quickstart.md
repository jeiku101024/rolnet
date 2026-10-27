# Quickstart Validation: Fleet UI System Refresh

## Implementation validation note

The local Corepack pnpm cache is unavailable in the current environment, so equivalent repository-local binaries were used for TypeScript, Vitest, and Playwright checks. The browser review confirmed the dashboard glimpse regions, documents search, and client-side expiry state; the complete route-by-route desktop and 360-pixel review remains a release checklist item.

## Prerequisites

- Install dependencies with the repository’s existing package manager.
- Configure the existing Supabase/demo environment used by the project.
- Start the application with the existing development command.
- Use an owner account for dashboard, reports, documents, audit, and settings checks; use a staff account for permission checks.

## Automated checks

Run from the repository root:

```text
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm test
corepack pnpm test:e2e
```

Expected outcomes:

- Typecheck and lint complete without new errors.
- Existing unit/integration tests pass.
- Mobile E2E checks complete at the configured 360-pixel viewport.
- New UI acceptance coverage confirms shared shell, focus, touch targets, route composition, and dashboard glimpse behavior.

## Manual route review

At desktop width, review `/dashboard`, `/units`, `/drivers`, `/remittances`, `/expenses`, `/maintenance`, `/documents`, `/reports`, `/audit`, `/settings/staff`, `/login`, and `/register`, plus representative detail routes.

For every page, verify:

1. Title/context, navigation state, and primary action are immediately identifiable.
2. The main content is workspace-aligned and not only a centered stack of cards.
3. Tables/ledgers have readable headings, row separation, status labels, and record links.
4. Forms and detail views expose relationships, actions, and recovery guidance.
5. Typography has clear weight hierarchy, with aligned numeric data and preserved ROLNET colors.

## Dashboard review

As an owner, verify the monthly summary and attention panels still work, then verify recent-data glimpses for remittances, units, expenses, maintenance, documents, and drivers.

For each glimpse, confirm:

- Recent items show useful identity plus date/status/amount context.
- The section links to the correct full list or detail view.
- Empty sections explain what is absent and offer the next useful action when applicable.
- A simulated or observed failure in one section does not blank the rest of the dashboard.
- Staff/unauthorized users do not receive owner-only recent data or actions.

## Mobile and accessibility review

At 360×800:

1. Confirm no overall page-level horizontal scrolling.
2. Confirm a dense table uses a bounded scroll region or an intentional compact alternative.
3. Confirm primary actions and navigation controls remain at least 44 pixels high.
4. Navigate by keyboard and verify visible focus order.
5. Increase browser text size and verify labels, statuses, and error messages remain readable.
6. Confirm success, warning, danger, unpaid, missing-receipt, and expiry states communicate meaning with text/icon in addition to color.

## Acceptance evidence

Record the route list, viewport, account role, dataset used, test results, and screenshots or traces for any failure. Confirm no changes to permissions, money totals, expiry classification, audit history, or record lifecycle.
