# Feature Specification: Paginated Lists and Dashboard Refresh

**Feature Branch**: `006-pagination-dashboard-refresh`

**Created**: 2026-10-30

**Status**: Draft

**Input**: User description: "Implement pagination in all of data displayed on direct pages instead of scrolling through all data. Search is still there but fix the divider sticking with the search bar. Also add search icon for more detail. For dashboard page, fix the display. Investigate. Display recent 3-5 only records for others, The records with the most recent or expiring soon, maintenance due should be at the top. Might add statistics, charts, if possible. Also, remove drivers and units. Replace it with current Backups/Extradors and Units that are in repair. Overall, make it readable and user friendly, responsive."

## Current State (investigation notes)

- Every record list (units, drivers, remittances, expenses, maintenance, documents, staff, audit
  history, and the record lists on unit, driver, document, and remittance detail pages) shows all
  rows at once, so the owner scrolls through the full history to find anything.
- The search box only hides rows that are already on screen. It has no search icon, and it sits
  flush against the card edge and the table's header rule, so the divider looks attached to the
  search field (see the reported screenshot of the Drivers list).
- The dashboard stacks a monthly unit summary, expiring documents, due maintenance, unpaid
  balances, and six "recent" panels (remittances, units, expenses, maintenance, documents,
  drivers) in one long column. Attention items and history items have equal weight, the "recent
  units" and "recent drivers" panels repeat what their own pages already show, and there are no
  fleet-level totals or charts.

## Clarifications

### Session 2026-10-30

- Q: Which backup drivers (extradors) should the dashboard's extrador panel list? → A: All active backup drivers, each shown with their current unit or "Not assigned".
- Q: How many records should each list page show, and can users change it? → A: Always 10 per page; no page-size selector.
- Q: What happens to the monthly unit summary table once the per-unit chart is added? → A: The chart replaces the table; each unit's exact peso amounts appear as labels or a readable list beside the chart.
- Q: The dashboard was no shorter on a phone after adding figures and charts; keep the 40% goal (SC-004) or relax it? → A: Keep it, and fold more on phones (charts and recent activity behind "Show" buttons).

### Session 2026-10-30 (follow-up)

- Q: Lists can be paged and searched but not sorted or filtered; which sorts and filters? → A: Owner asked for "filter by date, name, etc., whatever is best": each main list gets a sort choice and the filters that fit its records (date range, unit, driver, category, type, status), defined per list in User Story 8.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Browse long lists one page at a time (Priority: P1)

The owner or staff member opens any record list and sees a fixed number of rows, with clear
controls to move to the next, previous, first, or last page and a label such as "11–20 of 87
records". They no longer scroll through months of remittances to reach the bottom of a page.

**Why this priority**: Lists grow every day (one remittance per unit per day). Without paging,
every list page becomes slower to read and harder to use on a phone, which is the primary device.

**Independent Test**: Load a list with more than one page of records, step through the pages, and
confirm each page shows the expected rows, the range label is correct, and controls disable at
the first and last page.

**Acceptance Scenarios**:

1. **Given** a list with 87 records, **When** the user opens it, **Then** the first 10 records are
   shown with the label "1–10 of 87 records" and Next/Last controls enabled while Previous/First
   are disabled.
2. **Given** the user is on page 3, **When** they refresh the page or come back from a record's
   detail page, **Then** they return to page 3 of the same list.
3. **Given** a list with 10 or fewer records, **When** the user opens it, **Then** all records
   show and the paging controls are hidden or clearly inactive, while the record count remains.
4. **Given** a phone-sized screen (360 px wide), **When** the user views any paged list, **Then**
   the paging controls fit without horizontal page scrolling and each control is large enough to
   tap.

---

### User Story 2 - Search across all records, with a clear search field (Priority: P1)

The user types into a search field marked with a search icon. Results come from every matching
record in that list, not only the current page, and are paged the same way. The search area is
visually separated from the table: the table's divider no longer touches or overlaps the field.

**Why this priority**: Once lists are paged, searching only the visible page would hide most
matches, so search must cover the whole list for paging to be safe to ship.

**Independent Test**: On a multi-page list, search for a value that exists only on a later page
and confirm it appears; confirm the icon, spacing, and clear action are present.

**Acceptance Scenarios**:

1. **Given** a matching record exists on page 5, **When** the user searches for it from page 1,
   **Then** the record appears in the results and the label shows the filtered count (for
   example "1–1 of 1 record").
2. **Given** the user is on page 4, **When** they change the search text, **Then** the results
   restart at page 1.
