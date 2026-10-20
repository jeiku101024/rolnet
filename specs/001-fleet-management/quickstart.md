# Quickstart and Validation Guide

This guide describes the expected setup and end-to-end validation workflow after implementation.
It does not replace the implementation tasks.

## Prerequisites

- Node.js 24 LTS and pnpm
- A Docker-compatible runtime for the local Supabase stack
- Supabase CLI available as a project development dependency
- A Cloudflare account with Workers enabled and Wrangler authentication
- A Supabase Free project for the deployed environment

## Local Setup

1. Install dependencies:

   ```powershell
   pnpm install
   ```

2. Copy the example environment file and provide local publishable values. Never put the Supabase
   secret key in a `NEXT_PUBLIC_*` variable.

   ```powershell
   Copy-Item .env.example .env.local
   ```

3. Start Supabase and rebuild it entirely from committed migrations and seed data:

   ```powershell
   pnpm exec supabase start
   pnpm exec supabase db reset
   ```

4. Generate database types after migrations:

   ```powershell
   pnpm exec supabase gen types --lang typescript --local
   ```

   Save the generated output to the implementation's documented database type file and commit it
   with the migration that changed the schema.

5. Run the regular Next.js development server for fast UI work:

   ```powershell
   pnpm dev
   ```

6. Run through the Workers-compatible vinext development path before integration testing:

   ```powershell
   pnpm exec vinext check
   pnpm dev:vinext
   ```

## Required Validation Commands

Run all gates before merging:

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm exec supabase test db
pnpm test:e2e
pnpm exec vinext check
pnpm build:vinext
```

Expected outcomes:

- no lint or TypeScript errors;
- all unit, component, RLS, constraint, integration, and end-to-end tests pass;
- vinext reports no blocking incompatibilities;
- the Workers production build succeeds within bundle limits;
- no test writes require manual Dashboard schema changes.

## End-to-End Acceptance Journeys

### 1. Owner setup and backup-driver coverage

1. Sign in as the seeded owner at a 360 px viewport.
2. Create an active unit and a primary driver with a valid license.
3. Assign the driver, record a day off, and assign a backup driver for that date.
4. Verify the unit shows the primary driver normally and the backup driver on the covered date.
5. Attempt conflicting backup coverage for the same driver/date and unit/date.

Expected: valid coverage succeeds, both conflicts fail with plain-language recovery guidance, and
history preserves both primary and backup responsibility.

### 2. Staff authorization

1. Self-register a staff account and verify it remains pending without data access.
2. As owner, approve the staff account; verify it can sign in and see operational unit/driver labels.
3. Record mileage, an expense, a part, a tire, and remittances/payments.
4. Edit remittance notes and add a payment; verify service date, assignment, disposition, and due stay locked.
5. Attempt to manage a unit, driver, assignment, document, user, setting, report, or deletion.

Expected: pending staff is denied; approved operational entries and note/payment edits succeed; every
owner-only UI and direct action/HTTP attempt is denied.

### 3. Remittance integrity

1. Record a returned-unit day and verify a due amount of 18,000 centavos (displayed as ₱180).
2. Record an overnight/overtime day and verify 30,000 centavos (displayed as ₱300 total).
3. Add partial and later payments; verify balance and credit calculations.
4. Retry both create requests with the same idempotency keys.
5. Attempt a second driver or unit remittance for the same date.

Expected: calculations are exact, retries return the existing result, and conflicting daily records
are rejected.

### 4. Receipt and document uploads

1. On a phone, select a large receipt photo.
2. Verify client-side processing targets 300 KB or less before direct private Storage upload.
3. Save another expense without a receipt and confirm the missing-receipt flag.
4. As owner, upload an image/PDF document; as staff, attempt to read its path or signed URL.

Expected: receipt flows succeed, oversized/unsupported files provide recovery guidance, private
objects are not publicly reachable, and staff cannot access compliance documents.

### 5. Expiry and maintenance dashboard

Create documents 31, 30, 7, 1, and 0 days from the fleet-local date plus parts/tires above and below
their date/mileage thresholds.

Expected: the owner dashboard has one Expiring Soon panel with correct 30-day, urgent 7-day, and
expired groups; due maintenance is exact; staff cannot access the panel; no email/SMS/push occurs.

### 6. Dashboard and CSV reconciliation

Seed at least two units with remittance payments, credits, and all expense categories for a month.
Open the monthly dashboard and export unit and fleet CSV files.

Expected: all dashboard and CSV centavo values match database fixtures exactly; the fleet total is
the sum of unit rows; empty months produce headers and zero totals; spreadsheet-special characters
are escaped correctly.

### 7. Soft deletion and audit

As owner, soft-delete an expense, confirm it disappears from current totals, and inspect the audit
view globally and from the expense record. As staff, attempt to read audit history and perform the same
mutation directly.

Expected: the owner's deletion is timestamped and auditable without removing history; staff is
denied from audit history and deletion; no application workflow issues a physical delete.

### 8. Acceptance performance and usability

Run the acceptance protocol with 10 non-technical participants at a 360 px viewport against the
preview deployment. Use a fixture containing 100 units and 24 months of records, time standard
expense entry and remittance payment, and measure selected-month dashboard response time.

Expected: at least 90% complete their authorized workflow unaided on the first try; practiced staff
entry stays under 90 seconds for an expense and 60 seconds for a remittance payment; the dashboard
appears within 3 seconds.

## Free-Tier Budget Checks

- Upload fixtures confirm normal compressed images are <=300 KB and hard limits reject larger files.
- Storage and database usage can be inspected by the owner or deployment operator before reaching
  80% of the 1 GB Storage or 500 MB database quotas.
- Workers preview/observability confirms representative SSR, Auth, action, and CSV requests remain
  inside the Free plan's CPU budget; static asset requests do not invoke unnecessary dynamic work.
- A documented encrypted logical database export is performed regularly because Free projects do
  not provide the same backup recovery features as paid plans.

## Migration and Deployment Validation

1. Create every schema change with `pnpm exec supabase migration new <name>`.
2. Run `pnpm exec supabase db reset` and the complete database tests from a clean state.
3. Preview the remote migration:

   ```powershell
   pnpm exec supabase db push --dry-run
   ```

4. After review and backup, apply migrations through the single controlled deployment path:

   ```powershell
   pnpm exec supabase db push
   ```

5. Build and deploy the Worker:

   ```powershell
   pnpm build:vinext
   pnpm dlx @vinext/cloudflare deploy
   ```

6. Run smoke tests against the deployed URL for login, owner/staff RLS, one mutation, one private
   upload/download, dashboard data, and CSV export.

If `vinext check`, the Workers build, or runtime smoke tests reveal a blocking adapter gap, stop the
release and execute the documented OpenNext fallback assessment. Do not silently fall back to a
static Pages export because it cannot preserve the required server behavior.
