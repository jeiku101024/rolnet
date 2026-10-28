# Phase 2 Foundation Validation

Original implementation: 2026-10-19. Checkpoint T026 completed: 2026-10-28.

## Implementation (2026-10-19)

- Foundation migrations 001-007 were created under `supabase/migrations/`.
- Supabase browser/server/middleware clients, approval-aware guards, auth actions/pages, result and
  same-origin utilities, centavo/date helpers, Zod common schemas, and mobile shell were implemented.
- pgTAP and Playwright foundation test files were written.
- `typecheck` and `lint` passed. The live Auth journey was blocked: no Docker/WSL2 runtime was
  available on the workstation, so `supabase start` and `supabase test db` could not run.

## T026 checkpoint (2026-10-28)

Runtime used instead of a local Docker stack:

- **Clean rebuild and pgTAP:** the CI `database` job (`.github/workflows/ci.yml`) runs
  `supabase start`, `supabase db reset` and `supabase test db` from committed migrations on every
  pull request and push to `main`.
- **Auth, approval and mobile shell:** the `rolnet-dev` Supabase Free project (Singapore), with all
  migrations applied by `supabase db push` and no Dashboard schema edits.

### Clean database reset and RLS tests

- `main` @ `268dce8`, [CI run 40660859489](https://github.com/jeiku101024/rolnet/actions/runs/40660859489):
  `Migrations and pgTAP (constraints + RLS)` **pass**, `Lint, typecheck, unit tests, Workers build` **pass**.
- All 24 pgTAP files pass (95 assertions at that commit), including `rls/001_foundation_rls.sql`
  (anon cannot read profiles or audit events) and `rls/120_function_execute_rls.sql`.

### Self-registration

- Creating auth users runs `handle_new_user()`, which created a `staff` / `pending` profile for each
  new account (three E2E accounts and the owner's own registration). **Pass**
- A pending user signing in through Supabase Auth sees 0 rows from `units` (RLS). **Pass**

### Approval and role checks

| Check | Result |
|---|---|
| Owner approves a pending staff account via `approve_staff_registration` | **Pass**: status `approved`, `approved_by` set, audit event written |
| Approved staff calls `require_owner()` | **Pass**: `42501 Owner access is required` |
| Pending staff calls `approve_staff_registration` on their own account | **Failed, then fixed.** It succeeded (in a rolled-back transaction) because `is_owner()` returned NULL for unapproved users. Fixed by `20261028000300_fix_owner_check_for_unapproved_users.sql` (#6). After the fix: HTTP 403 `Owner access is required` |
| Pending staff signs in through the app | **Failed, then fixed.** Sign-in succeeded and redirected to `/`. `signIn` now refuses pending, rejected and deactivated accounts, ends the session, and returns the status as the error code. After the fix: `/login?error=pending` |
| Owner and approved staff sign in through the app | **Pass**: owner reaches `/dashboard`, approved staff reaches `/expenses` |

### Mobile shell (Playwright, mobile project)

`tests/e2e/foundation-auth.spec.ts` against `next dev` (Next.js 16.4.3) in backend mode on
`rolnet-dev`, with E2E owner and staff credentials:

- `pending staff is blocked until owner approval`: **pass**
- `registration and forbidden owner navigation remain usable at 360px`: **pass**

## Follow-ups (not part of T026)

- The login page ignores `?error=`, so the user is redirected but sees no message. Display the
  `signIn` failure message there.
- After a successful sign-in the app redirects to `/`, which is still the static design specimen
  page. Redirect to the role's start page instead (feature 003, app navigation).

T026: **complete**, with PR #6 merged.
