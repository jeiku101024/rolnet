# Feature Specification: Reports Page XLSX Downloads

**Feature Branch**: `014-reports-xlsx-downloads`

**Created**: 2026-11-03

**Status**: Draft

**Input**: User description: "REPORTS PAGE XLSX DOWNLOADS (client: Rolnet) — Weekly, Monthly, and Yearly reports, each for All units or a Single unit." (The full description, sections 1 to 12 plus acceptance criteria, was supplied with the `/speckit-specify` command together with six reference workbooks. Each requirement below reflects it.)

## Reference Files

The six client mocks are stored in [`reference/`](reference/) and are the exact target for layout,
styling, formulas, and print setup:

| File | Report | Scope |
|------|--------|-------|
| `rolnet-monthly-2026-10-all-units-MOCK.xlsx` | Monthly | All units |
| `rolnet-monthly-2026-10-DHDMM1-MOCK.xlsx` | Monthly | Single unit |
| `rolnet-weekly-2026-10-26-all-units-MOCK.xlsx` | Weekly | All units |
| `rolnet-weekly-2026-10-26-DHDMM1-MOCK.xlsx` | Weekly | Single unit |
| `rolnet-yearly-2026-all-units-MOCK.xlsx` | Yearly | All units |
| `rolnet-yearly-2026-DHDMM1-MOCK.xlsx` | Yearly | Single unit |

If this spec and a mock disagree on layout, styling, formulas, or print setup, the mock wins. All
numbers, drivers, unit names, and the "MOCK DATA" note in the mocks are sample content and MUST NOT
appear in real exports. A single-unit workbook is identical to that unit's sheet in the all-units
workbook.

## Clarifications

### Session 2026-11-03

- Q: The written spec says unit tabs are in natural alphabetical order, but the mocks show DHDMM1,
  DHDMM2, DRECB2, DKQLM3, DNPTV4. Which order? → A: Natural alphabetical by unit name. The mock order
  is sample data. Real units are named like "rolnet-1", "rolnet-2", …, so numbers must sort by value
  ("rolnet-2" before "rolnet-10") (FR-010).

## Context

Feature 009 added Weekly, Monthly, and Yearly .xlsx downloads on the Reports page. Each produces one
sheet ("Monthly", "Yearly", …) mixing all units, with Week, Day, Month, and Year columns, and writes a
stored Deposit equal to payment received minus allowance (which can be negative).

The client wants a per-unit workbook layout instead: an "All units" summary sheet linking to one
sheet per unit, actual calendar dates instead of Week/Day/Month/Year columns, Deposit defined as
Rental minus Allowance, every sheet printable on one A4 page, and a matching single-unit download.
This feature replaces the 009 report formats and aligns the app's Deposit figures with the new rule.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Download the Monthly report (Priority: P1)

The owner opens Reports, picks Monthly, chooses October 2026 and "All units", and taps Download. They
get `rolnet-monthly-2026-10-all-units.xlsx` with an "All units" summary first and one sheet per unit.
Each unit sheet lists every calendar day of the month, grouped into Monday-to-Sunday weeks, each week
followed by its Subtotal, Expenses, Allowance, and Net rows, then a GRAND TOTAL block. Picking
"Single unit" and a unit gives that unit's sheet alone.

**Why this priority**: The monthly workbook is the client's main bookkeeping document and the most
complex layout; weekly and yearly reuse its look and rules.

**Independent Test**: For October 2026 with known remittances and expenses for unit DHDMM1, download
Monthly / All units and Monthly / Single unit (DHDMM1). Compare both against the monthly mocks for
layout, styles, formulas, and print setup, and check the numbers against the records.

**Acceptance Scenarios**:

1. **Given** October 2026 (the 1st is a Thursday), **When** the monthly sheet is built, **Then** Week 1
   (Oct 1–4) occupies rows 5 to 8, its subtotal row 9, Expenses 10, Allowance 11, Net 12; Week 2
   (Oct 5–11) rows 13 to 19 and 20 to 23; Week 3 rows 24 to 30 and 31 to 34; Week 4 rows 35 to 41
   and 42 to 45; Week 5 (Oct 26–31) rows 46 to 51 and 52 to 55; GRAND TOTAL row 56, Expenses 57,
   Allowance 58, Net 59.
