# Feature Specification: Page-Level Report Downloads

**Feature Branch**: `019-page-report-downloads`

**Created**: 2026-11-19

**Status**: Draft

**Input**: User description: "Move report downloads onto the pages they belong to, and add two new monthly downloads. Remove the separate Reports page and put its download card in an overlay on Remittances; add a monthly standings download to Sinking fund (owner only) and a monthly per-unit expenses download to Expenses."

## Clarifications

### Session 2026-11-19

- Q: For a past month's standings, should a participant who is active today but joined after that month ended be listed with zeros, or left out? → A: Left out of that month's file.
- Q: How should an overdue unpaid balance be marked in the standings sheet? → A: Colored cell plus the word "Overdue" beside the amount (works in black-and-white print); the five columns stay unchanged.
- Q: In what order do the Expenses workbook's unit sheets appear? → A: Natural order by unit name (ROLNET-1, ROLNET-2, ... ROLNET-10), the same order as the remittance report workbooks and the Units list.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Download remittance reports from the Remittances page (Priority: P1)

An owner working on Remittances wants a weekly, monthly or yearly workbook without leaving the page. They press a workbook icon button at the top right of the page's toolbar. An overlay opens with the same card the Reports page used (Weekly | Monthly | Yearly, period selectors, Scope, "Download .xlsx"), already set to Monthly, the current month and year, All units. They press Download and receive the same file the Reports page produced before. The separate Reports page and its sidebar item no longer exist; an old bookmark to the Reports address lands on Remittances.

**Why this priority**: It replaces an existing feature and removes a navigation item, so it must work first. It also defines the download-button and overlay pattern the other two stories reuse.

**Independent Test**: On Remittances, in List view and in Daily view, open the overlay, download Weekly, Monthly and Yearly files, and compare each with a file made by the old Reports page for the same period and scope. Open the old Reports address and confirm it lands on Remittances.

**Acceptance Scenarios**:

1. **Given** a user with report-export permission on Remittances in Daily view, **When** the page loads, **Then** a workbook icon button shows at the right end of the toolbar row that holds the date controls and the "recorded / received" summary, not in the page header.
2. **Given** the same user in List view, **When** the page loads, **Then** the button shows at the right end of the search and filter row.
3. **Given** the button, **When** the user hovers or focuses it, **Then** a visible tooltip and an accessible label ("Download report") are available.
4. **Given** the button, **When** the user clicks it, **Then** an overlay opens with Monthly selected, the current month and year, and Scope set to All units.
5. **Given** the overlay is open, **When** the user changes the period type, period, or scope and presses Download, **Then** the file has the same name, sheets, layout and print setup as the Reports page produced for the same choices.
6. **Given** a user without report-export permission, **When** they open Remittances, **Then** the download button is not shown, and the download itself is refused if requested directly.
7. **Given** any user, **When** they look at the sidebar, **Then** there is no Reports item.
8. **Given** a user who opens the old Reports address, **When** the page loads, **Then** they are sent to Remittances.

---

### User Story 2 - Download a monthly Sinking fund standings report (Priority: P2)

The owner wants to see where every participant stands at the end of a month. On Sinking fund they press a second workbook icon button at the top right of the content toolbar. An overlay offers Month and Year (default: current month) and "Download .xlsx". The workbook lists every active participant ranked by total savings, with total loans and unpaid balance as of the last day of the chosen month. The existing year-end download stays, now clearly labelled as the year-end interest distribution report.

**Why this priority**: New owner-facing capability with real bookkeeping value, but it depends on the shared pattern from Story 1.

**Independent Test**: Choose a past month, download, and check the participants, ranking, totals and overdue marking against the Top participants view (Total savings, Monthly) and the loan records as they stood on that month's last day. Repeat for the current month and confirm the "as of" date is today.

**Acceptance Scenarios**:

1. **Given** the owner on Sinking fund, **When** the page loads, **Then** a workbook icon button with tooltip and accessible label shows at the top right of the content toolbar, and the existing year-end download is labelled as the year-end interest distribution report.
2. **Given** the overlay is open, **When** the owner presses Download for a chosen month, **Then** a file named `rolnet-sinking-fund-standings-YYYY-MM.xlsx` downloads with one sheet.
3. **Given** the sheet, **When** opened, **Then** it has columns Rank, Participant, Total savings, Total loans, Unpaid balance, and lists every active participant and no archived ones.
4. **Given** participants with equal total savings, **When** ranked, **Then** they share the same rank and are ordered by name; the order otherwise matches the Top participants view with Total savings and Monthly selected.
5. **Given** a past month, **When** the file is made, **Then** savings, loans and unpaid balances are as of that month's last day; **Given** the current month, **Then** they are as of today and the title band reads "as of [date]".
6. **Given** loans, **When** totals are computed, **Then** Total loans is the principal of loans still open or overdue and Unpaid balance is what is still owed on them including interest; paid loans count for neither.
7. **Given** a participant with an overdue loan, **When** the sheet is read, **Then** the overdue unpaid balance has a distinct cell color and the word "Overdue" beside the amount.
8. **Given** the sheet, **When** read to the bottom, **Then** a totals row sums Total savings, Total loans and Unpaid balance, and the title band shows the month and year.
9. **Given** voided transactions, **When** the file is made, **Then** none are counted.
10. **Given** printing, **When** previewed, **Then** it is A4 portrait, Narrow margins, one page wide.
11. **Given** a user who is not the owner, **When** they open Sinking fund or request the file directly, **Then** they cannot download it, the same as the existing download.

