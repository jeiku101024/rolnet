# Feature Specification: Remittance Financials and XLSX Reports

**Feature Branch**: `009-remittance-financials-reports`

**Created**: 2026-10-31

**Status**: Draft

**Input**: User description: "Spec update per client (ROLNET): remittance financials and reports. The View toggle, Daily view, and List view are already implemented. This update only adds the Rental, Deposit, and Allowance calculations, shows them in the existing UI, and adds XLSX downloads on the Reports page." (The full description, with the financial rules, worked examples, UI changes, data model, the Weekly / Monthly / Yearly sheet layouts and formatting, and the acceptance criteria, was supplied with the `/speckit-specify` command together with three screenshots of the client's spreadsheet template. Each requirement below reflects it.)

## Clarifications

### Session 2026-10-31

- Q: Which week number does a Weekly report show, given the week may cross months? → A: The week of the month that holds the week's Monday, so it matches that month's Monthly report (FR-030).
- Q: Does the existing monthly CSV download stay? → A: No. It is replaced: the Reports page offers Weekly, Monthly, and Yearly XLSX downloads, each for the whole fleet or for one unit (FR-021, FR-039).
- Q: Should every remittance row have a ₱40 allowance, even though the client's sample sheet has rows with a blank Allowance? → A: Yes. The blanks in the sample were mistakes: every remittance row on the Weekly and Monthly sheets shows Allowance 40 and Deposit = Paid − 40. On the Yearly sheet, each month's Allowance is the total of that month's ₱40 allowances, not 40 (FR-025, FR-031).
- Q: When downloading a report for one unit, does the unit list include retired units? → A: Yes. It lists every unit that isn't deleted (active, in repair, and retired), with retired ones labelled "(retired)" (FR-021).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See Allowance and Deposit while recording (Priority: P1)

When staff or the owner record a unit's remittance in Daily view, the card shows the **Rental** (the amount due, formerly labelled "Due"). Under the notes it shows the fixed **Allowance** of ₱40.00 set aside for repairs and the **Deposit**: the payment received minus the allowance, which is what goes to the bank. The deposit updates as they type the payment, so they can count the cash for the bank before saving. The figures are saved with the record and stay visible after the card locks.

**Why this priority**: Every remittance needs its deposit and allowance worked out. Doing it at entry, with the same formula every time, removes hand calculation and is the base for every report.

**Independent Test**: On a Returned card (Rental ₱180.00), type 100. Before saving, the card shows "Allowance ₱40.00" and "Deposit ₱60.00". Save it: the locked card still shows ₱40.00 and ₱60.00. Edit it, type 180 and save: the deposit reads ₱140.00.

**Acceptance Scenarios**:

1. **Given** a Daily view card, **When** it loads, **Then** the largest figure is labelled "Rental" (not "Due") and shows ₱180.00 for Returned or ₱300.00 for Overnight / overtime.
2. **Given** an unrecorded Returned card, **When** the user types 180, 100, or 0 (or leaves the field empty) in Payment received, **Then** the breakdown between Notes and the Save button reads Allowance ₱40.00 and Deposit ₱140.00, ₱60.00, or −₱40.00 respectively, updating as each character is typed.
3. **Given** a negative deposit, **When** it is shown, **Then** it has a minus sign and is in red.
4. **Given** the user types more than the rental (for example 200 on a ₱180 card), **When** they type it, **Then** an inline message says "Payment can't exceed the rental of ₱180.00" and saving is blocked.
5. **Given** a card on Overnight / overtime with 250 typed, **When** the user switches the disposition to Returned, **Then** the rental shows ₱180.00 and the over-rental message appears, because ₱250 exceeds it.
6. **Given** a saved card, **When** it is locked, **Then** the breakdown shows the saved allowance and deposit, and the badge reads "Paid" or "Owes ₱X". There is never a "Credit" badge.
7. **Given** a locked card with ₱100 received, **When** the user picks Edit remittance and types 180, **Then** the breakdown is live again and shows Deposit ₱140.00. After saving, the record's deposit is ₱140.00.

---

### User Story 2 - Review Rental, Allowance and Deposit in the history (Priority: P1)

In List view, the owner scans every remittance with its Rental, Paid, Balance, Allowance, and Deposit side by side, so the history matches the bank deposits and the repair fund.

**Why this priority**: The history must show the same figures as the cards and the reports. It also confirms the backfill of existing records.

**Independent Test**: Open List view. The columns read Date, Unit / driver, Disposition, Rental, Paid, Balance, Allowance, Deposit. A record paid ₱0 shows Allowance ₱40.00 and Deposit −₱40.00 in red.

**Acceptance Scenarios**:

1. **Given** List view, **When** it loads, **Then** the columns are, in order: Date, Unit / driver, Disposition, Rental, Paid, Balance, Allowance, Deposit.
2. **Given** a record with ₱100 paid on a ₱180 rental, **When** its row is shown, **Then** Rental is ₱180.00, Paid ₱100.00, Balance "Owes ₱80.00", Allowance ₱40.00, and Deposit ₱60.00.
3. **Given** records saved before this feature, **When** List view loads after release, **Then** each shows Allowance ₱40.00 and Deposit equal to its total paid minus ₱40.00.
4. **Given** a negative deposit, **When** it is shown, **Then** it has a minus sign and is in red.

---

### User Story 3 - Download a Weekly or Monthly XLSX report (Priority: P2)

The owner picks a week (any date; the week runs Monday to Sunday) or a month and year on the Reports page and downloads an .xlsx file laid out like the client's template. It has one row per remittance, with blank rows for days with no remittance. Each week ends with a subtotal and lines for Expenses, Allowance, and Net (Allowance minus Expenses). The monthly file ends with a GRAND TOTAL block. Totals are live spreadsheet formulas, so the owner can adjust a cell and the totals follow.

**Why this priority**: This replaces the bookkeeping sheet the client builds by hand today. It depends on every remittance having its allowance and deposit (User Stories 1 and 2).

**Independent Test**: For a month with known remittances and expenses, download the Monthly report. Check that each week's subtotal equals the sum of its rows, that Net equals that week's Allowance minus Expenses, that the GRAND TOTAL equals the sum of the week subtotals, and that changing one row's Deposit in the spreadsheet updates the subtotal and grand total.

**Acceptance Scenarios**:

1. **Given** the Reports page, **When** the owner picks the Weekly report and a date, **Then** the download covers Monday to Sunday of that date's week, in the business time zone, for the whole fleet unless a unit is chosen.
2. **Given** the owner chooses one unit, **When** they download any report, **Then** it includes only that unit's remittances and expenses, and the file name and sheet name the unit.
3. **Given** a week that crosses into the next month (for example Mon 27 Jan to Sun 2 Feb), **When** the Weekly report is downloaded, **Then** each row's Month and Year columns show that row's own month and year (Jan for the 27th to 31st, Feb for the 1st and 2nd).
4. **Given** the Monthly report for a month that starts on a Wednesday, **When** it is downloaded, **Then** Week 1 holds only Wednesday to Sunday, and the last week holds only the days up to the month's end. No days from neighbouring months appear.
5. **Given** a day with two remittances and a day with none, **When** the report is built, **Then** the first day has two rows (one per remittance, each with its driver, Rental, Deposit, and Allowance), and the second has one row with only Week, Day, Month, and Year filled.
6. **Given** a week block, **When** the owner reads it, **Then** after the week's rows come: "Week N Subtotal" (sums of Rental, Deposit, Allowance), "Expenses:" (that week's total expenses, italic, in the Rental column), "Allowance:" (that week's allowance total, italic, in the Rental column), and "Net:" (Allowance minus Expenses, bold, in the Rental column).
7. **Given** the Monthly report, **When** the owner scrolls past the last week, **Then** a GRAND TOTAL block shows the sums of Rental, Deposit, and Allowance, plus total Expenses, total Allowance, and Net, with thick black borders above and below.
8. **Given** the Weekly report, **When** it is opened, **Then** it holds a single week block (rows, Subtotal, Expenses, Allowance, Net) and no grand total.
9. **Given** any downloaded report, **When** a cell under a subtotal is changed in a spreadsheet app, **Then** the subtotal, Net, and grand total recalculate.

---

### User Story 4 - Download a Yearly XLSX report (Priority: P2)

The owner picks a year and downloads a one-sheet summary: twelve rows (Jan to Dec) with Rental, Deposit, and Allowance, then a Year Subtotal, Expenses, Allowance, and Net, then a GRAND TOTAL block, laid out like the client's yearly template.

**Why this priority**: It's the annual view for the owner. It reuses the same figures as the monthly report.

**Independent Test**: For a year with data only in January, download the Yearly report. January shows its totals, February to December show "-", the Year Subtotal equals January's figures, and Net equals Allowance minus Expenses.

**Acceptance Scenarios**:

1. **Given** the Yearly report for 2025, **When** it opens, **Then** it has columns Year, Month, Rental, Deposit, Allowance, and twelve rows Jan to Dec. A month with no data shows "-" in its number cells.
2. **Given** the twelve rows, **When** the owner reads below them, **Then** there is a "Year Subtotal" row (sums), then the Expenses, Allowance, and Net lines, then a GRAND TOTAL block with the same lines, bold with thick black borders above and below.
3. **Given** a year whose expenses exceed its allowance, **When** Net is shown, **Then** it has a minus sign and is in red.

---

### Edge Cases

- **Paid ₱0 or field left empty**: Allowance ₱40.00 and Deposit −₱40.00 (red). Saving is allowed.
- **Payment above the rental**: Blocked everywhere a payment can be entered, including the record's details page. The message gives the rental and the most that can still be paid, for example "Payment can't exceed the rental of ₱180.00. At most ₱80.00 more can be recorded."
- **Owner lowers a payment** (feature 008 correction): the deposit recalculates from the new total.
- **A payment voided or added on the record's details page**: the deposit recalculates from the new total, so every view and report agrees.
- **A reversed (removed) remittance**: It drops out of List view and reports, together with its allowance and deposit.
- **Existing records already paid more than the rental** (from before this rule): They keep their payments. The badge reads "Paid", and the deposit is the formula's result (for example ₱200 paid gives ₱160). No new payment can be added to them.
- **A week or month with no remittances**: The report still lists every day as a blank row. Subtotals are 0, Expenses shows that period's expenses, and Net is 0 minus Expenses (red if negative).
- **A period with remittances but no expenses**: Expenses shows 0 ("-" on the yearly sheet) and Net equals Allowance.
- **A future week, month, or year, or one before any data**: It downloads with blank rows and zero totals. A date far outside the data (more than 10 years from today) is rejected with a plain message.
- **Business time zone**: Week, month, and year boundaries follow the fleet time zone (Asia/Manila by default), so a remittance or expense dated the 31st never lands in the next month's report.
- **Large numbers**: Numbers use thousands separators ("6,830") without a peso sign, and columns are wide enough that nothing is cut off.

## Requirements *(mandatory)*

### Functional Requirements

**Financial rules**

- **FR-001**: Every active remittance MUST have three amounts: **Rental** (the existing amount due: ₱180.00 for Returned, ₱300.00 for Overnight / overtime), **Allowance** (₱40.00), and **Deposit** (total payment received minus Allowance).
- **FR-002**: Deposit MUST be calculated with the formula for every remittance, including partial and zero payments. An unpaid balance MUST NOT stop or change the calculation.
- **FR-003**: Allowance MUST be ₱40.00 per remittance, regardless of the amount paid.
- **FR-004**: Deposit MAY be negative and MUST be shown exactly as calculated (₱0 paid gives −₱40.00), never floored at zero.
- **FR-005**: Each remittance's allowance MUST be stored with the record when it is saved, so a later change to the allowance rate does not change past records.
- **FR-006**: Each remittance's deposit MUST be stored with the record and MUST equal its total active payments minus its allowance after any change to its payments: a first save, an edit, an owner lowering, or a payment added or voided on the details page.
- **FR-007**: A payment MUST NOT make a remittance's total paid exceed its rental, wherever the payment is entered. The Daily view card MUST show the inline message "Payment can't exceed the rental of ₱X" (for example ₱180.00) and block saving. Where an earlier payment already exists (the details page, or the database rejecting a write), the message adds "At most ₱Y more can be recorded."
- **FR-008**: The "Credit ₱X" badge MUST be removed everywhere. The balance badge MUST read "Paid" when the total paid is at least the rental, otherwise "Owes ₱X".

**Daily view card**

- **FR-009**: The card's "Due" label MUST read "Rental", and the rental MUST stay the largest figure on the card.
- **FR-010**: Between the Notes field and the Save button (or the saved badge row), the card MUST show a breakdown in secondary text: "Allowance ₱40.00" and "Deposit ₱X".
- **FR-011**: On an unrecorded or editing card, the deposit MUST update as each character of Payment received is typed, and when the disposition changes, before saving. An empty field counts as ₱0. Text that isn't a valid amount, or an amount above the rental, MUST leave the deposit showing "—" until it is corrected.
- **FR-012**: On a locked card, the breakdown MUST show the saved allowance and deposit. After **Edit remittance**, it MUST be live again.
- **FR-013**: A negative deposit MUST show a minus sign and be red, with the sign so color is not the only cue.

**List view**

- **FR-014**: List view's columns MUST be, in order: Date, Unit / driver, Disposition, Rental, Paid, Balance, Allowance, Deposit. "Due" becomes "Rental".
- **FR-015**: A negative deposit in List view MUST show a minus sign and be red.

**Data and existing records**

- **FR-016**: Every existing remittance MUST be updated once, at release, to Allowance ₱40.00 and Deposit equal to its total active payments minus ₱40.00. Rental, payments, and every other recorded fact MUST stay unchanged.
- **FR-017**: Remittances MUST be quick to look up by service date for period reports, with any of the reports for a year of data downloading within the time given in SC-005.

**Reports page: general**

- **FR-018**: The Reports page MUST offer three downloads: **Weekly**, **Monthly**, and **Yearly**. Each produces an .xlsx file. These reports MUST NOT be offered as CSV.
- **FR-019**: The period pickers MUST be: Weekly, any date (the report covers Monday to Sunday of that date's week); Monthly, a month and a year; Yearly, a year.
- **FR-020**: Period boundaries MUST follow the fleet time zone. Remittances are placed by their service date, and expenses by their expense date.
- **FR-021**: Each report MUST offer a scope: the **whole fleet** (the default) or **one unit**. A fleet report includes every active remittance and every active expense in the period. A unit report includes only that unit's remittances and only expenses recorded for that unit. The unit list MUST include every unit that isn't deleted (active, in repair, and retired), with retired units labelled "(retired)", so past periods of a retired unit can still be reported. Reversed remittances and deleted expenses MUST be left out of both.
- **FR-022**: Only users allowed to export reports (the owner) MUST be able to download them, as with the current report.
- **FR-023**: The downloaded file's name MUST say what it covers, including the unit for a unit report, for example `rolnet-weekly-2025-01-27.xlsx`, `rolnet-monthly-2025-01.xlsx`, `rolnet-yearly-2025-ROLNET-1.xlsx`. The sheet MUST also name the unit (for example in the sheet title) when the report is for one unit.

**Weekly and Monthly sheet**

- **FR-024**: The sheet's columns MUST be, in order: Week, Day, Driver, Rental, Deposit, Allowance, Month, Year.
- **FR-025**: Each remittance MUST be one row showing the week number, the weekday (Mon to Sun), the driver it was recorded under, its Rental, Deposit, and Allowance, and its Month (Jan to Dec) and Year. A day with no remittance MUST still have one row with only Week, Day, Month, and Year filled. Rows MUST be in date order. On every remittance row, Allowance MUST be 40 and never blank. Only a no-remittance day's row leaves it blank.
- **FR-026**: A Weekly report MAY cross months. Each row's Month and Year MUST be that row's own date's month and year.
- **FR-027**: A Monthly report MUST include only days inside the month. Its weeks run Monday to Sunday, numbered from 1, so the first and last weeks may be partial.
- **FR-028**: After each week's rows, the sheet MUST have, in order: "Week N Subtotal" (sums of Rental, Deposit, and Allowance for that week's rows); "Expenses:" (that week's total expenses, in the Rental column); "Allowance:" (that week's allowance total, in the Rental column); "Net:" (Allowance minus Expenses, in the Rental column). For a Monthly report, a partial week's expenses cover only its days inside the month.
- **FR-029**: A Monthly report MUST end with a GRAND TOTAL block: sums of Rental, Deposit, and Allowance across all weeks, then total Expenses, total Allowance, and Net (Allowance minus Expenses).
- **FR-030**: A Weekly report MUST contain a single week block (rows, Subtotal, Expenses, Allowance, Net) and no grand total. Its "Week N" label MUST be the week of the month that holds the week's Monday, counted as in a Monthly report. For example, Mon 27 Jan to Sun 2 Feb 2025 is "Week 5", the same as on January's Monthly report.

**Yearly sheet**

- **FR-031**: The sheet's columns MUST be, in order: Year, Month, Rental, Deposit, Allowance, with twelve rows Jan to Dec holding each month's totals. Each month's Allowance MUST be the total of that month's per-remittance allowances (₱40 times the number of remittances, for example 25 remittances gives 1,000). Rental and Deposit are that month's totals in the same way.
- **FR-032**: Below the twelve rows, the sheet MUST have a "Year Subtotal" row (sums), then the Expenses, Allowance, and Net lines, then a GRAND TOTAL block with the same lines.

**Formatting (all sheets, matching the client's template)**

- **FR-033**: The header row MUST have a dark blue fill with white bold text and stay frozen while scrolling.
- **FR-034**: Subtotal rows MUST have a light blue fill and bold text. The Expenses and Allowance lines MUST be italic, and Net MUST be bold. The GRAND TOTAL block MUST be bold with thick black borders above and below it.
- **FR-035**: The Month and Year columns MUST use green text.
- **FR-036**: Numbers MUST be plain, with thousands separators and no peso sign, showing pesos (centavos only where an amount has them). On the yearly sheet, zero MUST show as "-". Negative values (Deposit, Net) MUST show a minus sign in red.
- **FR-037**: Subtotals, Net, and grand totals MUST be live spreadsheet formulas (sums and subtraction of the cells above), not fixed numbers, so the sheet stays editable. Row values and the Expenses figures are plain numbers.
- **FR-038**: Column widths MUST be set so no header, label, or number is cut off.

**Existing report**

- **FR-039**: The existing monthly CSV download MUST be replaced. The Reports page MUST offer only the Weekly, Monthly, and Yearly XLSX downloads, each with the fleet or one-unit scope from FR-021, so per-unit reporting is kept. The CSV download MUST no longer be offered.

### Key Entities *(include if feature involves data)*

- **Remittance**: One unit's boundary for one service date (existing). The existing amount due is shown as **Rental**. It gains a stored **Allowance** (₱40.00 at save time) and a stored **Deposit** (total active payments minus allowance, may be negative), both in centavos.
- **Remittance payment**: An amount received against a remittance (existing). Their active total is "Paid", and it may never exceed the rental. Any change to them recalculates the remittance's deposit.
- **Expense**: An existing expense with a date and an amount, recorded per unit. Reports total expenses in a period (week, month, or year): all of them for a fleet report, only that unit's for a unit report.
- **Report period**: A week (Monday to Sunday containing a chosen date), a calendar month, or a calendar year, in the fleet time zone. A monthly report's weeks are cut at the month's edges.
- **Report row**: One remittance (or one empty day) with Week, Day, Driver, Rental, Deposit, Allowance, Month, and Year; or, on the yearly sheet, one month's totals.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For 100% of remittances, after release and after any later save or edit, Allowance is ₱40.00 and Deposit equals total paid minus ₱40.00, including partial payments, zero payments, and negative results.
- **SC-002**: While recording, the deposit shown on a card always matches what is saved for that payment, so a user never has to work it out by hand.
- **SC-003**: No remittance can end up with total paid above its rental through any entry point after release.
- **SC-004**: For a sample month, the downloaded Monthly report's per-week Rental, Deposit, Allowance, and Expenses totals match List view and the Expenses page for the same days exactly, to the peso.
- **SC-005**: Each of the three reports for a full year of a 12-unit fleet downloads in under 10 seconds.
- **SC-006**: In each downloaded report, changing any row value in a spreadsheet app updates every subtotal, Net, and grand total that depends on it, with no hand-entered totals.
- **SC-007**: The owner confirms the three downloaded reports match the client's template in column order, labels, fills, fonts, borders, number format, and red negatives on first review.
- **SC-008**: The Daily view card, List view, and Reports page work at a 360 px viewport with no horizontal page scrolling. The List view table may scroll inside its card, as it does today.

## Assumptions

- **Rental is the existing amount due**: It is renamed in the interface only. The amounts ₱180 and ₱300, and the rule that a saved remittance's disposition and rental don't change, stay as they are (feature 008).
- **Allowance applies to every recorded remittance**: That includes ones paid ₱0, and it is ₱40.00 until the rate is changed in a later feature. This feature adds no screen to change it.
- **Where the deposit is kept**: It's stored with each remittance and kept in step with its payments however they change (Daily view, details page, owner corrections, the existing API), so List view and reports never disagree.
- **Overpayment rule going forward**: It applies to new payments from release. Existing records that were already overpaid keep their payments, show "Paid", and accept no further payments. The details page loses the "Paying more is kept as credit" hint and its "Credit (overpaid)" label.
- **Expenses**: Existing expense records count by their expense date: every category, and every unit for a fleet report or only the chosen unit for a unit report. No new expense screens are added.
- **Driver column**: It shows the driver the remittance was recorded under (the one shown on its card), and a report doesn't show unit names.
- **Unit reports**: These pick from every unit that isn't deleted, shown by name and body number, with retired units labelled "(retired)". A unit report's Driver column still shows each remittance's driver, which can differ day to day (for example a backup).
- **Week numbering in a Monthly report**: Week 1 is the Monday-to-Sunday week (cut at the month's start) that holds the 1st. Each later Monday starts the next week.
- **Number display in reports**: Amounts are pesos without a currency sign. Whole-peso amounts show no decimals ("6,830"), and amounts with centavos show two decimals.
- **The Reports page stays owner-only**: It keeps its 360 px layout, and a period picker defaults to the current week, month, or year.
- **Schema change**: Unlike feature 008, this feature changes the database: two stored amounts on remittances, a date lookup index, and a one-time backfill. It's covered by an ordered migration with database tests, as the constitution requires.
- **Screenshots**: The sample's blank Allowance cells and inconsistent row figures are data-entry mistakes; the written rules decide every value. The three attached images (yearly sheet, a weekly block, and the end of a monthly sheet with its GRAND TOTAL) are the reference for layout and formatting.

## Constitution Compliance

| Principle | How this spec complies |
|-----------|------------------------|
| I. Free-Tier Sustainability | The XLSX files are generated by the existing app; no paid service is needed |
| II. Monolithic Simplicity | The XLSX reports replace the CSV on the existing Reports page; no new service |
| III. Data Integrity and Auditability | Amounts are in centavos. Allowance and deposit are stored and kept equal to the payments under database control. The overpayment rule is enforced at every entry point. The backfill preserves existing facts and is migration-based (FR-005, FR-006, FR-007, FR-016) |
| IV. Mobile-First, Human-Centered Operations | The card breakdown and messages use plain language. Red negatives always carry a minus sign. Everything works at 360 px (FR-013, SC-008) |
| V. Compliance Document Lifecycle | Not affected |
