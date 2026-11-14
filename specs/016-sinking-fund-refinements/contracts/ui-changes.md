# Contract: UI changes

Follows `DESIGN.md` and the tokens in `app/globals.css`; shadcn `base-nova` components only; no hex colors or arbitrary sizes in components; every screen works at 360 px.

## Distribute dialog (`dialogs/distribute-dialog.tsx`)

- Title "Distribute interest". Description: "Shares follow each participant's savings. Confirming also closes the year."
- Participant list: checkbox, name, savings, share (live). Rows with an Open or Overdue loan show "Has an unpaid loan" and the confirm button stays disabled with a one-line explanation. Participants with ₱0 savings show "No savings, no share".
- Summary: Available, Overall savings (ticked), Total shares, and "₱X stays in the fund." when above ₱0.00.
- Warning block (always visible): "Confirming saves each ticked participant's ended total, then resets their savings, loans, balance, and payments to ₱0.00. Earlier transactions stay in history."
- Confirm button: "Distribute and close the year · ₱X". It sends `expectedTotalCentavos`; on "The figures changed" it recomputes and asks the owner to review.

## Distribution history (`dialogs/distribution-history-dialog.tsx`, owner only)

- Rows (newest first) are buttons: date, year, total distributed, and "N received a share" (uses `share_count`, spec FR-039). A "Voided" tag where it applies. The whole row is the tap target (at least 44 px).
- Empty state: "No distributions yet."
- Staff: the "View history" link on the Interest fund card is not rendered.

## Distribution details (`dialogs/distribution-details-dialog.tsx`, new, owner only)

- Header: "Distribution {year}", the date, a voided tag and reason if voided.
- Key figures: **Sinking fund total for the year**, Interest fund distributed, Stayed in the fund, Participants.
- Table "Participants" sorted highest to lowest: rank, name, ended total savings, distributed share, and a totals row. At 360 px each participant is a stacked row (name on top, two labeled amounts below); no sideways scroll.
- "Download Excel" (a link to the route) and "Void distribution" (existing dialog) for active distributions.
- Legacy distributions: "Not recorded" for missing ended totals, with one line of explanation.

## Participant pop-up (`participant-detail-dialog.tsx`, replaces `participant-detail-sheet.tsx`)

- Centered `Dialog` sized like Add transaction (`max-w-lg`, a `max-h` with vertical scroll in the body, a fixed title row with the close button).
- Content as in the sheet: name, role and overdue tags, Total savings, Total loans, Balance to pay, Interest shares received; Add transaction and Withdraw savings buttons; Loans; History (Load more).
- History rows wrap: date, type tag, amount, note. The note column never forces width.
- Open: client state plus `getParticipantDetail`, with "Loading details…" while it loads. Close: sets state only, `history.replaceState` removes `detail` and `hn`, and focus returns to the opener. No `router.replace`, so the page behind keeps its scroll position, search, sort, and filters.
- Add transaction, Withdraw savings, and loan actions open their own dialog on top; closing them returns to the pop-up with refreshed totals.

## Chart (`charts/charts.tsx`)

- Month labels: larger, `fill-ink`, "Nov" with the year on a second line at narrow width; all months labeled up to six, every other month beyond that.
- Series: Deposits green, Loans amber, Payments blue from the tokens, plus pattern fills (solid, hatch, dots) so series differ without color; legend swatches use the same patterns.
- Empty months keep their label and a baseline tick; no data shows "No activity in these months yet."
- The donut keeps its token palette and is checked against the new series colors.

## Divider lines

- `app/globals.css`: `.data-region` drops `border-block`. The card keeps its outline and radius. Verified on the pages listed in research R11 at 360 px and desktop widths.

## Other wording

- Transactions view and history rows: the new type shows as "Year-end close" with the existing `type-tag` styling (neutral tone, close icon).
- Interest fund card: amounts unchanged; "Distributed" and "View history" keep their places.
