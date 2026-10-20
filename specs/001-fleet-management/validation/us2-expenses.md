# US2 Expenses Validation

Date: 2026-10-20

## Completed implementation checks

- Expense categories, expenses, private receipt bucket, size/MIME constraints, and RLS migrations are present.
- pgTAP constraint/RLS test files are present.
- Client-side receipt compression targets 300 KB and rejects files above the 500 KB storage limit.
- Idempotent expense create/update, soft-delete, receipt preparation/finalization, and signed-upload
  helpers are implemented.
- Mobile expense form supports unit/category/date/peso amount/notes, optional receipts, compression
  progress, and a visible missing-receipt state.
- `corepack pnpm typecheck`: pass.
- `corepack pnpm lint`: pass.
- `corepack pnpm build:vinext`: pass; `/expenses` is included in the Workers bundle.

## Blocked end-to-end checkpoint

The database-backed scenario cannot run because Podman cannot initialize its Linux VM without WSL2,
and Docker Desktop is blocked by workstation policy. T054 remains unchecked until the local Supabase
stack can run.

Required follow-up:

```powershell
corepack pnpm exec supabase start
corepack pnpm exec supabase db reset
corepack pnpm exec supabase test db
```

Then verify staff can save all seeded categories, save an expense without a receipt, compress/upload a
large receipt, edit the expense, and receive denial for owner-only deletion or cross-expense storage access.