2. **Given** that layout, **When** the formulas are read, **Then** D5 is `=C5-E5`, C9 is `=SUM(C5:C8)`,
   C11 is `=E9`, C12 is `=C11-C10`, C56 is `=C9+C20+C31+C42+C52`, C57 is `=C10+C21+C32+C43+C53`,
   C58 is `=E56`, C59 is `=C58-C57`, and the summary row for DHDMM1 reads B5 `='DHDMM1'!C56`,
   C5 `='DHDMM1'!D56`, D5 `='DHDMM1'!E56`, E5 `='DHDMM1'!C57`, F5 `='DHDMM1'!C59`.
3. **Given** a day with no remittance, **When** its row is written, **Then** it shows the date
   ("Sat, Oct 3") and blank Driver, Rental, Deposit, and Allowance cells, with no Deposit formula.
4. **Given** a month that starts on a Sunday, **When** it is built, **Then** it has 6 week blocks, the
   first being a one-day week labelled e.g. "Week 1 Subtotal  ·  Nov 1".
5. **Given** a month with no remittances at all, **When** Download is tapped, **Then** a file is still
   produced with every date listed and the amount cells blank or "-".
6. **Given** the downloaded file, **When** it is opened in Excel, **Then** there is no repair prompt and
   no formula error, and **when** it is previewed on a phone or in a web viewer without
   recalculation, **then** every formula cell shows its number.

---

### User Story 2 - Download the Weekly report (Priority: P2)

The owner picks Weekly, chooses any date, sees the resulting range (e.g. "Oct 26 – Nov 1, 2026"), and
downloads `rolnet-weekly-2026-10-26-all-units.xlsx` (or `…-[unit].xlsx`). Each unit sheet lists
exactly the seven days Monday to Sunday, followed by one Week Subtotal block.

**Why this priority**: Used for the weekly cash check; reuses the monthly sheet layout with one block.

**Independent Test**: Download Weekly for 2026-10-28 (Oct 26 – Nov 1) and compare with the weekly mocks;
confirm its rows equal the matching rows in the October and November monthly reports.

**Acceptance Scenarios**:

1. **Given** the week of Oct 26 – Nov 1, 2026, **When** it is built, **Then** the title band reads
   "Week of Oct 26 – Nov 1, 2026", date rows are 5 to 11 (one per day; legacy duplicates add rows,
   see FR-025), "Week Subtotal  ·  Oct 26–Nov 1" is row 12,
   Expenses 13, Allowance 14, Net 15, and there is no GRAND TOTAL block.
2. **Given** that layout, **When** formulas are read, **Then** C12 is `=SUM(C5:C11)`, C14 is `=E12`,
   C15 is `=C14-C13`, and the DHDMM1 summary row reads `='DHDMM1'!C12`, `…!D12`, `…!E12`, `…!C13`,
   `…!C15`.
3. **Given** a week inside one month, **When** it is built, **Then** the title reads e.g.
   "Week of Oct 19 – 25, 2026"; **given** a week across years, **then** it reads
   "Week of Dec 28, 2026 – Jan 3, 2027".
4. **Given** the current week, **When** it is downloaded, **Then** future days still appear with their
   date and blank amounts.
5. **Given** expenses on Oct 30 and Nov 1 for a unit, **When** the week Oct 26 – Nov 1 is built,
   **Then** its Expenses row includes both.

---

### User Story 3 - Download the Yearly report (Priority: P2)

The owner picks Yearly, chooses 2026, and downloads `rolnet-yearly-2026-all-units.xlsx` (or
`…-[unit].xlsx`). Each unit sheet has twelve month rows, then Year Subtotal, Expenses, Allowance,
Net, and a GRAND TOTAL block.

**Why this priority**: Used for annual review; same look, simpler layout.

**Independent Test**: Download Yearly 2026 and compare with the yearly mocks; confirm each month row
equals that month's monthly GRAND TOTAL for the unit.

**Acceptance Scenarios**:

1. **Given** 2026, **When** a unit sheet is built, **Then** rows 5 to 16 are January to December
   (shown as "January" … "December"), row 17 "Year Subtotal  ·  Jan–Dec", 18 Expenses, 19 Allowance,
   20 Net, 21 GRAND TOTAL, 22 Expenses, 23 Allowance, 24 Net.
2. **Given** a month with no remittances, **When** it is shown, **Then** Rental, Deposit, and Allowance
   display "-".
