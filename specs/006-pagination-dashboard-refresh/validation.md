# Validation: Paginated Lists and Dashboard Refresh

## Baseline (T001, 2026-10-30)

- Branch `006-pagination-dashboard-refresh` at `27e8ebb`, level with `origin/main`.
- `corepack pnpm lint`: 0 errors, 4 existing warnings.
- `corepack pnpm typecheck`: pass.
- `corepack pnpm test`: 16 files, 72 tests pass.
- Dev setup note: the owner's own `next dev` holds port 3000 (non-demo), and Next allows one dev
  server per folder, so demo checks use `NEXT_PUBLIC_DEMO_MODE=true next build` + `next start -p 3100`
  (`.claude/launch.json` "demo"). `vinext dev` returned 404 for every route, so it was not used.

## SC-004 baseline (T010)

- Old dashboard, demo mode with the T010 demo rows, 360 × 800 viewport:
  `document.scrollingElement.scrollHeight` = **4437 px**. Target after the redesign: ≤ 2662 px (60%).

## Results (T052, 2026-10-30)

| Check | Result |
|---|---|
| `corepack pnpm lint` | Pass: 0 errors, the same 4 existing warnings |
| `corepack pnpm typecheck` | Pass |
| `corepack pnpm test` | Pass: 20 files, 93 tests (was 16 files, 72 tests) |
| `corepack pnpm check` | 95% compatible, 0 issues (unchanged) |
| `supabase db reset && supabase test db` | **Not run**: local Supabase is down (Podman socket unreachable). No migration, policy or function changed in this feature. |
| Playwright, new specs (`paged-lists`, `dashboard-refresh`) against the demo build on :3100 | 12 of 12 pass (after the phone folds). |
| Playwright, full suite | Before the phone folds: 14 pass, 3 skipped, 7 fail (SC-004 plus the 6 below). After: re-ran the three affected files (`paged-lists`, `dashboard-refresh`, `ui-system-refresh`), 13 pass and only the existing "public workspace" test fails; the other existing failures were not re-run. The 6 existing failures are tests that need the backend sign-in form or a public "Sign in" link on `/` (`app-navigation` ×4, `accessibility-mobile`, `ui-system-refresh` "public workspace"). Their files and the nav/auth code are unchanged; in demo mode `/` always redirects to the dashboard. |

### Measurements (demo mode)

- **SC-004 (dashboard ≥ 40% shorter at 360 px)**: **met after the owner chose "hide more on
  phones".** First redesign: 4562 px (not met). With the charts and recent activity folded behind
  "Show" buttons on phones (`components/dashboard/phone-fold.tsx`), visually hidden panel
  descriptions on phones, and no repeated month label on the money tiles: **2546 px**, 43% shorter
  than the 4437 px baseline (target ≤ 2662 px). Wider screens are unchanged and show everything.
- **SC-003**: the first expiring document is above the fold at 360 × 800 (attention band starts at
  about 260 px), before any history panel. Met.
- **SC-007**: no horizontal page scroll at 360 px on the dashboard or the list pages checked
  (`/drivers`, `/remittances`). Met.
- Paging and search: bad page numbers clamp (`page=0`, `abc` → 1; `999` → last); search finds a
  driver who is only on page 2; no-match message and Clear search work; the search field sits
  more than 8 px above the table header; pagination controls are 44 px tall.
- **SC-001 / SC-002 timing on 1,000 seeded rows**: not run; needs the Supabase runtime.
- **Reports/CSV still return every record**: `lib/reports/*` and `app/api/reports/*` are unchanged
  and do not use the paging helpers; not re-run against a database.
- Usability check by a non-technical owner (SC-006): not done; needs the owner.

### Constitution compliance check

- **I. Free-Tier Sustainability**: pass. No new dependencies in `package.json`; no new services.
- **II. Monolithic Simplicity**: pass. All changes are inside the Next.js app.
- **III. Data Integrity and Auditability**: pass. Every new or changed query keeps
  `deleted_at is null` where the table has it; money is summed as integers (`monthTotals`,
  `dailyCollections`) and formatted only with `formatPesos`; dashboard totals come from
  `dashboard_monthly_unit_summary`, the same function as the monthly report; `supabase/migrations/`
  is unchanged.
- **IV. Mobile-First, Human-Centered Operations**: pass for layout, no sideways scroll and 44 px
  controls; plain-language empty and no-match messages. The owner usability check is still to do.
- **V. Compliance Document Lifecycle**: pass. Expired and soon-to-expire documents lead the
  dashboard with days remaining or overdue, and are counted in a headline figure.

### Deviations from the task text

- Detail-page lists (unit, driver, document, remittance, maintenance) page and search **in memory**
  with `pageRows`: their rows are already fully loaded for coverage logic. Top-level lists page in
  the database. The detail-page search specs were dropped from `lib/pagination/search-specs.ts`.
- `/documents` keeps its existing order (soonest expiry first) and groups by holder within each
  page, rather than ordering by holder.
- Payment history keeps its existing order (oldest first), per FR-006.
- The extradors and in-repair panels are in one file, `components/dashboard/fleet-status-panels.tsx`;
  `components/dashboard/dashboard-panel.tsx` holds the shared panel frame.
- Panels show 3 rows on phones and up to 5 from 48rem (`.panel-rows` in `app/globals.css`), matching
  the request for "3–5 records"; "View all N" appears whenever rows are hidden.
- The T011 "keep old panels during the transition" step was skipped: the dashboard was replaced in
  one change.