3. **Given** a search with no matches, **When** results load, **Then** a plain-language message
   says no records match and offers a way to clear the search.
4. **Given** any list, **When** it is displayed, **Then** the search field shows a search icon,
   has visible space between it and the table header rule, and has a clear action once text is
   entered.

---

### User Story 3 - See what needs attention first on the dashboard (Priority: P1)

The owner opens the dashboard and the top of the page shows what needs action, ordered by
urgency: expired and soon-to-expire documents (soonest first), maintenance that is overdue or due
(most overdue first), and unpaid driver balances (largest or oldest first). Each panel shows at
most 5 items with a link to the full list.

**Why this priority**: The dashboard's job is to prevent lapses in compliance documents and
maintenance (Constitution principle V). Burying these below history panels defeats that.

**Independent Test**: Seed documents with different expiry dates and maintenance items with
different due dates, open the dashboard, and confirm ordering, the 5-item limit, and links.

**Acceptance Scenarios**:

1. **Given** documents expiring in 2, 10, and 25 days and one already expired, **When** the
   dashboard loads, **Then** the expired document is listed first, followed by 2, 10, and 25
   days, each with its days-remaining or days-overdue wording.
2. **Given** 12 maintenance items due, **When** the dashboard loads, **Then** 5 are listed, most
   overdue first, with "View all 12" linking to the maintenance list.
3. **Given** nothing is expiring or due, **When** the dashboard loads, **Then** each attention
   panel says so in a short reassuring message instead of disappearing.

---

### User Story 4 - Know which extradors are working and which units are in repair (Priority: P2)

The "Recent drivers" and "Recent units" panels are removed. In their place, the dashboard shows
the backup drivers (extradors) who are active, with the unit each is currently assigned to (or
"Not assigned"), and the units whose status is "in repair", with how long each has been in repair.

**Why this priority**: The owner plans each day around who is covering which tricycle and which
tricycles are off the road. A generic "recently edited" list does not answer either question.

**Independent Test**: Mark two units "in repair" and assign one active backup driver to a unit,
then confirm both panels show exactly those records with links to their detail pages.

**Acceptance Scenarios**:

1. **Given** 3 active backup drivers, one assigned to Body 12, **When** the dashboard loads,
   **Then** the panel lists all 3, shows "Body 12" for the assigned driver and "Not assigned" for
   the others, and links each name to the driver's detail page.
2. **Given** 2 units in repair and 1 retired unit, **When** the dashboard loads, **Then** only the
   2 in-repair units are listed, longest in repair first.
3. **Given** more than 5 entries in either panel, **When** the dashboard loads, **Then** 5 are
   shown with a "View all" link to the filtered drivers or units list.

---

### User Story 5 - Read fleet statistics and simple charts at a glance (Priority: P2)

Near the top of the dashboard, the owner sees a row of headline figures for the current month —
remittances collected, expenses, net income, units on the road versus in repair, documents
expired or expiring within 30 days, and maintenance items due — and a simple chart comparing remittances and
expenses per unit for the month (and, where data exists, a daily collections trend for the
month).

**Why this priority**: Totals and comparisons give the owner a quick read of fleet health, but
the attention panels and status panels are more urgent, so this follows them.

**Independent Test**: Seed a month of remittances and expenses, open the dashboard, and confirm
each headline figure matches the monthly report for the same month and the chart shows one entry
per unit.

**Acceptance Scenarios**:

1. **Given** a month with recorded remittances and expenses, **When** the dashboard loads,
   **Then** the headline totals equal the corresponding totals in the monthly report to the
   centavo.
2. **Given** a month with no records, **When** the dashboard loads, **Then** the figures show ₱0.00
   or 0 and the chart area shows an empty-state message instead of a blank box.
3. **Given** any chart, **When** a user cannot see the colours or uses a screen reader, **Then**
   the same values are available as text labels or a readable summary.

---

### User Story 6 - Shorter recent-activity panels (Priority: P3)

The remaining history panels (recent remittances, recent expenses, recent maintenance activity,
recently added documents) show at most 5 of the newest records each, placed below the attention
panels, status panels, and statistics, each with a "View all" link.

**Why this priority**: Useful context, but least urgent; it mainly reduces clutter.

**Independent Test**: Seed 20 remittances and confirm the panel shows the 5 newest by service date.

**Acceptance Scenarios**:

1. **Given** 20 remittances, **When** the dashboard loads, **Then** the 5 with the latest service
   dates appear, newest first.

---

### User Story 7 - A dashboard that reads well on any screen (Priority: P2)

