# Validation: Documents Page Redesign

**Date**: 2026-11-02 to 2026-11-03 | **Branch**: `013-documents-page-redesign`

## Database (rolnet-dev, approved by the user on 2026-11-02)

- Migration `20261102000300_document_lifecycle_reverted.sql` was pushed first. Postgres can't use a
  new enum value in the transaction that adds it.
- Migration `20261102000400_document_versions.sql` was dry-run in front of every pgTAP file, each in
  one rolled-back transaction. The first run passed 51/56. The four user functions were security
  invoker and couldn't execute the ungranted private helpers (42501), and two fixtures needed fixes
  (`archived_at`, grants on test helper functions). After making the user functions security definer
  with `require_owner()`, the full suite passed **56/56**. The migration was then pushed.
- New files: `constraints/370_document_versions.sql` (20), `constraints/380_document_revert_restore.sql`
  (36), `rls/240_document_versions_rls.sql` (12). Updated: `constraints/050_documents.sql` (7-day
  buckets) and `rls/120_function_execute_rls.sql` (grant inventory).

## App checks

| Check | Result |
|-------|--------|
| `corepack pnpm lint` | 0 errors. 4 warnings, none in feature 013 files (`app/actions/auth.ts`, `components/forms/demo-login-form.tsx`, and the same two in a `.claude/worktrees` copy) |
| `corepack pnpm typecheck` | Pass |
| `corepack pnpm test` | 54 files, 374 tests pass, including the 100-unit / 400-document search timing (SC-005) |
| `corepack pnpm check` | Pass |
| `corepack pnpm build:vinext` | Build complete |
| Playwright, feature 013 (`documents-page`, `documents-modals`, updated `list-sort-filter`) on the demo build at 360 px | 22/22 pass |
| Playwright, full suite | 99 pass, 13 fail in the first run. The date rolled over to 2026-11-03 during the run, and a vinext build ran at the same time. After restarting the demo server, 6 of those pass and 7 still fail: login and public-page tests (`app-navigation` ×4, `accessibility-mobile`, `ui-system-refresh`) that expect a sign-in form or a "Demo mode:" hint the demo login page doesn't show, and one date-based units test. None of them touch files this feature changed. They were not rerun on `main` |

Demo screenshots (1440 px and 360 px) were checked for the tree, the details modal, and phone width.
Two fixes came from them: the header actions wrap under the title on phones, and History rows use a
short "View" button labelled with the file name.

## Still to do (T080)

- The quickstart walkthrough against live rolnet-dev data, at 1440 px and 360 px (quickstart.md steps
  1–13). It needs a signed-in owner on the :3000 dev server. The writes it exercises are already
  covered by pgTAP 370, 380 and 240.
- The retention job against a real deployment: set `CRON_SECRET` on the app and the `PURGE_URL` and
  `CRON_SECRET` repository secrets, then run the workflow once by hand (`workflow_dispatch`).