3. **Given** the summary sheet, **When** the DHDMM1 row is read, **Then** it is B5 `='DHDMM1'!B21`,
   C5 `='DHDMM1'!C21`, D5 `='DHDMM1'!D21`, E5 `='DHDMM1'!B22`, F5 `='DHDMM1'!B24`.

---

### User Story 4 - App Deposit figures match the reports (Priority: P2)

The Remittances daily card breakdown, the List view Deposit column, and stored records show
Deposit = Rental − Allowance, so what the owner sees in the app equals what the export shows.

**Why this priority**: Without it the app and the exports disagree, which undermines trust in both.

**Independent Test**: On a Returned card with Rental ₱180.00, type 100 in Payment received: the
breakdown reads Allowance ₱40.00 and Deposit ₱140.00. Existing records with partial payments show
Deposit = Rental − Allowance in List view after release.

**Acceptance Scenarios**:

1. **Given** a ₱180 rental and ₱40 allowance, **When** any payment (0, 100, 180) is typed, **Then** the
   live breakdown shows Deposit ₱140.00.
2. **Given** a record saved earlier with a partial payment or a negative deposit, **When** List view
   loads after release, **Then** its Deposit equals its Rental minus its Allowance.

---

### User Story 5 - Report form usability (Priority: P3)

On a 360 px phone, the owner selects report type, scope (All units / Single unit with a unit
dropdown), and period, then taps Download. A loading state shows while the file is generated; on
failure a plain error message with Retry appears.

**Independent Test**: At a 360 px viewport, complete each of the six type/scope combinations without
horizontal scrolling; simulate a server failure and confirm the error and Retry work.

**Acceptance Scenarios**:

1. **Given** Single unit scope for a period, **When** the unit dropdown opens, **Then** it lists every
   non-archived unit plus archived units that have a remittance or expense in that period.
2. **Given** Weekly, **When** a date is chosen, **Then** the Monday-to-Sunday range containing it is
   shown (e.g. "Oct 26 – Nov 1, 2026").
3. **Given** a generation failure, **When** it happens, **Then** the user sees an error explaining the
   download failed and a Retry button that repeats the same request.
4. **Given** the form, **When** it is shown, **Then** only .xlsx is offered (no CSV).

---

### Edge Cases

- A unit named with `: \ / ? * [ ]`, a leading or trailing apostrophe, more than 31 characters, or
  colliding with another unit's sheet name after cleaning → sheet name is cleaned, cut, and suffixed
  " (2)", " (3)" within 31 characters; formulas and hyperlinks still resolve.
- A unit named "All units" → its sheet is "All units (unit)".
- Units "rolnet-1" to "rolnet-100" → tabs and summary rows run rolnet-1, rolnet-2, … rolnet-10, … rolnet-100;
  single-unit file names read e.g. `rolnet-monthly-2026-10-rolnet-1.xlsx`.
- A unit name containing an apostrophe (e.g. `Mang Ben's`) → formulas and hyperlinks quote the name
  and double the apostrophe (`'Mang Ben''s'!C56`).
- A unit name with characters not allowed in file names → those characters are removed from the
  single-unit file name.
- Legacy data with two remittances for one unit on one day → two rows with the same date, both
  counted in the subtotal.
- An archived unit with no remittance or expense in the period → no sheet and not in the dropdown.
- A non-archived unit with no records → a sheet with dates/months and blank or "-" amounts, and a
  summary row of "-".
- A week crossing two months or two years → shown whole, never split.
- A 6-week month → still prints on one A4 page (slightly smaller).
- About 100 units → the all-units workbook (101 sheets) still generates in about 10 seconds.
- Amounts with centavos (none expected today) → the cell holds the exact value; the display format
  shows whole pesos.

## Requirements *(mandatory)*

### Functional Requirements

**Reports page**

- **FR-001**: The Reports page MUST offer three report types — Weekly, Monthly, Yearly — and two scopes —
  All units and Single unit.
- **FR-002**: Single unit scope MUST show a unit dropdown listing every non-archived, non-deleted unit
  plus archived units with at least one remittance or expense in the chosen period.
- **FR-003**: The period MUST be chosen as: Weekly — any date, selecting the Monday-to-Sunday week that
  contains it, with the resulting range shown (e.g. "Oct 26 – Nov 1, 2026"); Monthly — month and year;
  Yearly — year.
