# Quickstart Validation: App Navigation and Menu

## Prerequisites

- Install dependencies with the repository's declared pnpm version.
- Configure the existing demo mode or Supabase environment.
- Use an owner account for the full menu and a staff account for access-filtering checks.
- Start the application with the existing development command if Playwright is not starting it automatically.

## Automated checks

Run from the repository root:

```text
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm test
corepack pnpm test:e2e
```

Expected outcomes:

- TypeScript and lint complete without new errors.
- Unit tests prove owner/staff/unapproved filtering, group omission, exact matching, detail-route matching, and false-prefix rejection.
- E2E tests prove public navigation, authenticated menu behavior, active state, mobile dismissal/focus, and logout.
- Existing authentication, UI refresh, and mobile accessibility suites remain green.

## Registry and permission validation

Verify the destination table in [data-model.md](./data-model.md) against the actual page guards:

1. Owner receives all ten destinations in the specified group/order.
2. Staff receives Units, Drivers, Remittances, Expenses, and Maintenance only.
3. Pending, rejected, deactivated, and missing profiles receive no protected destinations.
4. Hiding a destination does not alter the result of a direct protected request.

## Desktop validation

At a representative desktop viewport, sign in as an owner and verify:

1. The sidebar is visible on initial load and does not cover the page workspace.
2. Group order is Overview, Fleet, Operations, Administration.
3. Every item has the expected Lucide icon and visible text label.
4. Selecting every item reaches the existing route.
5. The active item is visually distinct and reports `aria-current="page"`.
6. The footer identifies the user and role and separates Logout from navigation.
7. Keyboard focus follows a logical order and remains visible.

Repeat as staff and verify only the five destinations authorized by current guards appear.

## Detail-route validation

Visit representative existing records and verify parent activation:

- `/units/{id}` -> Units
- `/drivers/{id}` -> Drivers
- `/remittances/{id}` -> Remittances
- `/maintenance/{unitId}` -> Maintenance
- `/documents/{id}` -> Documents (owner only)

Also test a nonmatching prefix such as `/units-archive` in the pure matcher and confirm Units is not active.

## Mobile and accessibility validation

At `320x800`:

1. Confirm the menu begins closed and the labeled trigger is at least 44 pixels in both touch dimensions.
2. Open by touch and by keyboard; confirm the surface has an accessible name and predictable initial focus.
3. Reach every authorized destination and Logout without horizontal scrolling or clipped labels.
4. Dismiss with the close control and Escape; confirm focus returns to the trigger.
5. Reopen, choose a destination, and confirm the menu closes and the correct parent item becomes active.
6. Increase text size/spacing and confirm group labels, page labels, account identity, and Logout remain readable.
7. Inspect with a screen reader or accessibility tree and confirm icons are not redundantly announced and the current item is conveyed.

## Public/auth validation

While signed out, review `/`, `/login`, and `/register`:

1. Sign in and Register remain discoverable where appropriate.
2. No protected fleet destination or Logout is presented.
3. The public navigation fits at 320 pixels without page-wide horizontal scrolling.
4. Existing form headings, labels, and primary actions remain usable.

## Logout validation

1. From desktop and mobile authenticated navigation, activate Logout and confirm a pending state prevents repeated activation.
2. On success, confirm the browser reaches `/login` and a direct request for `/dashboard` requires authentication.
3. Simulate or unit-test a provider sign-out error and confirm a plain-language message says the session may still be active and permits retry.
4. Expire the session before activation and confirm Logout still resolves to `/login` without protected content.

## Acceptance evidence

Record the commit, environment mode, account role/status, viewport, destination list, automated results, and any Playwright trace or screenshot for failures. Confirm there were no schema changes, permission expansions, new paid services, or changes to business-record lifecycle behavior.

