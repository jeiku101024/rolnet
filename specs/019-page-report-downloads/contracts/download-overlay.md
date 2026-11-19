# Contract: Download button and overlay (shared)

Used by Remittances, Sinking fund (standings) and Expenses.

## Button

- Icon: spreadsheet/workbook (`FileSpreadsheet`), icon-only, 44 px touch target.
- `aria-label`: "Download report" (Sinking fund: "Download monthly standings").
- Tooltip with the same text, shown on hover and keyboard focus.
- Placement: end of the page's content toolbar row (see plan Design Notes 2). Never in the page header.
- Not rendered when the viewer may not use that download (Remittances: no `export_reports`; Standings: not owner).

## Overlay

- Modal Base UI dialog titled "Download report" (Sinking fund: "Monthly standings").
- Closes on Escape, the close button (`aria-label="Close"`), and outside click. Focus is trapped while open and returns to the button on close.
- Content is mounted only while open, so each open starts from the defaults.
- Width: `max-w-lg`, inset 16 px on a 360 px screen, scrolls if taller than the viewport.

## Card states

| State | Behavior |
|-------|----------|
| idle | Fields at defaults; "Download .xlsx" enabled |
| pending | Button shows a pending label ("Creating report…"), disabled; fields remain |
| success | Status line "Report downloaded: <file name>."; overlay stays open |
| error | Plain-language message and a "Retry" button; overlay stays open; selections kept |

## Remittances card

The existing `ReportExportForm` fields and validation, unchanged: Weekly | Monthly | Yearly (select on narrow screens), period selectors, Scope, Unit, "Download .xlsx".
