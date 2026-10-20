# US1 Units and Drivers Validation

Date: 2026-10-20

## Completed implementation checks

- Units, drivers, primary/backup assignments, day-off records, and mileage migrations are present.
- RLS migrations and pgTAP test files are present.
- Owner actions, approval-aware permission guards, validation schemas, mobile forms, list/detail pages,
  and assignment history views are implemented.
- `corepack pnpm typecheck`: pass.
- `corepack pnpm lint`: pass.
- `corepack pnpm build:vinext`: pass; US1 routes included in the Workers bundle.

## Blocked end-to-end checkpoint

The database-backed scenario cannot run because Podman cannot initialize its Linux VM without WSL2,
and Docker Desktop is blocked by workstation policy. T043 remains unchecked until the local Supabase
stack can run.

Required follow-up:

```powershell
corepack pnpm exec supabase start
corepack pnpm exec supabase db reset
corepack pnpm exec supabase test db
corepack pnpm test:e2e -- tests/e2e/foundation-auth.spec.ts
```

Then run the US1 scenario: create two units, two primary drivers, one backup driver, record a day off,
assign backup coverage, inspect both histories, and verify expired-license and same-date conflicts.
