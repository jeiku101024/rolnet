# Research: Paginated Lists and Dashboard Refresh

All Technical Context unknowns are resolved below. No schema change is required.

## R1. Where paging happens

- **Decision**: Server-side. Each list page reads `page` and `q` from the async `searchParams`
  page prop (Next.js 16, `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md`),
  queries with `.range(from, to)` and `{ count: "exact" }`, and renders only that slice.
- **Rationale**: Lists grow daily (remittances ≈ units × 365/year). The remittances page already
  caps at 50 rows, silently hiding older ones; client-side paging would require loading every
  row. Server rendering also keeps inline status dropdowns and forms working unchanged.
- **Alternatives considered**: Client-side paging of the rows already rendered (extend
  `TableSearch` to hide rows by page): simplest diff, but loads the full table and the 50-row cap
  would have to be removed, so it fails SC-001. Reusing `lib/api/pagination.ts`: it throws on
  bad input and defaults to 25 rows; the UI must clamp instead (FR-007), so a small UI-specific
  helper is added and shares the same range math.

## R2. URL parameters and multiple lists on one page

- **Decision**: `?page=N&q=text` for the main list. Detail pages with several lists use a
  per-list prefix: `?assignments_page=2&documents_q=or`. The helper takes the prefix. Changing a
  list's `q` removes that list's `page`. Page 1 and empty `q` are omitted from the URL.
- **Rationale**: Satisfies FR-005 (refresh, share, back) without client state; prefixes stop two
  lists on the same page from sharing one page number.
- **Alternatives considered**: Client state (lost on refresh/back); a single combined state
  param (unreadable URLs).

## R3. Clamping invalid or stale page numbers

- **Decision**: Parse `page`; non-integer or < 1 → 1. After the count query, if
  `page > lastPage`, re-run the slice query for `lastPage` (one extra query only in that case)
  rather than redirecting. `lastPage = max(1, ceil(total / 10))`.
- **Rationale**: FR-007 and the "record removed while on last page" edge case; no redirect loop,
  no blank page.
- **Alternatives considered**: `redirect()` to the clamped URL (extra round trip, history noise).

## R4. Searching across all records, including related names

