# Tasks: Paginated Lists and Dashboard Refresh

**Input**: Design documents from `specs/006-pagination-dashboard-refresh/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/list-paging.md](contracts/list-paging.md),
[contracts/dashboard.md](contracts/dashboard.md), [quickstart.md](quickstart.md)

**Tests**: Included where the project rules require them:
- The definition of done in CLAUDE.md requires lint, typecheck and Vitest to pass.
- The constitution requires a 360 px acceptance run, so there are Playwright checks.
- There is no migration, so no pgTAP work is needed. `supabase test db` must still pass unchanged.

**Organization**: Tasks are grouped by user story. The paging and search helpers, the shared
`Pagination` and `ListSearch` components, the `DataTable` toolbar, and the dashboard skeleton
are foundational, because every story uses them.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on unfinished tasks)
- **[Story]**: The user story the task belongs to (US1–US7)

## Path Conventions

Single Next.js app at the repository root: `app/`, `components/`, `lib/`, `tests/`. Before
writing page code, read `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md`
(`searchParams` is a Promise) and `.../04-functions/use-router.md` (`router.replace`) per AGENTS.md.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm the starting point. No new dependencies are needed.

- [X] T001 Confirm that branch `006-pagination-dashboard-refresh` is up to date with `origin/main` and that `corepack pnpm lint`, `corepack pnpm typecheck` and `corepack pnpm test` pass before any change; record the baseline at the top of a new `specs/006-pagination-dashboard-refresh/validation.md` (T052 adds the results)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The paging and search building blocks every list uses, plus the dashboard skeleton

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T002 [P] Create `lib/pagination/list-page.ts`: `pageSize = 10` (fixed, per clarification Q2); `parseListPage(searchParams, prefix = "")` reads `${prefix}page` and `${prefix}q` ("integer ≥ 1, otherwise 1"; `q` "trimmed, max 100 chars; `""` = no search"); returns `{ prefix, page, q, from, to }` with `from = (page − 1) × 10` and `to = from + 9`; `finishListPage(total, page)` returns `{ page: min(requested, lastPage), lastPage: max(1, ceil(total / 10)), rangeLabel }` with labels exactly `"11–20 of 87 records"`, `"1–1 of 1 record"` and `"0 records"` (en dash); `listHref(searchParams, changes)` builds a URL that keeps other params, drops `page=1` and empty `q`, and drops `${prefix}page` whenever `${prefix}q` changes; `pageRows(rows, request, textOf)` gives demo mode in-memory paging and search with the same rules
- [X] T003 [P] Create `lib/pagination/search-filter.ts` per research R4: `cleanSearch(q)` strips or escapes the PostgREST reserved characters `,` `(` `)` `*` `%` `\`; `buildSearchFilter(spec, q, relatedIds)` returns one `.or()` string that combines `col.ilike.*q*` for each own text column, `foreignKey.in.(ids)` for related matches, and `col.in.(values)` for enum columns whose display label matches `q` (document type, unit status, driver kind, disposition, audit `action`); it also matches a date column when `q` looks like `YYYY-MM` or `YYYY-MM-DD`, and an amount column (centavos via `lib/money/centavos.ts`) when `q` parses as pesos; `findRelatedIds(supabase, related, q)` runs the small id pre-queries (`units.body_number`, `drivers.full_name`, `expense_categories.name`), always with `deleted_at is null`
- [X] T004 [P] Unit tests for T002 in `tests/unit/list-page.test.ts`: `page` values `0`, `-2`, `abc`, `2.5` and missing → 1; `q` of spaces → `""`; `q` over 100 chars is cut; range labels for totals 0, 1, 10, 11 and 87; clamping when `page > lastPage`; `listHref` keeps other lists' prefixed params and drops `page` when `q` changes; `pageRows` slices and filters
- [X] T005 [P] Unit tests for T003 in `tests/unit/search-filter.test.ts`: reserved characters cannot break out of the `.or()` string; enum label matching (`"repair"` → `status.in.(in_repair)`, `"backup"` → `driver_kind.in.(backup)`); date and peso detection; an empty `relatedIds` list adds no `in.()` term
- [X] T006 Create `components/ui/pagination.tsx` (server component) per contracts/list-paging.md: `<nav aria-label="Pagination">` with First, Previous, "Page x of y", Next and Last as `next/link` links built with `listHref`; controls that cannot be used render as non-interactive `aria-disabled` text; the range label sits beside them; the component is hidden when `lastPage = 1`; every control meets the `touch-target` minimum height and the row wraps at 360 px; existing tokens only, no hex colours or arbitrary sizes
- [X] T007 Create `components/ui/list-search.tsx` (client component), replacing `components/ui/table-search.tsx`: a leading lucide `Search` icon with `aria-hidden`, a `sr-only` label, an input of `type="search"` with left padding for the icon, and the existing "Clear" button when text is present; it updates `${prefix}q` with `router.replace(href, { scroll: false })` after about 300 ms without typing or on Enter, and removes `${prefix}page`; its initial value comes from the current URL
- [X] T008 Update `components/ui/data-table.tsx` per research R6: add optional `toolbar` and `pagination` slots; when a list passes no `toolbar`, keep rendering the existing `TableSearch` (inside the new spaced toolbar row) so every list keeps working search until T026/T028 switch it to `ListSearch` (T029 then removes the fallback); the toolbar row holds the search on the left and the "N records" count on the right, has its own vertical padding and a bottom rule, and leaves space above the table header so the first rule never touches the search field (fixes FR-011); add a `searchEmpty` state with the text `No records match "{q}".` and a "Clear search" link; keep the existing `empty` text when no search is active
- [X] T009 Create `components/ui/paged-list.tsx`, a wrapper for `<ul>`-based lists (`DocumentList`, `PartsList`, tire history, mileage readings, payment history, `AuditHistory`) that gives them the same toolbar, search-empty state and pagination footer as T008 (research R5)
- [X] T010 Add demo rows to `lib/demo/mode.ts` so paging and every dashboard panel show something in demo mode: at least 25 remittances across 3 units, at least 12 drivers including 3 active backup drivers (one with an assignment today), 2 units with `status: "in_repair"`, documents expiring at −3, 2, 10 and 25 days from `fleetToday()`, and at least 6 due maintenance items; keep the existing ids unchanged; then, before T011 changes the dashboard, measure the old dashboard's full page height at a 360 px viewport in demo mode with these rows (`document.documentElement.scrollHeight`) and record it in `specs/006-pagination-dashboard-refresh/validation.md` as the SC-004 baseline
- [X] T011 Create the dashboard skeleton in `app/(owner)/dashboard/page.tsx`: four labelled `<section>` bands in the order "Needs attention" → "Fleet status" → "This month" → "Recent activity" (contracts/dashboard.md), each with a heading and an empty placeholder slot that US3–US7 fill; keep the existing `requirePermission("view_dashboard")`, `connection()` and `Suspense` fallback; keep the old panels rendering inside the bands until their story replaces them, so the page never loses information mid-feature

**Checkpoint**: The helpers have tests, the shared components exist, and every page still works unchanged

---

## Phase 3: User Story 1 - Browse long lists one page at a time (Priority: P1) 🎯 MVP

**Goal**: Every list in the contracts/list-paging.md page inventory shows 10 rows with First/Previous/Next/Last controls and a range label

**Independent Test**: Open a list with more than 10 records, step through the pages, check the range label and the disabled controls, refresh, and press Back from a detail page (quickstart scenarios 1–3, 7 and 8)

- [X] T012 [US1] Page `/units` in `app/(owner)/units/page.tsx`: accept `searchParams`, use `parseListPage`, query with `{ count: "exact" }` plus `.range(from, to)` in the existing order, re-read at `lastPage` when the requested page is past the end (research R3), and render `Pagination` in the `DataTable` `pagination` slot; in demo mode use `pageRows`
- [X] T013 [P] [US1] Page `/drivers` in `app/(owner)/drivers/page.tsx` the same way as T012; owners' `StatusSelect` dropdowns must keep working on every page
- [X] T014 [P] [US1] Page `/remittances` in `app/(operations)/remittances/page.tsx`; remove the `.limit(50)` cap; the open-assignments query for the form stays unpaged
- [X] T015 [P] [US1] Page `/expenses` in `app/(operations)/expenses/page.tsx`, keeping the existing filters in the URL alongside `page`
- [X] T016 [P] [US1] Page the unit list on `/maintenance` in `app/(operations)/maintenance/page.tsx`
- [X] T017 [P] [US1] Page `/documents` in `app/(owner)/documents/page.tsx`: take the slice over documents ordered by holder, then type, and draw group headings only for the holders on the current page (research R5); use `PagedList`
- [X] T018 [P] [US1] Page `/audit`: change `getAuditEvents` in `lib/audit/queries.ts` to take `{ from, to }` and return `{ rows, total }`, removing the `.limit(100)` cap; update `app/(owner)/audit/page.tsx` and wrap `components/audit/audit-history.tsx` in `PagedList`
- [X] T019 [P] [US1] Page `/settings/staff` in `app/(owner)/settings/staff/page.tsx`
- [X] T020 [P] [US1] Page the detail-page lists of `app/(owner)/units/[id]/page.tsx` with their own prefixes: assignment history `assignments_`, days off and backup coverage `daysoff_` (remove the `.limit(30)` cap), documents `documents_`; paging one list must not change the others
- [X] T021 [P] [US1] Page the detail-page lists of `app/(owner)/drivers/[id]/page.tsx`: primary assignments `assignments_`, backup coverage `backup_`, days off `daysoff_` (remove the `.limit(30)` cap), license documents `documents_`
- [X] T022 [P] [US1] Page the history list of `app/(owner)/documents/[id]/page.tsx` with prefix `history_`, and the payment history of `app/(operations)/remittances/[id]/page.tsx` with prefix `payments_`
- [X] T023 [P] [US1] Page the parts (`parts_`), tire history (`tires_`) and mileage readings (`mileage_`, remove the `.limit(10)` cap) lists of `app/(operations)/maintenance/[unitId]/page.tsx`; leave "Current tires" unpaged; use `PagedList` with `components/maintenance/parts-list.tsx`
- [X] T024 [US1] Playwright test `tests/e2e/paged-lists.spec.ts` (demo mode, 360 px and desktop): `/remittances` shows 10 rows and "1–10 of N records"; First and Previous are disabled on page 1; Last goes to the last page; refresh and Back keep the page; `?page=0`, `?page=abc` and `?page=999` resolve to page 1, page 1 and the last page; no horizontal page scroll at 360 px

**Checkpoint**: Every list pages correctly; search still uses the old row-hiding behaviour (current page only) through the T008 fallback until US2

---

## Phase 4: User Story 2 - Search across all records, with a clear search field (Priority: P1)

**Goal**: Search covers every record of a list through the URL, resets to page 1, and the field has an icon and proper spacing

**Independent Test**: On a multi-page list, search for a value that only exists on a later page; check the filtered count, the reset to page 1, the no-match message, the icon, the Clear button, and the gap above the table rule (quickstart scenarios 4–6)

- [X] T025 [US2] Add a `SearchSpec` per list in `lib/pagination/search-specs.ts`, following the "Search covers" column of contracts/list-paging.md (for example remittances: own column `notes`, related `units.body_number → unit_id` and `drivers.full_name → driver_id`, date `service_date`, enum `disposition`; units: `body_number`, `plate_number`, `make_model`, enum `status`; audit: own column `entity_type`, enum `action`)
- [X] T026 [US2] Apply search on the top-level lists (`app/(owner)/units/page.tsx`, `app/(owner)/drivers/page.tsx`, `app/(operations)/remittances/page.tsx`, `app/(operations)/expenses/page.tsx`, `app/(operations)/maintenance/page.tsx`, `app/(owner)/documents/page.tsx`, `app/(owner)/audit/page.tsx`, `app/(owner)/settings/staff/page.tsx`): run `findRelatedIds`, then `.or(buildSearchFilter(...))` on both the count query and the slice query; render `ListSearch` in the `DataTable` / `PagedList` toolbar with the search-empty state
- [X] T027 [US2] Add the fixed filters that the dashboard "View all" links target, each kept in paging links and shown as a removable note above the list: `?kind=backup` on `/drivers` (`.eq("driver_kind", "backup")`, "Showing backup drivers"); `?status=in_repair` on `/units` (`.eq("status", "in_repair")`, "Showing units in repair"); `?due=1` on `/maintenance` (`.in("id", unitIds)` with the unit ids from `due_maintenance(fleetToday())`, "Showing units with maintenance due"); `?balance=unpaid` on `/remittances` (`.in("id", ids)` with the remittance ids from the `unpaid_remittances` of `driver_outstanding_balances(fleetToday())`, "Showing remittances with an unpaid balance"); `?expiring=1` on `/documents` (`.in("id", ids)` with the ids from `expiring_documents(fleetToday())`, "Showing documents expired or expiring within 30 days"); an empty id list shows the list's empty state, not every row; the `due`, `balance` and `expiring` filters are owner-only because those RPCs return rows only for owners (`is_owner()`), so staff see the unfiltered list without the note
- [X] T028 [US2] Apply prefixed search to the detail-page lists whose "Search covers" column in contracts/list-paging.md is not "—" (`app/(owner)/units/[id]/page.tsx`, `app/(owner)/drivers/[id]/page.tsx`, `app/(owner)/documents/[id]/page.tsx`, `app/(operations)/remittances/[id]/page.tsx`, `app/(operations)/maintenance/[unitId]/page.tsx`)
- [X] T029 [US2] Remove the `TableSearch` fallback from `components/ui/data-table.tsx` and `components/ui/paged-list.tsx`, then delete `components/ui/table-search.tsx` and its `.data-region` lookup once nothing imports it; remove any `searchable` prop uses left over
- [X] T030 [US2] Extend `tests/e2e/paged-lists.spec.ts`: a driver name that only appears on a later remittance page is found from page 1; the URL has `q=` and no `page=`; `zzzz` shows the no-match message and Clear search; the search icon is visible; the search input's bounding box does not overlap the table header row; a status dropdown on drivers page 2 still saves

**Checkpoint**: US1 + US2 make up the shippable MVP for lists

---

## Phase 5: User Story 3 - See what needs attention first on the dashboard (Priority: P1)

**Goal**: The "Needs attention" band shows expiring documents, due maintenance and unpaid balances, sorted by urgency, at most 5 each, with "View all N"

**Independent Test**: With documents at −3, 2, 10 and 25 days and 12 due maintenance items, the dashboard shows the expired document first, then by date, 5 maintenance rows, and "View all 12" (quickstart scenario 9)

- [X] T031 [P] [US3] Create `lib/dashboard/ordering.ts` per data-model.md: `orderExpiringDocuments` ("Order: `expiresOn` ascending", `daysUntil` negative = overdue); `orderDueMaintenance` with `kmPerDayEquivalent = 100` and "`urgency = max(daysPastDue, kmPastDue / kmPerDayEquivalent)`", "Order: `urgency` descending, then `bodyNumber`"; `orderUnpaidBalances` ("Order: `outstandingCentavos` descending, then `firstUnpaidServiceDate` ascending"); `toPanel(items, href)` → `{ items: first 5, total, href }`; plain-language labels "Expired N days ago" / "Expires today" / "Expires in N days" and "N days overdue" / "N km past due"
- [X] T032 [P] [US3] Unit tests in `tests/unit/dashboard-ordering.test.ts` for T031: the acceptance example (−3, 2, 10, 25 days); a mileage-only item 500 km past due ranks above a date item 3 days overdue; balance ties broken by the oldest unpaid date; `toPanel` totals; singular and plural labels
- [X] T033 [US3] In `lib/dashboard/queries.ts`, return `attention: { documents, maintenance, balances }` panels using T031; add `holderLabel` to expiring documents (body number or driver name from one `units`/`drivers` lookup); keep the existing `describeDueItems`; give demo mode the same shape from T010's data
- [X] T034 [US3] Create `components/dashboard/attention-panels.tsx`: three `Card` panels following the contracts/dashboard.md panel table (row text, row link, "View all {total}" footer when `total > 5`, the exact empty messages "No documents expire in the next 30 days.", "No maintenance is due." and "Every driver is paid up."); status shown with icon, text and colour; replaces `components/dashboard/expiring-soon-panel.tsx`, `due-maintenance-panel.tsx` and `unpaid-balances-panel.tsx`, which are deleted
- [X] T035 [US3] Render `AttentionPanels` in the "Needs attention" band of `app/(owner)/dashboard/page.tsx` and remove the old three panels

**Checkpoint**: The top of the dashboard shows what needs action, in urgency order

---

## Phase 6: User Story 4 - Know which extradors are working and which units are in repair (Priority: P2)

**Goal**: The "Fleet status" band shows active extradors with today's unit and the units in repair, and the recent drivers and recent units panels are gone

**Independent Test**: With 3 active backup drivers (one assigned to a unit today), 2 units in repair and 1 retired unit, the panels list exactly those, in the specified order, with links (quickstart scenario 10)

- [X] T036 [US4] In `lib/dashboard/queries.ts`, add `extradors` per research R8 and data-model.md `ExtradorItem`: `drivers` with `driver_kind = 'backup'`, `is_active` and `deleted_at is null`, joined to non-deleted `driver_assignments` that cover `fleetToday()` (a backup row with `starts_on = today`, or a primary row with `ends_on is null`); when a driver has both, show today's backup assignment, because that is the unit they are driving today; "Order: assigned first, then name"; return a panel with `href: "/drivers?kind=backup"`
- [X] T037 [US4] In `lib/dashboard/queries.ts`, add `inRepair` per data-model.md `InRepairUnitItem`: `units` with `status = 'in_repair'` and `deleted_at is null`; `inRepairSince` = the latest `audit_events.occurred_at` for that unit where `changed_fields->after->>status = 'in_repair'` (one query with `.in("entity_id", ids)`); `daysInRepair` from `fleetToday()`; "Order: `inRepairSince` ascending, nulls last"; `href: "/units?status=in_repair"`
- [X] T038 [P] [US4] Create `components/dashboard/extradors-panel.tsx` (name, phone, "Body X today" or "Not assigned", link to `/drivers/[id]`, empty message "No active extradors.") and `components/dashboard/in-repair-panel.tsx` (Body X, plate, "In repair for N days" or "In repair", link to `/units/[id]`, empty message "No units are in repair.")
- [X] T039 [US4] Render both panels in the "Fleet status" band of `app/(owner)/dashboard/page.tsx`; remove the `units` and `drivers` kinds from `components/dashboard/recent-data-glimpse.tsx` and the matching queries in `lib/dashboard/queries.ts`; update `tests/unit/dashboard-recent-data.test.ts` for the removed kinds

**Checkpoint**: The owner can see who is covering and which tricycles are off the road

---

## Phase 7: User Story 5 - Read fleet statistics and simple charts at a glance (Priority: P2)

**Goal**: The "This month" band has headline tiles and two charts with text equivalents, and the monthly unit summary table is replaced

**Independent Test**: The tiles equal `/reports` totals for the month to the centavo; there is one bar pair per unit; an empty month shows ₱0.00 and the chart empty messages (quickstart scenarios 11 and 12)

- [X] T040 [US5] In `lib/dashboard/queries.ts`, add `stats: FleetStats` (data-model.md): sum `remittance_paid_centavos`, `total_expense_centavos` and `net_income_centavos` from the existing `dashboard_monthly_unit_summary` call as integers; count units by `status`; `documentsDue` = number of `expiring_documents` rows; `maintenanceDue` = number of `due_maintenance` rows; add `unitBars: UnitIncomeBar[]` ("`collectedPct`, `expensePct` (0–100, relative to the largest collected-or-expense value of the month; 0 when the month is empty)", ordered by body number)
- [X] T041 [US5] In `lib/dashboard/queries.ts`, add `daily: DailyCollection[]`: non-deleted `remittance_payments` whose `paid_at` falls in the current month in Asia/Manila (use `lib/dates/fleet-date.ts` for the bounds and for converting to dates), summed per Manila date from the 1st to today, with `heightPct`; the sum over days must equal `stats.collectedCentavos`
- [X] T042 [P] [US5] Unit tests in `tests/unit/dashboard-stats.test.ts`: totals and percentages from a fixture summary; an empty month gives zeros and no division by zero; daily bucketing at the Manila midnight boundary (a payment at 23:30 UTC belongs to the next Manila day); Σ daily = collected
- [X] T043 [P] [US5] Create `components/dashboard/fleet-stats.tsx`: six tiles (Collected this month, Expenses this month, Net income, Units on the road / in repair, Documents due, Maintenance due), money via `formatPesos`, ₱0.00 when empty, in one row on `md` and up and wrapping on phones
- [X] T044 [P] [US5] Create `components/dashboard/unit-income-chart.tsx`: two labelled horizontal bars per unit (collected and expenses) drawn with CSS widths from `collectedPct` / `expensePct` and token colours, with the series told apart by both colour and a text label; exact `formatPesos` amounts and net shown as text beside each unit; empty message "No remittances or expenses recorded this month yet."
- [X] T045 [P] [US5] Create `components/dashboard/daily-trend-chart.tsx`: an inline SVG with one column per day using token fills, axis labels for the first and last day, a visible month total, and a `sr-only` summary (total, best day, days with nothing collected); an empty-state message when there are no payments
- [X] T046 [US5] Render the tiles and both charts in the "This month" band of `app/(owner)/dashboard/page.tsx`; delete `components/dashboard/monthly-unit-summary.tsx` (clarification Q3)

**Checkpoint**: Fleet health can be read at a glance and the totals reconcile with the report

---

## Phase 8: User Story 6 - Shorter recent-activity panels (Priority: P3)

**Goal**: The "Recent activity" band shows the 5 newest remittances, expenses, maintenance work and documents added

**Independent Test**: With 20 remittances, the panel shows the 5 with the latest service dates, newest first (spec US6)

- [X] T047 [US6] In `lib/dashboard/queries.ts`, change the recent queries per research R10: remittances by `service_date` desc, expenses by `expense_date` desc, maintenance = the latest 5 of `part_replacements` and `tire_installations` by `created_at` (replacing the copy of the due items), documents by `created_at` desc; `.limit(5)` and `deleted_at is null` on each
- [X] T048 [US6] Update `components/dashboard/recent-data-glimpse.tsx` for the kinds `remittances`, `expenses`, `maintenance` (part or tire name, Body X, installed date) and `documents` (title "Recently added documents"); render them in the "Recent activity" band of `app/(owner)/dashboard/page.tsx`; update `tests/unit/dashboard-recent-data.test.ts`

**Checkpoint**: History panels are short and come after the urgent bands

---

## Phase 9: User Story 7 - A dashboard that reads well on any screen (Priority: P2)

**Goal**: The bands stack in priority order on phones and sit in a balanced grid on wider screens

**Independent Test**: At 360 px, tablet and desktop widths, check the band order, the absence of horizontal scroll and the column counts (quickstart scenarios 9 and 14)

- [X] T049 [US7] Apply the research R11 layout in `app/(owner)/dashboard/page.tsx` with existing utilities and Tailwind grid classes only (no arbitrary sizes): attention panels 1 / 2 (`md`) / 3 (`xl`) columns; status panels 1 / 2 columns; tiles in one row on `md` and up; charts 1 / 2 columns; recent panels 1 / 2 columns; remove the leftover old `workspace-grid-wide` wrapper; update `DashboardFallback` to show four band skeletons
- [X] T050 [US7] Playwright test `tests/e2e/dashboard-refresh.spec.ts` (demo mode): at 360 px the first band heading is "Needs attention" and the bands are in contract order; no panel has more than 5 rows; "View all" appears when there are more; "Recent units", "Recent drivers" and the monthly summary table are gone; no horizontal scroll at 360 px; at desktop the tiles share one row; at 360 px the page height (`document.documentElement.scrollHeight`) is at most 60% of the SC-004 baseline recorded in T010; staff users still get the forbidden page

**Checkpoint**: All user stories are complete

---

## Phase 10: Polish & Cross-Cutting Concerns

- [X] T051 [P] Update `docs/DEVELOPMENT.md` with the list paging and search URL rules (`page`, `q`, prefixes, fixed filters) and the dashboard bands; check `DESIGN.md` compliance (no hex colours or arbitrary sizes, status never shown by colour alone) in every new component
- [ ] T052 Run `corepack pnpm lint`, `corepack pnpm typecheck`, `corepack pnpm test`, `corepack pnpm test:e2e`, `corepack pnpm check`, and `corepack pnpm exec supabase db reset && corepack pnpm exec supabase test db` (unchanged); then walk through the quickstart.md manual scenarios 1–15 at 360 px and at desktop width, including a plain-language usability check; also (a) time the first page of `/remittances` with 1,000 seeded remittances on a throttled "Fast 3G" profile (target ≤ 2 s, SC-001) and time finding one record on a 500-row list by search (target ≤ 15 s, SC-002); (b) confirm `/reports` and the monthly CSV export still include every record for the month (not 10); (c) complete the constitution-compliance check below; record all results in `specs/006-pagination-dashboard-refresh/validation.md`

### Constitution Compliance Check (part of T052)

Record a pass/fail line for each principle in `validation.md`:

- **I. Free-Tier Sustainability**: `package.json` has no new dependencies, and no new service has been added.
- **II. Monolithic Simplicity**: all changes are inside the single Next.js app; no new deployable.
- **III. Data Integrity and Auditability**: every new or changed query keeps `deleted_at is null` where the table has it; money is summed as integers and formatted only with `formatPesos`; dashboard totals equal `monthly_report` (T042, scenario 11); `supabase/migrations/` is unchanged.
- **IV. Mobile-First, Human-Centered Operations**: T024 and T050 pass at 360 px; empty and no-match messages are plain language; the usability check is recorded.
- **V. Compliance Document Lifecycle**: expired and soon-to-expire documents are first on the dashboard with days remaining or overdue (T032, T050).

---

## Dependencies & Execution Order

- **Setup (T001)** → **Foundational (T002–T011)** → user stories.
- Within Foundational: T002 and T003 come before T004 and T005 (tests) and before T006–T009; T008 and T009 depend on T006 and T007; T010 must finish before T011, because T010 records the old dashboard height (SC-004 baseline).
- **US1 (T012–T024)** depends only on Foundational. **US2 (T025–T030)** depends on US1, because it edits the same page files and needs paging to exist.
- **US3, US4, US5, US6** depend on Foundational (T010, T011) only, not on US1 or US2. They all edit `lib/dashboard/queries.ts` and `app/(owner)/dashboard/page.tsx`, so run their query and page tasks one story at a time (order: US3 → US4 → US5 → US6); their new component files and unit tests can run in parallel.
- **US7 (T049–T050)** depends on US3–US6 being in place.
- **Polish (T051–T052)** comes last.

## Parallel Opportunities

- Foundational: T002 ∥ T003 ∥ T010, then T004 ∥ T005 ∥ T011 (T011 after T010).
- US1: once T012 sets the pattern, T013–T023 touch different files and can run in parallel.
- Dashboard: T031 ∥ T032 ∥ T038 ∥ T042 ∥ T043 ∥ T044 ∥ T045 (new files only), while the query and page tasks stay sequential.
- The list track (US1 → US2) and the dashboard track (US3 → US6 → US7) are independent and can go in parallel.

```text
# Example: US1 after T012
T013 drivers page   T014 remittances page   T015 expenses page   T016 maintenance page
T017 documents page T018 audit              T019 staff           T020–T023 detail pages

# Example: US5
T042 stats tests    T043 fleet-stats.tsx    T044 unit-income-chart.tsx    T045 daily-trend-chart.tsx
then T040 → T041 → T046 (shared files)
```

## Implementation Strategy

1. **MVP**: Setup + Foundational + US1 + US2. Every list is paged and searchable, and the divider and search icon are fixed. This can ship alone.
2. **Dashboard increment 1**: US3, then US4 (attention first, extradors and units in repair).
3. **Dashboard increment 2**: US5 and US6 (statistics, charts, shorter recent panels).
4. **Finish**: US7 layout and the e2e checks, then Polish (T051–T052).

The page never loses information between increments, because T011 keeps the old panels until each story replaces them.