- **FR-004**: A Download button MUST produce the .xlsx; a loading state MUST show during generation and
  a plain-language error with a Retry action MUST show on failure. Only .xlsx is offered.
- **FR-005**: A period with no remittances MUST still produce a file.
- **FR-006**: File names MUST be `rolnet-weekly-YYYY-MM-DD-all-units.xlsx` / `rolnet-weekly-YYYY-MM-DD-[unit].xlsx`
  (date = the week's Monday), `rolnet-monthly-YYYY-MM-all-units.xlsx` / `rolnet-monthly-YYYY-MM-[unit].xlsx`,
  and `rolnet-yearly-YYYY-all-units.xlsx` / `rolnet-yearly-YYYY-[unit].xlsx`. In `[unit]`, characters
  not allowed in file names (`\ / : * ? " < > |` and control characters) are removed, runs of spaces
  become "-", leading and trailing dots and dashes are trimmed, and an empty result becomes "unit"
  (e.g. `rolnet-1` stays `rolnet-1`).
- **FR-007**: These formats MUST replace the feature 009 report formats (single mixed sheet with Week,
  Day, Month, Year columns).

**Sheets and names**

- **FR-010**: An All units workbook MUST contain the "All units" summary sheet first, then one sheet
  per unit in natural alphabetical order by unit name: case-insensitive, with runs of digits compared
  by numeric value, so "rolnet-1", "rolnet-2", … "rolnet-9", "rolnet-10", "rolnet-11", … "rolnet-100"
  (never "rolnet-1", "rolnet-10", "rolnet-100", "rolnet-2"). Summary rows MUST follow the same order
  as the tabs.
- **FR-011**: A Single unit workbook MUST contain only that unit's sheet: no summary sheet, no notes.
- **FR-012**: The sheet name MUST be the unit name with `: \ / ? * [ ]` replaced by "-", leading and
  trailing apostrophes and spaces trimmed (an empty result becomes "Unit"), cut to 31 characters, and
  duplicates suffixed " (2)", " (3)"… within 31 characters. A unit named "All units" (in any letter
  case) MUST get the sheet "All units (unit)". Duplicates are compared ignoring letter case, as Excel
  does.
- **FR-013**: Every formula and hyperlink referring to another sheet MUST quote the sheet name and double
  any apostrophe inside it.
- **FR-014**: Tab colors MUST be 1F3864 for "All units" and 2F5496 for unit sheets.
- **FR-015**: Every non-archived unit MUST get a sheet, even with no records in the period; an archived
  unit MUST get a sheet only if it has at least one remittance or expense in the period. Deleted
  units and deleted records MUST be excluded.

**Data rules**

- **FR-020**: Weeks MUST run Monday to Sunday, and the business timezone MUST decide which date a record
  belongs to.
- **FR-021**: Rental MUST be the remittance's rental (amount due). Allowance MUST be the allowance stored
  on the remittance record; the export MUST NOT assume a fixed allowance.
- **FR-022**: Deposit MUST be written as the formula Rental − Allowance in every row that has a
  remittance, regardless of the amount paid; stored deposit values MUST NOT be written.
- **FR-023**: Expenses MUST be the total of the unit's non-deleted expenses by expense date within the
  block's range (the week block, clipped to the month on monthly sheets; the 7 days on weekly sheets;
  the year on yearly sheets), written as a plain number (0 when none).
- **FR-024**: Net MUST equal Allowance − Expenses.
- **FR-025**: Weekly and monthly sheets MUST have one row per calendar day per unit. Two remittances for
  the same unit and day MUST produce two rows with the same date. Days with no remittance MUST still
  appear with the date and blank Driver, Rental, Deposit, and Allowance cells.
- **FR-026**: Driver MUST be the name of the driver the remittance was saved under, as shown on the
  Drivers list.
- **FR-027**: Dates MUST be real date values without a time.

**Common look** (exact values; matches the mocks)

- **FR-030**: Every written cell MUST use Arial: 16 for the title band, 11 for the second header line,
  10 elsewhere.
- **FR-031**: Every amount (Rental, Deposit, Allowance, subtotals, totals, Expenses, Net, all summary
  figures) MUST use the number format `#,##0;[Red]-#,##0;"-"`.
- **FR-032**: Row 1 (title band) MUST be merged across all the sheet's columns: bold white on navy
  1F3864, left aligned with indent 1, vertically centered, height 30, text = the period.
