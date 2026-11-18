# Research: Dashboard Refinements

No `NEEDS CLARIFICATION` items remain. Decisions:

## R1. Equal-height cards

- **Decision**: In `page.tsx` change the charts grid from `items-start` to default stretch (`lg:grid-cols-2`), make both `Card`s `h-full`, and make `DailyTrendChart`'s `CardContent` a flex column whose `<figure>` grows (`flex-1`), with the SVG using `flex-1 min-h-32` instead of fixed `h-32`.
- **Rationale**: CSS grid stretch gives equal height with no JS. The right card's height is now stable (top 5 units, see R2), so the left card fills it. Works at every unit count (SC-001).
- **Alternatives**: Fixed pixel heights (arbitrary sizes, break on phones); JS height sync (fragile, flashes).

## R2. Pop-up for all units

- **Decision**: New client component `unit-income-dialog.tsx` using the existing `Dialog`/`DialogContent` with `fixedHeader` (title and close stay visible while the list scrolls) and a scrolling body. The card renders the top 5 on the server; the dialog receives the full `bars` array as props (already loaded, so nothing is refetched on close).
- **Rationale**: Reuses the dialog the Sinking fund modals use (Escape, outside click, focus trap built in). Closing is purely client state (FR-006).
- **Alternatives**: Route-based modal (reloads/refetches, rejected by clarification); `<details>` (the cause of the bug).
- **Note**: `UnitRows` is shared by the card and the dialog, so it moves to a shared export. Verify outside-click dismissal in e2e.

## R3. Unpaid sinking fund loans data

- **Decision**: Live: `sf_loans_v` selecting `participant_id, balance_centavos, overdue, due_date` where `status = 'open'`, plus `sf_participants` (`id, name`, not deleted; archived participants are kept so an open loan is never hidden), added to the existing `Promise.all`; grouped per participant in a pure `orderUnpaidLoans()`. Demo: `openLoans(buildLoans(demoSfData, today))` with `demoSfParticipants`.
- **Rationale**: The view already derives open/overdue/balance, so no new SQL function or migration (no EXECUTE grants, no pgTAP). RLS (`is_approved_user`) covers the owner who sees the dashboard.
- **Alternatives**: New RPC (needs migration, grants, pgTAP; unnecessary); reuse `loadSinkingFund` (heavy, loads unrelated data).
- **Edge**: a loan whose participant cannot be found is skipped.

## R4. Ordering, rows and layout of the third card

- **Decision**: One row per participant with the combined balance, largest first (ties by name). If any loan is overdue, show an "Overdue" `StatusBadge` (tone `danger`) beside the amount. `toPanel(items, "/sinking-fund")` keeps the 5-row / 3-on-phone behaviour from `DashboardPanel`. The attention grid becomes `md:grid-cols-2 xl:grid-cols-3`, matching Recent activity, so at medium widths the third card wraps below instead of being squeezed.
- **Rationale**: Consistent with Unpaid balances; reuses the `.panel-rows` CSS.
- **Alternatives**: `lg:grid-cols-3` (too narrow beside the 255 px sidebar).

## R5. Access (FR-013)

- **Decision**: No extra check. The Dashboard is owner-only (`view_dashboard`, `(owner)` route group) and Sinking fund access is "approved", which includes the owner.
- **Rationale**: Every viewer of the Dashboard can already open Sinking fund.
