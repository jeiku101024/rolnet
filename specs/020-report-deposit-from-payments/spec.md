# Feature Specification: Report Deposit From Payments

**Feature Branch**: `020-report-deposit-from-payments` (not created yet: feature 019 is still uncommitted on `019-page-report-downloads`; cut this branch once 019 is committed)

**Created**: 2026-11-19

**Status**: Draft

**Input**: User description: "Make the remittance report workbooks (Weekly, Monthly, Yearly) show money actually received instead of the amount charged. Deposit must be computed from the actual payments recorded, the way the app computes it: Deposit = payments received minus Allowance, so it can be negative and an unpaid remittance shows -₱40.00. Rental keeps showing the charge."

## Clarifications

### Session 2026-11-19

- Q: How does the Notes cell read when one remittance has several late payments? → A: A short summary that always fits the column: "Received later: 3 payments, ₱540.00 (last Nov 22)". A single late payment reads "Received later: ₱180.00 on Nov 22".
- Q: When a payment is made on a later day than the remittance's service date, where does the report show it? → A: Deposit stays on the remittance's own service-date row (matching the List view), and the sheet also notes the late payment. The note goes in a new column named "Notes" (not "Received later") on the Weekly and Monthly unit sheets.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A unit sheet shows what was really deposited (Priority: P1)

The owner downloads a Weekly or Monthly report and opens a unit's sheet. For a day where the unit returned and owes the full ₱180 rental with nothing paid, the row shows Rental ₱180, Allowance ₱40 and a Deposit of −₱40, the same figures the Remittances card shows (Payment received ₱0.00, Deposit −₱40.00). For a day where ₱100 was paid, Deposit shows ₱60. The Weekly and Monthly subtotals add up the same figures, so the bottom of the sheet agrees with the daily rows.

**Why this priority**: This is the reported defect. Today the sheet shows ₱140 for an unpaid day, which hides the unpaid amount and does not match the app.

**Independent Test**: Record one unpaid remittance and one part-paid remittance for a unit in the same week, download the Weekly and Monthly reports for that unit, and compare each row and each subtotal with the Remittances List view.

**Acceptance Scenarios**:

1. **Given** a remittance of ₱180 rental, ₱40 allowance and no payment, **When** the report is downloaded, **Then** its Deposit cell shows -₱40.00 in the workbook's negative style (red with a minus sign) and its Rental cell still shows ₱180.
2. **Given** a remittance with ₱100 paid, **When** the report is downloaded, **Then** its Deposit shows ₱60.
3. **Given** a remittance paid in full (₱180), **When** the report is downloaded, **Then** its Deposit shows ₱140, the same as before this change.
4. **Given** a remittance whose payment was later voided or lowered, **When** the report is downloaded, **Then** Deposit follows the payments that still count and ignores voided ones.
5. **Given** a unit sheet with several rows, **When** the subtotal and total rows are read, **Then** they add up the Deposit cells above them and equal Rental minus Allowance only when everything was paid in full.
6. **Given** a deleted remittance, **When** the report is downloaded, **Then** it is still left out.

---

### User Story 2 - The Yearly report and the All units summary agree (Priority: P2)

The owner downloads a Yearly report, or the Monthly or Weekly report for all units. On each unit's yearly sheet, every month row's Deposit and the year total are built from payments received. On the "All units" summary sheet, each unit's Rental, Deposit, Allowance, Expenses and Net come from the same figures, and the totals row equals the sum of the unit rows. Opening the Remittances List view for the same period and unit gives the same Deposit total.

**Why this priority**: Without it the unit sheets would be right but the summary and yearly numbers would still disagree with the app.

**Independent Test**: For one month, add the Deposit column of the Remittances List view for a unit and compare it with that unit's Monthly sheet, the All units summary row, and the matching month on the Yearly sheet.

**Acceptance Scenarios**:

1. **Given** a unit with unpaid and part-paid remittances in a month, **When** the Yearly report is downloaded, **Then** that month's Deposit equals the List view's Deposit total for that unit and month.
2. **Given** an all-units download, **When** the summary sheet is opened, **Then** each unit's Deposit and Net equal that unit's sheet totals, and the totals row equals the sum of the rows.
3. **Given** a month with no remittances for a unit, **When** the Yearly report is downloaded, **Then** that month's Deposit shows 0 as today.
4. **Given** Net, **When** read, **Then** its meaning and calculation are unchanged (Allowance minus Expenses), as are all of its labels.

---

### User Story 3 - Everything else about the files stays the same (Priority: P2)

Only the Deposit values and the new Notes column on the Weekly and Monthly unit sheets change. File names, sheet order, titles, fonts, colors, number formats, the existing columns and their order, A4 paper, Narrow margins, one page wide, and live formulas with cached values stay as they are.

**Why this priority**: The owner and bookkeeper already rely on the layout; a layout change would be a separate request.

**Independent Test**: Download the same report before and after, with every remittance paid in full: the two files differ only by the added, empty Notes column. With unpaid remittances, only Deposit cells and the totals that add them differ besides that column.

**Acceptance Scenarios**:

1. **Given** data where every remittance is paid in full, **When** a report is downloaded, **Then** the file is the same as the one produced before this change, apart from the added Notes column, which is empty on every row.
2. **Given** unpaid remittances, **When** a report is downloaded, **Then** the only cells that differ from the old file are Deposit cells and the subtotal, total and summary cells that add them.
3. **Given** a downloaded file, **When** the Deposit column is selected in Excel, **Then** Deposit cells are numbers (not text) and subtotal cells are live sums.

---

### Edge Cases