---

### User Story 3 - Download a monthly Expenses workbook (Priority: P3)

Anyone who can open Expenses wants a month's expenses per unit in a file. They press the workbook icon button at the top right of the content toolbar, pick a Month and Year (default: current month), and download. The workbook has one sheet per unit with that unit's expenses laid out like a row on the Expenses page.

**Why this priority**: Useful and low-risk, but secondary to the owner-facing reports.

**Independent Test**: Pick a month where some units have expenses, some have none, and one archived unit has expenses. Download and check sheets, order, rows, totals, empty-unit lines and print setup.

**Acceptance Scenarios**:

1. **Given** a user on Expenses, **When** the page loads, **Then** the button shows at the top right of the content toolbar, not in the header, with tooltip and accessible label.
2. **Given** the overlay, **When** the user presses Download, **Then** a file named `rolnet-expenses-YYYY-MM.xlsx` downloads.
3. **Given** the file, **When** opened, **Then** it has one sheet per non-archived unit named after the unit, plus any archived unit with expenses in that month, in natural order by unit name (ROLNET-2 before ROLNET-10).
4. **Given** a unit with no expenses in the month, **When** its sheet is opened, **Then** it shows the title band, the line "No expenses for [month year]", and a total of 0.
5. **Given** a sheet with expenses, **When** read, **Then** columns are Date, Category (custom name for "Others"), Amount, Last replaced ("N/A" for Others), Notes, in the same order and wording as the Expenses page; there is no Unit column and no receipt column, and the unit name appears in the title band.
6. **Given** rows, **When** read, **Then** they run oldest date first, with a total row for Amount at the bottom.
7. **Given** unit names with forbidden characters, over 31 characters, or duplicates after cleaning, **When** sheets are named, **Then** names follow Excel's rules (31 characters max, none of `: \ / ? * [ ]`, duplicates get a number added).
8. **Given** deleted expenses, **When** the file is made, **Then** they are not included.
9. **Given** printing, **When** previewed, **Then** it is A4 landscape, Narrow margins, one page wide.

---

### User Story 4 - Consistent, accessible download overlay (Priority: P2)

On all three pages the overlay behaves the same way. It closes with Escape, a close button, or a click outside. Keyboard focus stays inside while it is open and returns to the icon button on close. While a file is being prepared, the Download button shows a loading state. If preparation fails, the overlay stays open with a plain-language error and a retry option.

**Why this priority**: It is a quality bar shared by every story, but each story can be demoed before it is complete.

**Independent Test**: On each page, open the overlay by keyboard, tab through it, close it three ways, trigger a slow download and a failing download, and retry.

**Acceptance Scenarios**:

1. **Given** the overlay is open, **When** the user presses Tab or Shift+Tab repeatedly, **Then** focus never leaves the overlay.
2. **Given** the overlay is open, **When** the user presses Escape, presses the close button, or clicks outside, **Then** it closes and focus returns to the icon button.
3. **Given** the user presses Download, **When** the file is being prepared, **Then** the button shows a loading state and cannot be pressed again.
4. **Given** preparation fails, **When** the failure is reported, **Then** a clear error message and a retry option show, the overlay stays open, and the user's selections are kept.
5. **Given** a 360 px wide screen, **When** the button and overlay are used, **Then** nothing is cut off or needs sideways scrolling.

---

### Edge Cases

