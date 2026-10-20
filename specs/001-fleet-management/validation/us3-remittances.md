# US3 Remittances Validation

Date: 2026-10-20

## Completed implementation checks

- Remittance and payment migrations enforce daily uniqueness, assignment/date checks, fixed 18,000 or
  30,000 centavo due amounts, positive payments, and idempotency keys.
- RLS and pgTAP test files are present.
- Staff note edits/payment additions and owner reversal actions are implemented.
- Mobile daily form supports returned/overnight selection, computed rates, optional payment, and duplicate-submit protection.
- Remittance history/detail views show due, paid, balance, credit, and payment history.
- `corepack pnpm typecheck`: pass.
- `corepack pnpm lint`: pass.
- `corepack pnpm build:vinext`: pass; remittance routes are included in the Workers bundle.

## Blocked end-to-end checkpoint

The database-backed scenario cannot run because Podman cannot initialize its Linux VM without WSL2,
and Docker Desktop is blocked by workstation policy. T065 remains unchecked until the local Supabase
stack can run.

Required follow-up:

```powershell
corepack pnpm exec supabase start
corepack pnpm exec supabase db reset
corepack pnpm exec supabase test db
```

Then verify returned-day ₱180, overnight/overtime ₱300, partial/full/unpaid/overpayment cases,
idempotent retries, primary/backup assignment resolution, staff field locking, and owner reversal.