On a phone, dashboard sections stack in priority order (attention → status → statistics → recent
activity) in a single column with no horizontal scrolling. On wider screens, panels sit
side by side in a balanced grid without leaving large empty gaps.

**Why this priority**: Phones are the primary device (Constitution principle IV).

**Independent Test**: View the dashboard at 360 px, tablet, and desktop widths and confirm order,
absence of horizontal scrolling, and legible text in every panel.

**Acceptance Scenarios**:

1. **Given** a 360 px wide screen, **When** the dashboard loads, **Then** the first visible
   section is the attention summary and no element requires horizontal scrolling.
2. **Given** a desktop screen, **When** the dashboard loads, **Then** headline figures appear in
   one row and panels are arranged in two or more columns.

### User Story 8 - Sort and filter the main lists (Priority: P2)

On each main list page (units, drivers, remittances, expenses, maintenance, documents, audit
history, staff) the user opens "Sort and filter", picks how the list is ordered (for example
"Oldest first" or "Amount, highest first") and narrows it with filters that fit that list: a date
range, a unit, a driver, a category, a type or a status. Filters combine with search and paging,
and the page shows which filters are on, with one action to clear them.

**Why this priority**: Search finds one known record; owners also need questions like "all fuel
expenses for Body T-003 last month" or "drivers whose license expires soonest", which search
alone cannot answer.

**Independent Test**: On Expenses, choose a unit, a category and a date range, sort by amount,
and confirm only matching rows appear in the chosen order, the count and pages reflect the
filters, and "Clear filters" restores the full list.

**Acceptance Scenarios**:

1. **Given** the Expenses list, **When** the user picks Body T-003, category Fuel and the dates
   2026-10-01 to 2026-10-31, **Then** only Fuel expenses for Body T-003 in October are listed and
   the record count says how many.
2. **Given** a filtered list on page 3, **When** the user changes a filter or the sort, **Then**
   results restart at page 1 and the URL keeps the choices for refresh, sharing and Back.
3. **Given** the Drivers list, **When** the user sorts by "License expiry, soonest first", **Then**
   the driver whose license expires next is at the top of page 1.
4. **Given** one or more filters are on, **When** the user selects "Clear filters", **Then** the
   list returns to its default order and every record, keeping any search text.
5. **Given** a 360 px screen, **When** the user opens a list, **Then** the sort and filter controls
   are folded behind one "Sort and filter" button that shows how many filters are on.

### Edge Cases

- A record is added or removed while a user is on the last page: the page still loads; if the
  page no longer exists, the user lands on the new last page instead of an empty page.
- A page number in the address is invalid (zero, negative, text, or beyond the last page): the
  list shows the nearest valid page.
- Soft-deleted records never appear in lists, counts, search results, or dashboard figures.
- Lists whose rows contain inline controls (such as status dropdowns) keep those controls working
  after changing page or searching.
- A search that contains only spaces is treated as no search.
- Documents with no expiry date are not listed in "expiring soon"; maintenance due by mileage and
  by date are ordered together by how far past due they are.
- A backup driver who is inactive is not listed; an active backup driver with an ended assignment
  shows as "Not assigned".
- A unit with no recorded "entered repair" time is listed last with "In repair" and no duration.
- Staff without dashboard permission still cannot see the dashboard; paging and search never show
  records a user's role cannot already see.
- Exports and printed reports are unaffected by paging and still include every matching record.
- A sort or filter value in the URL that the list does not offer is ignored, and the list shows
  its default order or all records rather than an error.
- A "from" date later than the "to" date returns no records with the usual "no records match"
  message; a date that is not a real calendar date is ignored.
- Filters a role cannot use (unpaid balances, maintenance due, documents expiring) are not shown
  to staff, and the same values in the URL are ignored for them.

## Requirements *(mandatory)*

### Functional Requirements

**Pagination**

- **FR-001**: Every list of records shown on a page — the units, drivers, remittances, expenses,
  maintenance, documents, staff, and audit history pages, and the record lists inside unit,
  driver, document, and remittance detail pages — MUST show records in pages instead of all at
  once.
- **FR-002**: Each page MUST show exactly 10 records (fewer only on the last page); users cannot
  change the page size.
- **FR-003**: Paged lists MUST offer First, Previous, Next, and Last controls and the current
  position (for example "Page 2 of 9"), and MUST disable controls that cannot be used.
- **FR-004**: Paged lists MUST display the range and total of records shown (for example
  "11–20 of 87 records"), reflecting the active search when there is one.
