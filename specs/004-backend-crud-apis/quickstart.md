# Quickstart and Validation Guide: Backend CRUD APIs

This guide validates the finished feature. It complements [the HTTP contract](./contracts/http-api.md)
and [the data model](./data-model.md); it does not contain implementation code.

## Prerequisites

- Node.js 24 LTS with Corepack-enabled pnpm matching `package.json`
- A local Supabase-compatible runtime and project CLI
- Local environment values for the existing Supabase URL and publishable key
- Seeded owner, approved staff, pending staff, and deactivated staff test identities

## Local Setup

```powershell
corepack enable
pnpm install
pnpm exec supabase start
pnpm exec supabase db reset
pnpm exec supabase gen types --lang typescript --local
```

Save generated schema types to `types/database.ts`, then start the application:

```powershell
pnpm dev
```

Use the existing browser login flow to obtain session cookies for manual API requests. Never place
service-role credentials in the browser or test client.

## Automated Gates

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm exec supabase test db
pnpm test:e2e
pnpm exec vinext check
pnpm build:vinext
```

Expected: all commands pass, migrations rebuild a clean database, generated types cover every
table/function, and the Workers-compatible build reports no blocking Route Handler issue.

## Contract Validation

### 1. Authentication and DTO boundaries

For one list and mutation in every resource group, test signed-out, pending, deactivated, approved
staff, and owner sessions.

Expected: signed-out is 401; non-approved and forbidden roles are 403; inaccessible records do not
leak through errors; owner/staff DTOs contain only contract fields; no private object path appears.

### 2. Collection behavior

Seed more than 25 records with duplicate primary sort values. Request pages 1 and 2, change allowed
filters/order/includes, and submit unsupported parameters.

Expected: the default and maximum sizes are enforced, primary-key tie-breaking prevents duplicates,
metadata is accurate, allowed filters work, and unknown fields produce `INVALID_QUERY`.

### 3. CRUD matrix

Exercise every operation in the specification's 15-entity lifecycle matrix. For ordinary CRUD
resources: create, list, read, patch with ETag, soft-delete, read current list, read owner history,
and restore. Exercise named state transitions for profiles, settings, remittances/payments,
documents, tires, and audit events.

Expected: all allowed operations match the contract; immutable/unsupported methods are rejected;
deleted records leave current views/totals but remain recoverable and auditable.

### 4. Concurrency

Read a mutable item and retain its ETag. Update it once, then repeat an update and a delete using the
old ETag. Also omit `If-Match` once.

Expected: the first update succeeds; stale requests return 409 with the current permitted DTO; the
missing precondition returns 428; no newer data is overwritten.

### 5. Idempotency

Repeat remittance, payment, expense, receipt-finalization, and document-finalization requests using
the same UUID `Idempotency-Key`. Then reuse one key with changed content.

Expected: equivalent retries return the original logical result; changed content returns 409; each
database identity, financial amount, and attachment exists once.

### 6. Transaction failures

Force the final step of backup assignment, tire replacement, document renewal, driver-license
synchronization, payment correction, remittance restoration, and upload finalization to violate a
constraint.

Expected: every related table remains unchanged. No partial supersession, replacement, balance,
license, assignment, or attachment state is visible.

### 7. Money and reconciliation

Create returned and overtime remittances, partial/overpayments, expenses, part costs, and tire costs.
Run deletion, restoration, reversal, correction, and retry flows.

Expected: all inputs/outputs are integer centavos; fractions and prohibited negatives fail; source
records, dashboard values, and monthly CSV totals reconcile exactly after every transition.

### 8. Mileage and maintenance

Create ordered mileage readings, attempt a decreasing middle reading, edit/delete/restore the latest
reading, and replace tires in every position.

Expected: invalid sequences fail; unit current mileage is recalculated rather than left stale;
maintenance due state follows the current value; tire replacement leaves one current tire and full
history.

### 9. Documents and private files

Prepare/finalize valid and invalid receipt images and compliance files. Renew each document type,
including a driver license, then try as staff to list documents or obtain a signed URL.

Expected: limits/MIME/checksum/holder rules are enforced; renewals are atomic; profile and license
expiry agree; previous documents are superseded; staff receives no document data or private path.

### 10. Audit completeness

Perform insert, update, soft-delete, restore, reverse, correction, renewal, and replacement actions
across all business tables, then query global and per-entity audit history as owner and staff.

Expected: owner sees one sanitized, actor-attributed trail in chronological order; staff is denied;
checksums, private paths, tokens, and unrelated protected values are absent.

## Performance and Mobile Acceptance

Load 100 units with 24 months of representative records. Measure each default collection and item
read through the consuming screen and API integration harness.

Expected: at least 95% become available within one second and all within three seconds. Dynamic
request CPU remains inside the project's established Workers free-tier budget.

At a 360 px viewport, have 10 non-technical participants complete one permitted create and update,
trigger a field error, recover from a stale edit, and observe a denied action.

Expected: at least 9 finish authorized work without developer help; all recovery messages are plain
language; no flow requires horizontal scrolling.

## Migration and Release Check

1. Rebuild locally from all ordered migrations and run constraint/RLS tests.
2. Confirm new columns/functions/indexes preserve seeded and representative legacy data.
3. Verify generated database types and HTTP DTO types compile without casts that bypass validation.
4. Preview remote changes with `pnpm exec supabase db push --dry-run` after an approved backup.
5. Run vinext checks/build and smoke-test owner/staff API access on the preview deployment.
6. Apply through the controlled migration/deployment path only; do not edit production tables from
   the dashboard.