- **FR-033**: Row 2 MUST be merged across all columns with "Unit [name]  ·  [Weekly|Monthly|Yearly] report"
  (or "All units  ·  [type] report" on the summary; two spaces each side of the middle dot): Arial 11
  bold, navy text on D9E2F3, indent 1, vertically centered, height 20.
- **FR-034**: Row 3 MUST be an empty spacer of height 10. Row 4 MUST hold column headers: bold white on
  2F5496, height 20, vertically centered, first column left with indent 1, text columns left, amount
  columns right.
- **FR-035**: Panes MUST be frozen below row 4 (A5 first scrolling cell).
- **FR-036**: Date and month rows MUST have a thin BFBFBF bottom border across the table width, including
  blank days.
- **FR-037**: Subtotal rows MUST be bold with D9E2F3 fill across the table width, label in column A
  (left, indent 1), amounts right aligned.
- **FR-038**: "Expenses:", "Allowance:", "Net:" rows MUST have the label in column A (left, indent 2)
  and the value only in the first amount column (C on weekly/monthly sheets, B on yearly); Expenses and
  Allowance italic, Net bold; other cells empty.
- **FR-039**: The GRAND TOTAL row (where used) MUST have a bold label with indent 1, bold amounts, and a
  medium black border on top and bottom across the table width; the three rows after it are bold
  (Expenses and Allowance also italic) with labels at indent 2.

**All units summary sheet**

- **FR-040**: Columns A to F MUST be Unit | Rental | Deposit | Allowance | Expenses | Net, widths A 26 and
  B–F 15, with the common title band, second line, headers (Unit left indent 1, rest right), and
  frozen panes.
- **FR-041**: From row 5, one row per unit in tab order: A = unit name as an internal hyperlink to that
  sheet's A1 (Arial 10, underlined, 0563C1, indent 1); B–F = formulas linking to the unit sheet (Arial
  10, green 007A33, right aligned); thin bottom border A–F.
- **FR-042**: Directly after the last unit, an "ALL UNITS" total row (bold, indent 1) MUST have
  `=SUM(B5:B{last})` and likewise for C–F, bold, with a medium black border on top and bottom across A–F.
- **FR-043**: Two rows below the total, a "Notes" block MUST appear: "Notes" (bold), then one row per
  line merged across A–F, wrapped, top aligned, Arial 10 italic grey 595959, height 15 for lines up to
  about 112 characters and 28 for longer lines. The lines are, per report type:
  - Monthly:
    1. Layout: one sheet per unit (tab name = unit name) plus this All units summary. Each sheet has the month and year as its header.
    2. Dates: each row is the actual calendar date. Weekly blocks are Monday to Sunday and are labeled with their date range.
    3. Rental and Allowance come from the remittance records (Allowance is 40 per remittance). Deposit = Rental - Allowance, whatever was paid that day.
    4. Expenses: total from the Expenses table for that unit and week.
    5. Net = Allowance - Expenses. Subtotals, totals, and Net are live formulas. Green numbers on this sheet link to the unit sheets.
    6. Days with no remittance (unassigned, day-off, repair) are listed with the date and blank amounts.
  - Weekly:
    1. Layout: one sheet per unit (tab name = unit name) plus this All units summary. Each sheet has the week as its header.
    2. Dates: each row is the actual calendar date. The week runs Monday to Sunday and can cross two months.
    3. Rental and Allowance come from the remittance records (Allowance is 40 per remittance). Deposit = Rental - Allowance, whatever was paid that day.
    4. Expenses: total from the Expenses table for that unit and week.
    5. Net = Allowance - Expenses. Subtotals and Net are live formulas. Green numbers on this sheet link to the unit sheets.
    6. Days with no remittance (unassigned, day-off, repair) are listed with the date and blank amounts.
  - Yearly:
    1. Layout: one sheet per unit (tab name = unit name) plus this All units summary. Each sheet has the year as its header.
    2. Months: January to December, one row each. Months with no remittances show as -.
    3. Rental and Allowance are the month's totals from the remittance records. Deposit = Rental - Allowance.
    4. Expenses: total from the Expenses table for that unit and year.
    5. Net = Allowance - Expenses. Subtotals and Net are live formulas. Green numbers on this sheet link to the unit sheets.

  The mocks' "MOCK DATA" line MUST NOT be included.

**Monthly unit sheet (columns A–E)**

