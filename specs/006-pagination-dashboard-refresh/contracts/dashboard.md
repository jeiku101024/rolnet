# Contract: Dashboard

Owner-only (`view_dashboard`). Current fleet month and fleet "today" from `lib/dates/fleet-date.ts`.

## Section order

| # | Band | Panels | Phone | `md`+ |
|---|---|---|---|---|
| 1 | Needs attention | Expiring documents · Due maintenance · Unpaid balances | stacked | 2 cols (`md`), 3 cols (`xl`) |
| 2 | Fleet status | Extradors · Units in repair | stacked | 2 cols |
| 3 | This month | Headline tiles · Collected vs expenses per unit · Daily collections | tiles stacked 2 per row; charts behind "Show charts" | tiles in one row (`xl`); charts 2 cols (`lg`), always shown |
| 4 | Recent activity | Remittances · Expenses · Maintenance work · Documents added | behind "Show recent activity" | 2 × 2, always shown |

## Panel rules (all panels)

- At most 5 items (3 visible on phones). When rows are hidden, footer link "View all {total}" → target list.
- Empty → one-line plain-language message (never hidden). Examples: "No documents expire in the
  next 30 days.", "No maintenance is due.", "Every driver is paid up.", "No units are in repair.",
  "No active extradors."
- Status shown with icon + text + colour (DESIGN.md).

| Panel | Ordering | Each row shows | Row link | View all |
|---|---|---|---|---|
| Expiring documents | expired first, then soonest | type, holder, "Expired N days ago" / "Expires in N days" / "Expires today" | `/documents/[id]` | `/documents?expiring=1` |
| Due maintenance | urgency desc (R7) | item, Body X, "N days overdue" and/or "N km past due" | `/maintenance/[unitId]` | `/maintenance?due=1` |
| Unpaid balances | amount desc, oldest first on ties | driver, amount, "N unpaid days since DATE" | `/drivers/[id]` | `/remittances?balance=unpaid` |
| Extradors | assigned first, then name | name, phone, "Body X today" or "Not assigned" | `/drivers/[id]` | `/drivers?kind=backup` |
| Units in repair | longest first, unknown last | Body X, plate, "In repair for N days" / "In repair" | `/units/[id]` | `/units?status=in_repair` |
| Recent (each kind) | newest first | as today | record page | list page |

## Statistics

Tiles: Collected this month · Expenses this month · Net income · Units on the road / in repair ·
Documents due (expired or ≤ 30 days) · Maintenance due. Money via `formatPesos`; ₱0.00 when empty.

Charts:
- **Collected vs expenses per unit** — two labelled bars per unit plus exact amounts and net as
  text. Replaces the monthly unit summary table. Empty month → "No remittances or expenses
  recorded this month yet."
- **Daily collections** — one column per day (1st → today), axis labels for first/last day, a
  visible total, and an `sr-only` summary (total, best day, days with nothing collected).
- Totals MUST equal `monthly_report(month)` sums to the centavo.

## Removed

`MonthlyUnitSummary` table, "Recent units" and "Recent drivers" panels, and the duplicated
"Maintenance activity" list of due items.
