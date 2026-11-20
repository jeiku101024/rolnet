# Contract: Pages and Addresses

## `/sinking-fund` (changed)

| Parameter | Values | Behavior |
|---|---|---|
| `view` | `transactions` (default), `top`, `participants` | unchanged |
| `page` | integer ≥ 1 | Transactions view only. 10 rows per page. Past the end shows the last page. Page 1 is left out of links. |
| `q`, `sort`, `type`, `participant`, `from`, `to`, `loan_status` | unchanged | Any change drops `page`. |
| `detail` | UUID | **Legacy.** Redirects to `/sinking-fund/participants/<id>`. |
| `n`, `hn` | any | **Removed.** Ignored. |

UI: the "Load more" link is replaced by `Pagination` (First, Previous, Page x of y, Next, Last, with the range label). It is hidden for one page.

## `/sinking-fund/participants/[id]` (new)

Any approved user can open it, as with the pop-up. Owner-only actions stay disabled or hidden for staff and are enforced again in the database.

| Parameter | Values | Behavior |
|---|---|---|
| `page` | integer ≥ 1 | History page, 10 rows. |
| `q` | text ≤ 100 chars | Searches this participant's notes. Drops `page`. |
| `sort` | the main list's sort keys | Drops `page`. Default is date, newest first. |
| `return` | path starting `/sinking-fund` | Target of the back control. Anything else falls back to `/sinking-fund?view=participants`. |

Sections, top to bottom:
1. Header with participant name, Driver and Overdue tags, back control.
2. Four figures: Total savings, Total loans, Balance to pay, Interest shares received.
3. Buttons: **Add transaction**; **Withdraw savings** (owner only).
4. **Loans**: one card per loan with the pop-up's fields, status tag, **Add payment**, and **Mark as withdrawal** (owner only, overdue only).
5. **History**: search, sort, result line, rows, `Pagination`. Empty state: "No transactions yet."

Responses:
- Unknown, archived, or deleted participant: the route's not-found page, with a link back to `/sinking-fund?view=participants`.
- Load failure: the app error boundary; no partial page.

## Participants view link

"View details" in a participant card's menu becomes a link to `/sinking-fund/participants/<id>?return=<encoded participants query>`.

## Removed interface

Server action `getParticipantDetail` is deleted. No other action changes its inputs or results.