- **FR-005**: The current page and search text MUST be kept when the user refreshes the page,
  shares the address, or returns with the browser's back action.
- **FR-006**: List order MUST stay the same as today for each list (for example newest service
  date first for remittances) and be consistent from page to page.
- **FR-007**: Invalid or out-of-range page numbers MUST resolve to the nearest valid page.

**Search**

- **FR-008**: Search MUST match against all records in the list that the user may see, not only
  the current page, and MUST page its results.
- **FR-009**: Changing the search text MUST return the user to the first page of results.
- **FR-010**: The search field MUST show a search icon, an accessible label, and a clear action
  when it contains text.
- **FR-011**: The search area MUST be visually separated from the table: the table's top divider
  MUST NOT touch or appear attached to the search field, with consistent spacing on every list.
- **FR-012**: When no records match, the list MUST show a plain-language "no matching records"
  message with a way to clear the search.

**Dashboard — attention first**

- **FR-013**: The dashboard MUST show attention panels first: expiring documents, due maintenance,
  and unpaid balances.
- **FR-014**: Expiring documents MUST be ordered with expired first, then by soonest expiry date;
  each MUST show its days remaining or days overdue.
- **FR-015**: Due maintenance MUST be ordered most overdue first (by date or mileage, whichever is
  further past due) and say why it is due.
- **FR-016**: Unpaid balances MUST be ordered by largest outstanding amount first, ties broken by
  oldest unpaid date.
- **FR-017**: Every dashboard panel MUST show at most 5 items and, when more exist, a "View all"
  link stating the total and leading to the full list filtered to the same records (for example
  units in repair, units with maintenance due, remittances with an unpaid balance).

**Dashboard — status panels**

- **FR-018**: The "Recent drivers" and "Recent units" panels MUST be removed.
- **FR-019**: The dashboard MUST show a panel of all active backup drivers (extradors), whether or
  not they are assigned, each with the unit currently assigned to them or "Not assigned", linked to
  the driver's detail page. Assigned extradors are listed before unassigned ones.
- **FR-020**: The dashboard MUST show a panel of units with status "in repair", ordered longest in
  repair first, each with how long it has been in repair, linked to the unit's detail page.

**Dashboard — statistics and charts**

- **FR-021**: The dashboard MUST show headline figures for the current month: remittances
  collected, expenses, net income, units active versus in repair, documents expired or expiring
  within 30 days, and maintenance items due.
- **FR-022**: Money figures MUST be calculated exactly to the centavo and MUST equal the monthly
  report's totals for the same month.
- **FR-023**: The dashboard MUST show a chart comparing remittances collected and expenses per unit
  for the current month, and SHOULD show a daily collections trend for the month. The per-unit
  chart replaces the monthly unit summary table; each unit's exact remittance, expense, and net
  income amounts MUST be shown as labels or a readable list beside the chart.
- **FR-024**: Every chart MUST have a text alternative (labels or a summary) that conveys the same
  values, and MUST show an empty-state message when there is no data.

**Dashboard — recent activity and layout**

- **FR-025**: Recent remittances, recent expenses, maintenance activity, and recently added
  documents MUST show at most 5 of the newest records each, below the attention, status, and
  statistics sections.
- **FR-026**: On phone-sized screens, dashboard sections MUST stack in the order attention →
  status → statistics → recent activity, with no horizontal scrolling at 360 px. Panels show 3
  rows on phones (up to 5 on wider screens), and the charts and the recent-activity panels are
  folded behind "Show charts" and "Show recent activity" buttons on phones only.
- **FR-027**: On wider screens, the dashboard MUST arrange panels in a multi-column grid with
  headline figures in a single row.
- **FR-028**: Panels with nothing to show MUST display a short plain-language empty message rather
  than disappearing.

**Sort and filter (User Story 8)**

- **FR-029**: Each main list (units, drivers, remittances, expenses, maintenance, documents,
  audit history, staff) MUST offer a sort choice; the list's current order is the default.
- **FR-030**: Each main list MUST offer the filters that fit its records:
  - Units: status.
  - Drivers: role (primary or backup), status, license expiry (expired, within 30 days, later).
  - Remittances: date range, unit, driver, disposition, and for the owner, unpaid balance.
  - Expenses: date range, unit, category, receipt (attached or missing).
  - Maintenance: unit status, and for the owner, maintenance due.
  - Documents: type, holder (unit or driver), expiry (expired, within 30 days, later).
  - Audit history: date range, action, record type.
  - Staff: account status.
- **FR-031**: Sorting and filtering MUST apply to every record of the list (not only the current
  page), combine with search, and update the record count and page count.
