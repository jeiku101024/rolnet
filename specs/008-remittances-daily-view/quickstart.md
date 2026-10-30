# Quickstart: Validate Remittances Daily View

## Prerequisites

- No migration and no type regeneration (the schema doesn't change).
- For the automated UI checks, use demo mode: `NEXT_PUBLIC_DEMO_MODE=true corepack pnpm dev`. The
  demo data has ROLNET-1 to ROLNET-8 scheduled, with ROLNET-2 in repair and its driver off with no
  backup, and ROLNET-3 covered by Pedro Santos.
- For the save and edit walkthrough, use a real backend (rolnet-dev, see the project memory) signed
  in as the owner, plus one approved staff account.

## Automated checks

```bash
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm test:e2e
corepack pnpm check
```

What they should show:

- `daily-board.test.ts`: the card kind for each situation in [data-model.md](data-model.md)
  (`saved`, `unrecorded` with Primary, `unrecorded` with Backup and `coveringFor`, `no-driver`,
  `in-repair` today only, a primary that hasn't started yet, so no card), a saved driver overriding a
  changed schedule, `recorded` and `countable` totals that leave out not-operating cards, and
  `freeDrivers` that leave out busy, inactive, and expired drivers.
- `payment-plan.test.ts`: none, add, replace for an owner, and blocked for staff. Lowering to 0
  plans voids with no insert.
- `fleet-date.test.ts`: `paymentTimestampFor` returns now for today and noon in the fleet time zone
  for a past date, and the result's Manila date equals the date. `formatLongDate("2026-10-30")` is
  "Friday, October 30, 2026".
- `remittances-view-params.test.ts`: the URL table in
  [contracts/remittances-page.md](contracts/remittances-page.md).
- `daily-card.test.tsx` (mocked actions): the due changes as soon as the disposition changes. A save
  locks the card and shows the badge and "Saved". The menu appears only after saving. Edit keeps the
  disposition disabled. Staff lowering is blocked with its message. Owner lowering asks for a reason.
  The first past-date edit asks for confirmation, and the second doesn't. A failed save keeps the
  entries.
- `remittances-daily-view.spec.ts` (demo, 360 px and 1280 px): `/remittances` opens Daily view on
  today. The toggle switches views without a full reload. 4 columns at 1280 px, 1 at 360 px. Next
  day is disabled on today. The calendar moves between months and future days are disabled. The
  Backup tag tooltip shows "Covering for …". ROLNET-2 is "Not operating (in repair)" and isn't
  counted. List view has no side panel, shows the note under the count, and its row date opens Daily
  view on that date. The search placeholder's computed color is `rgb(82, 97, 116)`. No horizontal
  scroll at 360 px.

## Manual walkthrough (real backend, 360 px, then 1280 px)

1. Sign in as staff. `/remittances` opens on today's Daily view, with no search, Filters, or Sort.
   The header reads "0 of N recorded" and "₱0.00 received".
2. On a Returned card, the due reads ₱180.00. Change it to Overnight / overtime and the due reads
   ₱300.00 at once. Change it back.
3. Type `100` and the note "partial", then press **Save remittance**. The card locks and turns muted,
   shows "Owes ₱80.00" and "Saved" with a lock, and the ⋯ menu appears. The header reads "1 of N" and
   "₱100.00 received".
4. Open ⋯ and choose **Edit remittance**. The disposition stays disabled with its hint. Enter `80`:
   saving is blocked with "Only the owner can lower a recorded payment." Enter `180` and save. The
   card shows "Paid" and the header goes up by ₱80.00.
5. Sign in as the owner, edit the same card, enter `150`, and save. A reason is asked for. Give one.
   The card shows "Owes ₱30.00". The record's details page (⋯, then **View record details**) shows
   the earlier payments voided and one ₱150.00 payment.
6. Use **Previous day** to go back to yesterday. Saved records are locked and unrecorded units can be
   saved. Save one with `180`. On the details page, the payment's date is yesterday. Edit a saved
   past record: the confirmation "You're editing a record from …" appears once in this session.
7. Find a unit whose primary is off with no backup. Its card is "Not operating" and isn't counted.
   Press **Assign driver**, pick a free driver, and the card becomes recordable with a Backup tag and
   joins the count.
8. List view: there's no side panel, the table is full width, and rows have no pointer cursor. The
   note is under the count, and "Daily view" in it switches views. A row's date opens Daily view on
   that date. In DevTools, the placeholder's computed color is `rgb(82, 97, 116)` (6.32:1 on white),
   and the control borders are `rgb(125, 137, 150)` (3.56:1). Tabbing into search shows the focus
   ring.
9. Type into a card, then press the sidebar's Dashboard link. The unsaved-changes dialog appears,
   and "Stay" keeps the entry. Leave the tab open across midnight, or set the device clock forward
   in a test environment, and the banner "It's now a new day. Switch to today?" appears while the
   date stays the same.
10. Database: a check against any existing date shows the remittance and payment counts and the
    totals unchanged by just opening either view.
