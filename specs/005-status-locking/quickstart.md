# Quickstart: Validating status toggles and edit locking

## Prerequisites

- The repository set up as in `docs/DEVELOPMENT.md`, with Supabase running locally (or rolnet-dev
  linked).
- Accounts: one approved owner and one approved staff user.
- Data: one unit with a current primary assignment, one unit without one, and one driver with no
  assignment.

## Automated checks

```bash
corepack pnpm exec supabase db reset
```

```bash
corepack pnpm exec supabase test db
```

```bash
corepack pnpm lint
```

```bash
corepack pnpm typecheck
```

```bash
corepack pnpm test
```

Expected results:
- `supabase/tests/constraints/250_status_locking.sql` passes.
- Every other pgTAP, lint, typecheck and Vitest check stays green.

## Manual or journey checks (360 × 800 viewport, owner)

Rules are in [data-model.md](data-model.md); UI and action behaviour is in
[contracts/status-actions.md](contracts/status-actions.md).

| # | Steps | Expected |
|---|---|---|
| 1 | `/units`: set an Active unit to In repair in its Status dropdown, then reload | Row shows In repair; no horizontal scroll |
| 2 | Open that unit | Details read-only, locked notice shown, no edit form; status history lists Active → In repair with owner and time |
| 3 | On that unit, record a mileage reading, a maintenance entry and an expense | All three saved; current mileage updates |
| 4 | Send a direct REST `PATCH` of `make_model` for that unit with the owner JWT | Refused (`23514`); value unchanged |
| 5 | Set the unit back to Active on its page | Edit form appears without a reload; editing the make/model saves |
| 6 | `/drivers`: set the driver with no assignment to Inactive | Saved; detail page locked; status history updated |
| 7 | Set the driver who has a current assignment to Inactive | Refused with the "End or remove them" message; dropdown back to Active |
| 8 | Try to assign the Inactive driver to a unit (REST insert) | Refused, as today |
| 9 | Renew the Inactive driver's license document | Renewal saved; the driver's expiry updates even though the driver is locked |
| 10 | Pick the current status again in a dropdown | Nothing saved; no new status history entry |
| 11 | Open the same unit in two tabs; change the status in tab A, then in tab B | Tab B refused with "changed by someone else", showing the current status |
| 12 | As staff, open `/units` and `/drivers`, then send a REST `PATCH` of `status` | Statuses shown as read-only badges with no dropdown; REST update changes no row |