- **FR-032**: Changing a sort or filter MUST return the list to page 1; the choices MUST be kept
  in the URL so refresh, sharing and Back keep them.
- **FR-033**: The list MUST show how many filters are on and offer one "Clear filters" action that
  removes them and the sort while keeping the search text.
- **FR-034**: On phone-sized screens the sort and filter controls MUST be folded behind one "Sort
  and filter" button showing the number of active filters; on wider screens they MUST be visible
  above the list. Every control MUST be at least touch-target size and have a visible label.
- **FR-035**: The dashboard's "View all" links MUST open the matching list with the same filters
  pre-selected (units in repair, backup drivers, maintenance due, unpaid balances, documents
  expired or expiring within 30 days).
- **FR-036**: Date filters MUST use the fleet's calendar date (Asia/Manila), so a record made late
  in the evening appears under that day.

### Key Entities *(include if feature involves data)*

- **Record list page**: A view over one kind of record (units, drivers, remittances, expenses,
  maintenance items, documents, staff, audit events) with a search text, a page number, a page
  size, and a total count of matching records.
- **Attention item**: An expiring document, a due maintenance item, or an unpaid driver balance,
  each with an urgency measure (days to expiry, amount past due, outstanding amount) used for
  ordering.
- **Backup driver (extrador) status**: An active backup driver and the unit of their current
  assignment, if any.
- **In-repair unit**: A unit whose status is "in repair" and the time it entered that status.
- **Monthly fleet figures**: Remittances collected, expenses, and net income for the month, in
  centavos, overall and per unit; counts of units by status, expiring documents, and due
  maintenance.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On every list page, no more than 10 record rows are shown at once, and a list with
  1,000 records opens as quickly as a list with 10 from the user's point of view (first page
  visible within 2 seconds on a typical phone connection).
- **SC-002**: A user can find a specific record on a 500-record list through search in under 15
  seconds, regardless of which page it would otherwise appear on.
- **SC-003**: On the dashboard at a 360 px viewport, the most urgent expiring document or due
  maintenance item is visible without scrolling past any history panel.
- **SC-004**: Every dashboard panel shows at most 5 items; the full dashboard at 360 px is at least
  40% shorter than today's with the same seeded data.
- **SC-005**: Dashboard money figures match the monthly report exactly for 100% of tested months.
- **SC-006**: In a plain-language usability check, a non-technical owner can answer "which units
  are in repair?", "which extradors are working today?", and "what expires next?" from the
  dashboard within 30 seconds each, without help.
- **SC-007**: No list page or the dashboard requires horizontal page scrolling at 360 px.
- **SC-008**: A user can narrow a 500-record list to "one unit, one category, one month" and read
  the result in under 30 seconds, without typing a search.

## Constitution Compliance

| Principle | How this feature complies |
|---|---|
| I. Free-Tier Sustainability | No new services, paid plans, or dependencies; paging reduces the data read per page. |
| II. Monolithic Simplicity | All changes stay inside the single existing application; no new services. |
| III. Data Integrity and Auditability | Read-only feature: no records are created, changed, or deleted. Money figures are exact integer centavos and match the monthly report (FR-022); soft-deleted records never appear (Edge Cases). |
| IV. Mobile-First, Human-Centered Operations | Every list and the dashboard work at 360 px without horizontal scrolling (FR-026, SC-007); messages are plain language (FR-012, FR-028); acceptance includes a phone-size run and a usability check (SC-006). |
| V. Compliance Document Lifecycle | Expired and soon-to-expire documents move to the top of the dashboard with days remaining or overdue (FR-013, FR-014) and are counted in a headline figure (FR-021). |

## Assumptions

- "Direct pages" means every page that lists records, including record lists embedded in detail
  pages; dropdown option lists in forms are out of scope.
- Page size is fixed at 10; a user-selectable page size is out of scope.
- "Extradors" are the existing backup drivers; "units in repair" are units whose status is "in
  repair". No new driver or unit types are introduced.
- "Current" backup drivers means active backup drivers; their current unit comes from the existing
  assignment records.
- Headline figures and charts cover the current fleet month, matching the existing monthly summary
  and report; choosing other months on the dashboard is out of scope.
- Charts are built with tools the project already uses and stay within the existing design tokens;
  no paid services are added (Constitution principle I).
- Sort and filter cover the main list pages only; the shorter lists inside detail pages keep search
  and paging without sort or filter controls.
- Role permissions and soft-deletion rules are unchanged; exports and reports keep returning all
  matching records.