- **Decision**: A per-list search spec in `lib/pagination/search-filter.ts`:
  - own text columns → `ilike.*q*` terms joined in one `.or(...)`;
  - related names (unit body number, driver full name, category name) → a small pre-query that
    returns matching ids (`units.body_number ilike`, `drivers.full_name ilike`, …), added to the
    same `.or()` as `unit_id.in.(…)` / `driver_id.in.(…)`;
  - dates and amounts are matched as text only when `q` looks like a date (`2026-10`) or a
    number (pesos → centavos via `lib/money/centavos.ts`);
  - enum columns (document type, unit status, driver kind, disposition, audit action) cannot use `ilike`, so
    `q` is matched in TypeScript against each enum value's display label and the hits become
    `column.in.(…)` in the same `.or()`.
  `q` is trimmed, limited to 100 characters, and PostgREST reserved characters (`,` `(` `)` `*`
  `%` `\`) are escaped or stripped before building the filter. Whitespace-only `q` = no search.
- **Rationale**: PostgREST cannot OR a base column with an embedded column in one filter; the
  id pre-query keeps it to at most 2–3 extra small queries, with no view, function, or
  migration. RLS still applies to every query, so search never reveals hidden rows.
- **Alternatives considered**: A `search_text` generated column or per-list SQL views (needs
  migrations, pgTAP, and grants for a UI convenience); Postgres full-text search (overkill for
  names and body numbers).

## R5. Lists rendered as `<ul>` and grouped lists

- **Decision**: `DocumentList`, `PartsList`, tire history, mileage readings, payment history, and
  `AuditHistory` receive one page of rows plus the shared `Pagination` footer and `ListSearch`
  toolbar — the same contract as `DataTable`, not converted into tables. On the Documents page
  the slice is taken over documents ordered by holder then type, and group headings are drawn
  for the holders present on that page.
- **Rationale**: Keeps existing mobile-friendly layouts; one contract for every list.
- **Alternatives considered**: Paging groups instead of documents (uneven page sizes, breaks the
  "10 per page" rule from the clarification).

## R6. Search field look and the "divider stuck to search" bug

- **Decision**: `DataTable` gets a toolbar row (search on the left, "N records" on the right)
  with its own vertical padding and a bottom rule, then the table. The search input gets a
  leading lucide `Search` icon, left padding for it, and the existing "Clear" button. The table
  header row has spacing above it so the first rule never touches the input. Only existing
  spacing/colour tokens are used.
- **Rationale**: Today the search sits inside `CardContent` with `mb-4` directly above the table
  and the `.data-region` rules, so the header rule visually attaches to the field (FR-011).
- **Alternatives considered**: Moving search outside the card (inconsistent with filter
  toolbars on Expenses/Documents that live inside the card).

## R7. Dashboard ordering rules

- **Decision** (pure functions in `lib/dashboard/ordering.ts`):
  - Documents: `expiring_documents()` rows (already `expires_on` ascending, so expired first).
    Add `daysUntil = expires_on − today` for "Expired 3 days ago" / "Expires in 10 days", and the
    holder (body number or driver name).
  - Maintenance: urgency = max(days past `due_date`, km past `due_mileage` ÷ 100). Sort by
    urgency descending; ties by body number. 100 km ≈ one tricycle operating day is a named
    constant (`kmPerDayEquivalent`) so it can be tuned.
  - Balances: `outstanding_centavos` descending, then `first_unpaid_service_date` ascending.
  - Each panel shows the first 5 and passes the total to the "View all N" link.
- **Rationale**: FR-014–FR-017. A single urgency number lets date-due and mileage-due items be
  ordered together ("whichever is further past due") without new data.
- **Alternatives considered**: Per-unit average daily mileage from `mileage_readings` (more
  accurate, needs extra queries and handling of units with few readings); listing date-due and
  mileage-due items separately (two lists for one question).

## R8. Extradors and units in repair

- **Decision**:
  - Extradors: `drivers` where `driver_kind = 'backup'`, `is_active`, not deleted. Current unit =
    their non-deleted `driver_assignments` row covering today (backup rows have
    `starts_on = ends_on = today`; a primary row with `ends_on is null`); today's backup row wins
    when both exist. Assigned first, then by
    name. Links to `/drivers/[id]`; "View all" → `/drivers?kind=backup` (a fixed filter, because enum columns cannot be `ilike`-searched).
  - In repair: `units` where `status = 'in_repair'`, not deleted. "In repair since" = latest
    `audit_events` row for that unit whose `changed_fields->after->>status = 'in_repair'` (the
    same trail feature 005's `StatusHistory` reads; owner-readable, and the dashboard is
    owner-only via `view_dashboard`). Longest in repair first; no audit row → last, "In repair".
    "View all" → `/units?status=in_repair`.
- **Rationale**: Uses existing data and permission model; no new "repair started at" column.
- **Alternatives considered**: Adding `status_changed_at` to `units` (migration + backfill for a
  value the audit trail already records).

## R9. Statistics and charts

- **Decision**:
  - Headline tiles from `dashboard_monthly_unit_summary(month_start)` summed in integer centavos:
    collected (`remittance_paid_centavos`), expenses, net income; units active / in repair
    (count query); documents expired or expiring within 30 days (`expiring_documents` length);
    maintenance due (`due_maintenance` length).
  - Per-unit chart: horizontal paired bars (collected vs expenses) per unit, widths as a
    percentage of the largest value, exact `formatPesos` amounts and net beside each unit. This
    replaces the monthly unit summary table (clarification Q3).
  - Daily trend: one column per day of the month of payments received (`remittance_payments`,
    `paid_at` converted to the Manila date — the same basis as `remittance_paid_centavos`), with
    a text summary (total, best day, days with no collections) for screen readers.
  - Drawn as inline SVG/CSS with `fill`/`background` from existing tokens (`brand`, `ink`,
    `muted`, `rule`); series distinguished by colour **and** label/pattern (DESIGN.md: colour is
    never the only signal). No chart library.
- **Rationale**: FR-021–FR-024; CLAUDE.md forbids new component libraries; totals equal the
  monthly report because they come from the same function (SC-005).
- **Alternatives considered**: A charting library such as Recharts (new dependency, bundle size,
  violates project rule); a new SQL function for daily totals (migration for ≤ a few hundred
  rows per month that the app can sum).

## R10. Recent activity panels

- **Decision**: Kinds become `remittances` (latest `service_date`), `expenses` (latest
  `expense_date`), `maintenance` (latest part replacements and tire installations by
  `created_at` — today this panel wrongly repeats the due-maintenance list), and `documents`
  (latest `created_at`, "recently added"). 5 each. `units` and `drivers` kinds are removed.
- **Rationale**: FR-018, FR-025; removes the duplicate maintenance panel found in investigation.
- **Alternatives considered**: Keeping documents ordered by expiry (duplicates the attention
  panel).

## R11. Dashboard layout

- **Decision**: Phone (single column): attention → status → statistics → recent. `md` and up:
  headline tiles in one row (wrapping grid of equal tiles), attention panels in a 3-column grid
  at `xl` / 2 at `md`, status panels side by side, charts side by side, recent panels 2×2. Use
  the existing `workspace-grid-wide` utilities plus Tailwind grid classes; no arbitrary sizes.
- **Rationale**: FR-026, FR-027, SC-003, SC-004.
