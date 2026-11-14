# Contract: Distribution workbook

One workbook, one sheet named **Distribution**, built by `buildDistributionWorkbook(details)` (a pure function) and written with `workbookBytes` from `lib/reports/xlsx.ts`.

## Page setup (from the shared writer, tested in feature 014)

| Setting | Value |
|---------|-------|
| Paper | A4 (`paperSize="9"`) |
| Orientation | Portrait |
| Fit | 1 page wide and 1 page tall (`fitToPage`, `fitToWidth="1"`, `fitToHeight="1"`) |
| Margins (inches) | Narrow: left 0.25, right 0.25, top 0.75, bottom 0.75, header 0.3, footer 0.3 |
| Centering | Horizontally centered |

A unit test reads the generated sheet XML and asserts these values.

## Rows and columns

Columns (widths in characters): A `Rank` 7, B `Participant` 34, C `Ended total savings` 22, D `Distributed share` 20.

| Row | Content |
|-----|---------|
| 1 | Title: "Sinking fund distribution {year}" (merged A:D); voided distributions add " (VOIDED)" |
| 2 | Date, participants who took part, Interest fund distributed, and what stayed in the fund, in one subtitle line (merged A:D) |
| 3 | "Sinking fund total for the year" (merged A:C) and the sum of ended total savings in D ("Not recorded" for legacy) |
| 4 | Table header: Rank, Participant, Ended total savings, Distributed share |
| 5 to n | One row per participant, highest ended total first; ties by name; legacy rows (no ended total) last with "Not recorded" |
| n+1 | Totals row: "Total", sum of ended totals, sum of shares (live `SUM` formulas) |
| after | When the distribution has notes: a spacer row and a "Notes:" row (cut to 120 characters) |

Money cells are pesos with two decimals (the new `CENTS_FORMAT` styles `amountCents`, `subAmountCents`, `grandAmountCents` in `lib/reports/xlsx.ts`), converted from whole centavos with the shared writer. Rows 1 to 4 are the frozen header block the shared writer already expects (it freezes four rows). 

## Acceptance (spec SC-011, FR-041 to FR-044)

- The on-screen details table and the sheet list the same rows in the same order with the same totals.
- With 50 participants the sheet prints on one page; the page setup values above hold for any count.