- **FR-050**: Title band: English full month name and four-digit year (e.g. "October 2026"). Headers:
  Date | Driver | Rental | Deposit | Allowance (Date, Driver left; rest right). Widths A 36, B 24,
  C–E 17.
- **FR-051**: From row 5, for each Monday-to-Sunday week overlapping the month, in order: one row per day
  of that week inside the month (A = date formatted `ddd, mmm d`, left, indent 1; B driver; C Rental;
  D Deposit formula; E Allowance); then a subtotal row "Week [n] Subtotal  ·  [range]" (n counts from 1
  for the week containing the 1st; range is the week's first and last day inside the month as
  "Oct 1–4", "Oct 5–11", or "Nov 1" for a one-day week, en dash without spaces) with C, D, E =
  `SUM` of the block's date rows; then Expenses, Allowance (`=E{S}`), and Net (`=C{S+2}-C{S+1}`) rows.
  No blank rows between blocks.
- **FR-052**: After the last week, a GRAND TOTAL block: GRAND TOTAL row with C, D, E = sum of the weekly
  subtotal cells (`=C{S1}+…+C{Sn}`); Expenses = sum of the weekly Expenses cells; Allowance = `=E{G}`;
  Net = `=C{G+2}-C{G+1}`.
- **FR-053**: Every row from row 5 to the end MUST be height 13.
- **FR-054**: Summary links (G = GRAND TOTAL row): B `=C{G}`, C `=D{G}`, D `=E{G}`, E `=C{G+1}`, F `=C{G+3}`.

**Weekly unit sheet (columns A–E)**

- **FR-060**: Title band: "Week of Oct 19 – 25, 2026" (same month), "Week of Oct 26 – Nov 1, 2026"
  (across months), "Week of Dec 28, 2026 – Jan 3, 2027" (across years); month abbreviation, day,
  spaced en dash.
- **FR-061**: Headers, widths, and date-row cells MUST be identical to the monthly sheet. Rows 5 to 11
  MUST be exactly the 7 days Monday to Sunday (more only when legacy duplicates exist, per FR-025).
- **FR-062**: After the date rows, one block only: "Week Subtotal  ·  [range]" (no number; month
  abbreviation on both sides when crossing months, e.g. "Oct 26–Nov 1"), Expenses (all 7 days),
  Allowance, Net — same formulas as a monthly block. No GRAND TOTAL block.
- **FR-063**: Every row from row 5 to the end MUST be height 16.
- **FR-064**: Summary links (S = subtotal row): B `=C{S}`, C `=D{S}`, D `=E{S}`, E `=C{S+1}`, F `=C{S+3}`.

**Yearly unit sheet (columns A–D)**

- **FR-070**: Title band: the four-digit year. Headers: Month | Rental | Deposit | Allowance (Month left;
  rest right). No Year column. Widths A 30, B–D 24.
- **FR-071**: Rows 5–16 MUST be January to December: A = the 1st of the month as a real date formatted
  `mmmm`, left, indent 1; B = month's total Rental; D = month's total Allowance; C = `=B{r}-D{r}`.
  Months without remittances hold 0 (shown "-").
- **FR-072**: Row 17 "Year Subtotal  ·  Jan–Dec" (subtotal style) with B, C, D = `SUM` of rows 5–16;
  row 18 Expenses B = the unit's expenses for the year; row 19 Allowance B `=D17`; row 20 Net
  B `=B19-B18`.
- **FR-073**: Rows 21–24 GRAND TOTAL block: row 21 B `=B17`, C `=C17`, D `=D17`; row 22 B `=B18`;
  row 23 B `=D21`; row 24 B `=B23-B22`.
- **FR-074**: Every row from row 5 to the end MUST be height 16.
- **FR-075**: Summary links: B `=B21`, C `=C21`, D `=D21`, E `=B22`, F `=B24`.

**Formulas and file integrity**

- **FR-080**: Subtotals, grand totals, Allowance and Net rows, Deposit cells, and all summary figures
  MUST be live formulas; computed totals MUST NOT be written as plain numbers.
- **FR-081**: Every formula cell MUST also carry its calculated value, so previews that do not
  recalculate (phone, email, Drive) show the numbers.
- **FR-082**: The file MUST open in Excel with no repair prompt and no formula errors.

**Print setup (every sheet, including All units)**

