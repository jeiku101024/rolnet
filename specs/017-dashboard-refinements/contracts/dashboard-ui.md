# UI Contract: Dashboard Refinements

## "This month" charts row

- `lg` and up: two columns, both cards the same height with aligned bottom edges. Below `lg`: stacked, natural heights.
- Daily collections: header, total, a chart area that grows to fill, then the caption and best-day text at the bottom.

## Collected vs expenses by unit

- Shows the first 5 units. If there are more than 5, a "Show all N units" button (44 px tap target) sits under the list.
- The button opens a modal: title "All units", description "<month>. Net income is collected minus expenses." Fixed header with close (X); Escape and outside click also dismiss. The body scrolls; rows are identical to the card rows (body number, Net, collected bar and amount, expenses bar and amount) in the same order.
- Opening or closing never changes the page height and never triggers a data request.

## Needs attention row (3 cards)

Order: Expiring documents, Unpaid balances, Unpaid sinking fund loans.

Card `Unpaid sinking fund loans` (`id="panel-loans"`):

- Description: "Largest balance first."
- Row: title is the participant name; detail is "N open loan(s), due <earliest date>"; aside is the amount in `text-danger` plus an "Overdue" `StatusBadge` when `overdue`.
- Header count is the number of borrowers; "View all N" links to `/sinking-fund` (same show rules as sibling panels).
- Empty message: "No unpaid loans."
- Grid: 1 column on phones, 2 at `md`, 3 at `xl`.