- The viewer lacks permission after the page loaded (for example, access revoked): the download is refused and the overlay shows a clear error, not an empty or broken file.
- Remittances keeps the old Reports page's period choices exactly (any month of the offered years, and the same validation messages). The standings and Expenses overlays offer months only up to the current month, so a future month can never be requested.
- A month with no data: Sinking fund standings still lists every active participant (with zeros); Expenses still lists every non-archived unit with the "No expenses" line.
- A participant is active today but joined after the chosen month's end: they are left out of that month's file.
- A participant was archived after the chosen month: they are left out, since only currently active participants are listed.
- Overlay opened, closed, and opened again: it resets to its defaults rather than keeping a previous error.
- A very long participant name, unit name, category or note: it wraps or is cut within its column without breaking the one-page-wide print.
- The file is prepared but the browser then blocks or cancels the save: the page cannot detect this, so success is shown only once the file was prepared and handed to the browser.
- Remittances is used on a narrow screen: the icon button stays reachable at the end of the toolbar row without hiding the date controls or summary.

## Requirements *(mandatory)*

### Functional Requirements

**Shared button and overlay**

- **FR-001**: Each of Remittances, Sinking fund (standings) and Expenses MUST show an icon button with a spreadsheet/workbook icon at the top right of the page's content toolbar, not in the page header.
- **FR-002**: On Remittances the button MUST appear in both List view (end of the search and filter row) and Daily view (end of the row with the date controls and the recorded/received summary).
- **FR-003**: Each button MUST have a visible tooltip and an accessible label: "Download report" on Remittances and Expenses, and "Download monthly standings" on Sinking fund so it is not confused with the year-end distribution download.
- **FR-004**: Activating a button MUST open a modal overlay holding the download card for that page.
- **FR-005**: The overlay MUST close on Escape, on its close button, and on a click outside, and MUST keep keyboard focus inside while open and return focus to the button on close.
- **FR-006**: While a file is being prepared, the Download button MUST show a loading state and MUST NOT allow a second request.
- **FR-007**: If preparation fails, the overlay MUST stay open and show a plain-language error with a retry option, keeping the user's selections.
- **FR-008**: The button, overlay and card MUST work at a 360 px viewport and in dark mode, using existing design tokens.
- **FR-009**: Every new or moved workbook MUST follow the existing workbook conventions: a period title band at the top of every sheet, the same fonts, colors and number formats, A4 paper, the Narrow margins preset (top/bottom 0.75", left/right 0.25", header/footer 0.3"), and each sheet scaled to one page wide.
- **FR-010**: Money in all workbooks MUST be shown in pesos with centavo precision, with no rounding differences from what the app shows.

**Remittances**

- **FR-011**: The Reports page and its sidebar item MUST be removed.
- **FR-012**: Opening the old Reports address MUST send the user to Remittances.
- **FR-013**: The Remittances overlay MUST contain the same card as the old Reports page: Weekly | Monthly | Yearly switch, the period selectors for each type, Scope (All units or one unit), and "Download .xlsx", with the same validation and behavior.
- **FR-014**: The overlay MUST open on Monthly, the current month and year, All units.
- **FR-015**: Files downloaded from the overlay MUST be identical in name, sheets, layout, content and print setup to those the Reports page produced for the same choices.
- **FR-016**: The button and the download MUST be available only to users who could use the old Reports page.

**Sinking fund standings**

- **FR-017**: The existing year-end distribution download MUST remain and its label MUST state that it is the year-end interest distribution report.
- **FR-018**: The standings overlay MUST offer Month and Year selectors, defaulting to the current month, and a "Download .xlsx" button. It MUST be monthly only.
- **FR-019**: The standings workbook MUST have one sheet listing every active participant who had joined on or before the report date, and no archived participants or participants who joined later, named `rolnet-sinking-fund-standings-YYYY-MM.xlsx`.
- **FR-020**: Columns MUST be Rank, Participant, Total savings, Total loans, Unpaid balance.
- **FR-021**: Rows MUST be ranked by total savings, highest first, matching the Top participants view with Total savings and Monthly selected; ties MUST share a rank and then be ordered by name.
- **FR-022**: Figures MUST be as of the last day of the chosen month, or as of today for the current month.
- **FR-023**: Total loans MUST be the principal of loans that are open or overdue as of that date. Unpaid balance MUST be what is still owed on those loans including interest.
- **FR-024**: An unpaid balance that includes an overdue loan MUST be marked with a distinct cell color and the word "Overdue" beside the amount, so it stands out on screen and in black-and-white print. The marked cell MUST still hold a number (so totals and sorting work), and no extra column is added.
- **FR-025**: The sheet MUST end with a totals row, and its title band MUST show the month and year, plus "as of [date]" for the current month.
- **FR-026**: Voided transactions MUST NOT be counted in any figure.
- **FR-027**: The sheet MUST print A4 portrait, Narrow margins, one page wide.
- **FR-028**: Only the owner MUST be able to see the standings button and download the file, matching the existing Sinking fund download.

**Expenses**

- **FR-029**: The Expenses overlay MUST offer Month and Year selectors, defaulting to the current month, and a "Download .xlsx" button. It MUST be monthly only.
- **FR-030**: Every user with access to the Expenses page MUST be able to download.
- **FR-031**: The workbook, named `rolnet-expenses-YYYY-MM.xlsx`, MUST have one sheet per non-archived unit plus any archived unit with expenses in the month, named after the unit and in natural order by unit name (so "ROLNET-2" comes before "ROLNET-10"), the same order the Units list and the remittance workbooks use.
- **FR-032**: A unit with no expenses in the month MUST still get a sheet with the title band, the line "No expenses for [month year]", and a total of 0.
- **FR-033**: Each sheet MUST list that unit's expenses for the month with columns Date (a real Excel date shown like the page's short date), Category (the custom name for "Others"), Amount, Last replaced ("N/A" for Others), Notes, in the same order and wording as an Expenses page row, with no Unit column and no receipt column; the unit name MUST appear in the title band.
- **FR-034**: Rows MUST be sorted by date, oldest first, with a total row for Amount at the bottom.
- **FR-035**: Sheet names MUST follow Excel's rules: at most 31 characters, none of `: \ / ? * [ ]`, and a number added to duplicates.
- **FR-036**: Only expenses that currently exist MUST be included; deleted expenses MUST NOT be.
- **FR-037**: Sheets MUST print A4 landscape, Narrow margins, one page wide.