- A remittance with no payments at all: Deposit is minus the allowance (−₱40.00).
- A payment larger than the rental is refused by the app today, so a Deposit above Rental minus Allowance cannot occur.
- A payment recorded on a later day than the remittance's service date: the remittance's Deposit counts it, shown on the remittance's own service-date row, the same as the List view, and its Notes cell says the payment was received later, with the amount and the date (FR-014).
- An overnight/overtime remittance (₱300 rental): Deposit is its payments minus allowance, with the same rule.
- Payments voided with a reason and replaced by a new total: only the replacement counts.
- A remittance on a day the unit was later archived, or a retired unit: it follows the existing inclusion rules, and only the Deposit figures change.
- A remittance whose payments make Deposit zero: it shows 0 in the workbook's existing zero style.
- A very large number of remittances (about 100 units, a full year): the Yearly report must still be ready in about the same time as today.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: In the Weekly and Monthly workbooks, each daily row's Deposit MUST equal that remittance's payments received (payments still counted, not voided) minus its Allowance, and MAY be negative.
- **FR-002**: The Rental column MUST keep showing the amount charged (the amount due), and the Allowance column MUST keep showing the allowance, unchanged.
- **FR-003**: Subtotal and total rows of the Weekly and Monthly unit sheets MUST add up the Deposit cells above them (live sums), so they agree with the daily rows.
- **FR-004**: In the Yearly workbook, each month row's Deposit and the year total MUST be built from payments received minus allowance for the remittances of that unit and month.
- **FR-005**: On the "All units" summary sheet, each unit's Rental, Deposit, Allowance, Expenses and Net, and the totals row, MUST come from the same figures as that unit's sheet, with Net still meaning Allowance minus Expenses.
- **FR-006**: For the same period and unit, the report's Deposit total MUST equal the sum of the Deposit column in the Remittances List view.
- **FR-007**: Voided payments MUST never count; deleted remittances MUST stay excluded; archived-unit and retired-unit rules MUST stay as they are.
- **FR-008**: A remittance without payments MUST show its Deposit as minus its allowance, and the figure MUST appear in the workbook's existing negative number style.
- **FR-009**: File names, sheet order and names, period title bands, fonts, colors, number formats, the existing columns and their order and widths, A4 paper, Narrow margins, one-page-wide scaling, live formulas with cached values, and the single-unit and all-units choices MUST NOT change, with two named exceptions: the new Notes column (FR-014) and the Deposit cells on daily and month rows, which become plain numbers because they now hold recorded payments (they can no longer be a formula of the row's Rental and Allowance). Every subtotal, total, summary link and Net stays a live formula with its cached value.
- **FR-010**: Data in which every remittance is paid in full on its service date MUST produce files identical to the ones produced before this change, apart from the added Notes column on the Weekly and Monthly unit sheets.
- **FR-011**: The change MUST apply to every way the app builds these reports, including the Remittances download overlay added by feature 019, and MUST not require any user action.
- **FR-012**: Money MUST stay in whole centavos until it is written as pesos, with no rounding differences from what the app shows.
- **FR-013**: The Yearly report for about 100 units MUST remain ready in about the time it takes today.
- **FR-014**: The Weekly and Monthly unit sheets MUST have a new last column named "Notes", after Allowance, inside the existing title band and print width. For a remittance with one or more payments dated after its service date, the Notes cell MUST say so in plain words that always fit the column: for one late payment "Received later: ₱180.00 on Nov 22", for several "Received later: 3 payments, ₱540.00 (last Nov 22)" (count, total, and the date of the latest); for every other row it MUST be empty. The note is text only: it takes no part in any total.
- **FR-015**: The Yearly workbook and the "All units" summary sheet MUST NOT get a Notes column.

### Key Entities

- **Remittance**: One unit's charge for one service date: rental (amount due), allowance, disposition, and the payments recorded against it.
- **Payment**: Money received against a remittance, with an amount and a date; voided payments are kept for history and do not count.
- **Deposit**: What is actually received minus the allowance: the sum of the remittance's counted payments minus its allowance. Negative when less than the allowance has been paid.
- **Report row**: A day (Weekly, Monthly) or a month (Yearly) for one unit, with Rental, Deposit and Allowance, and the Expenses and Net derived from them.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For a test month, the Deposit total of every unit's sheet equals the Remittances List view's Deposit total for that unit and month, with zero differences, in Weekly, Monthly and Yearly reports.
- **SC-002**: A unit that owes a full rental shows −₱40.00 in its Deposit cell (not ₱140.00) in 100% of Weekly, Monthly and Yearly files.
- **SC-003**: The All units summary totals equal the sum of the unit rows and equal the sum of the unit sheets' totals for the same period, with zero differences.
- **SC-004**: For data with every remittance paid in full, the new files match the old files cell for cell (values, styles, layout and print setup), except for the added, empty Notes column on the Weekly and Monthly unit sheets and the daily and month Deposit cells being plain numbers with the same value instead of formulas.
- **SC-005**: Comparing the old and new file for data with unpaid remittances shows differences only in Deposit cells, the cells that sum them, and the Notes column.
- **SC-006**: The Yearly report for about 100 units is ready in under 5 seconds on the same hosting plan.
- **SC-007**: A bookkeeper reading a downloaded file can find every unpaid amount without opening the app: an unpaid remittance never appears as a positive Deposit.

## Assumptions

- A remittance's Deposit is attributed to its own service date, exactly as in the List view and on the Daily card, so a payment made on a later day still counts toward the earlier remittance's row. This keeps the report matching the app. The late payment is also noted in the new Notes column (clarified).
- The Notes column holds only the late-payment note. A remittance's own free-text notes are not copied into it; say so if you want them there as well.
- A payment dated on or before the service date, including one recorded on the service date, is not "late" and gets no note.
- The Deposit rule is the one the app already uses (payments received minus allowance); the report adopts it and does not define a new one.
- Rental stays the charge and is not reduced when a payment is missing, so the unpaid amount shows as the gap between Rental and what was deposited.
- Existing stored Deposit figures in the app are already correct and are the reference to match.
- The remittance workbooks' appearance, the Remittances overlay and the other two new workbooks (Sinking fund standings, Expenses) are out of scope.
- Paid and Owed columns are out of scope. The only column added is Notes, on the Weekly and Monthly unit sheets.
- Feature 014's earlier rule (Deposit as Rental minus Allowance) is replaced; the golden-file comparison from feature 019 will need to be refreshed for data that includes unpaid remittances.
- No new paid services or libraries are required.