- **FR-090**: A4 paper (paper size 9), portrait, fit to 1 page wide by 1 page tall.
- **FR-091**: Margins MUST be exactly Excel's "Narrow" preset: top 0.75", bottom 0.75", left 0.25",
  right 0.25", header 0.3", footer 0.3".
- **FR-092**: Content MUST be centered horizontally on the page. Unit sheets MUST repeat rows 1:4 as print
  titles. No page header or footer text.

**Performance and limits**

- **FR-100**: An All units workbook for about 100 units MUST generate in about 10 seconds or less, writing
  sheets one at a time rather than holding every sheet's content in memory at once.
- **FR-101**: Summary hyperlinks MUST work for every unit, including those with long or unusual names.

**Consistency with the rest of the app**

> **Superseded (2026-11-03, owner decision):** FR-110 and FR-111 were reversed after testing. The app keeps feature 009's
> Deposit = payments − allowance (migration `20261103000300_restore_payments_deposit_rule.sql`). The report
> workbooks keep Deposit = Rental − Allowance (FR-022), as in the client's mocks.

- **FR-110**: The Remittances daily card live breakdown, the List view Deposit column, the remittance
  detail page, and each stored remittance's deposit MUST use Deposit = Rental − Allowance. This supersedes feature 009's rule
  (payment received − allowance) and its negative-deposit display for this figure.
- **FR-111**: Existing remittance records MUST be backfilled to the new Deposit rule as a derived-value
  correction: no hard deletes, no change to `updated_at` or `updated_by`, and no new business audit
  events (the same approach as feature 009's backfill). The migration MUST document the old rule
  (active payments − allowance) so any record's previous deposit can be recomputed from its payments.
- **FR-112**: No new tables are needed; units, drivers, remittances, and expenses come from existing data.

### Key Entities

- **Unit**: a tricycle; provides the sheet name, archive status, and inclusion rule.
- **Remittance**: one unit's record for one service date; provides Driver, Rental (amount due),
  Allowance, and (after FR-110) Deposit = Rental − Allowance.
- **Expense**: a cost recorded against a unit on an expense date; summed per block.
- **Report request**: type (weekly/monthly/yearly), scope (all units / one unit), and period; determines
  file name, sheets, and rows. Not stored.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All six type/scope combinations download a file whose structure, styles, formulas, column
  widths, row heights, freeze panes, merges, and print setup match the corresponding mock, with zero
  differences other than data.
- **SC-002**: 100% of generated files open in Excel without a repair prompt or formula error, and show
  every figure in a phone or web preview without recalculation.
- **SC-003**: Every sheet of every report prints on exactly one A4 portrait page, and Excel's Page Setup
  labels the margins "Narrow".
- **SC-004**: An All units report for 100 units downloads in 10 seconds or less.
- **SC-005**: For the same unit, every weekly report row equals the matching monthly row, each yearly
  month total equals that month's monthly GRAND TOTAL, and the summary's ALL UNITS row equals the sum
  of the unit sheets.
- **SC-006**: After release, the Deposit shown in the app for any remittance equals the Deposit in its
  report row.
- **SC-007**: The owner completes any report download at a 360 px viewport in under 30 seconds without
  horizontal scrolling or help.

## Assumptions

- Only the owner can use the Reports page, as today (feature 009).
- The notes text in FR-043 is the client's fixed wording, including "Allowance is 40 per remittance".
  It is written verbatim even though the figures themselves come from each record (FR-021); if the
  allowance rate ever changes, the notes text is updated in a later feature.
- The Driver cell is the driver's full name as the Drivers list shows it today; role codes such as
  "P1" or "B1" in the mocks are sample content.
- "Non-archived" units include active and retired units that are not archived; deleted units never
  appear.
- The business timezone is the app's existing fleet timezone (Asia/Manila).
- Rentals and allowances are whole pesos today; the export writes exact peso values and the specified
  format displays them without centavos.
- Monthly week blocks' Expenses count only expense dates inside the month (a week crossing months is
  split between the two monthly reports); the weekly report counts all 7 days.
- Yearly Rows 17 and 21 intentionally show the same figures because a year is one block; this mirrors
  the client's current yearly file.
- The weekly date picker accepts any date; years offered for Monthly and Yearly match the current form.
- The new Deposit rule means records with partial or no payment will show a higher Deposit than before;
  the client accepts this change.
- The writer used must be free, run inside the single deployed app on its free hosting tier, and
  produce cached formula values (Constitution I and II).