### Key Entities

- **Download overlay**: A modal card opened from a page's workbook icon button. Holds period (and, for Remittances, type and scope) choices, the Download action, loading state, and error/retry state. Not stored.
- **Remittance report**: The existing weekly, monthly or yearly workbook for all units or one unit. Unchanged.
- **Sinking fund standings report**: A single-sheet snapshot, as of a month end, of active participants' total savings, open/overdue loan principal and unpaid balance, with rank.
- **Participant standing**: One row of the standings report: rank, participant, total savings, total loans, unpaid balance, and whether any unpaid balance is overdue.
- **Monthly expenses report**: A workbook with one sheet per unit, each listing that unit's existing expenses for one month and a total.
- **Unit**: A tricycle. Determines sheet set, order and names in the Expenses workbook; archived units appear only when they have expenses that month.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: From any of the three pages, a user can go from opening the overlay to a downloaded file in at most 4 interactions (open, optionally adjust period, Download, with no extra page navigation).
- **SC-002**: 100% of files produced from the Remittances overlay are identical in content and print setup to those the old Reports page produced for the same period and scope, checked on a sample of weekly, monthly and yearly files.
- **SC-003**: No Reports item remains in the sidebar, and the old Reports address reaches Remittances in 100% of attempts.
- **SC-004**: The standings workbook participant list, ranking and the figures in it match the Top participants view and the loan records for the same date with zero differences on a test month.
- **SC-005**: Non-owners cannot obtain the standings file by any route in 100% of attempts, and users without report-export permission cannot obtain remittance files.
- **SC-006**: The Expenses workbook contains one sheet for every expected unit (including empty ones) in app order for 100% of tested months.
- **SC-007**: A typical month's file for any of the three downloads is ready in under 5 seconds for the fleet's expected size.
- **SC-008**: Every overlay can be opened, operated, and closed using only the keyboard, and passes use at 360 px width with no sideways scrolling.
- **SC-009**: In a failure test, 100% of failed downloads show an error with retry, keep the overlay open, and keep the user's selections; a retry succeeds once the cause is removed.
- **SC-010**: Printing every new or moved sheet at the stated paper size and orientation fits one page wide with no clipped columns.

## Assumptions

- "Same permissions as the old Reports page" means the existing report-export permission; the remittances button is hidden from users without it.
- The Expenses and Sinking fund pages keep their existing access rules; only the owner sees the standings button, while the year-end download keeps its current rules.
- "Active participant" means a participant who is not archived at the time of download. A participant counts as having joined by the report date if their record was created on or before that date.
- "As of" balances for past months are rebuilt from dated records, so a later correction is reflected in a re-downloaded past month.
- A loan counts as open or overdue on a date if it had been issued on or before that date and was not fully repaid by then; overdue status is judged as of that same date.
- Year choices follow the old Reports page: from the earliest recorded year (or ten years back) to the current year. Standings and Expenses additionally stop at the current month.
- A participant with no savings on the report date is listed after everyone who has savings and gets no rank number, as in the Top participants view.
- The workbook title-band look, fonts, colors and number formats are taken from the existing workbooks and are not redefined here.
- The year-end distribution report, the remittance workbook contents and the Top participants view are unchanged.
- Weekly or yearly versions of the standings and expenses downloads, and a receipt column in the Expenses workbook, are out of scope.
- No new paid services or libraries are required; downloads reuse the app's current file-generation approach.
