# Quickstart: Validate Sinking Fund Pagination and Participant Page

## Prerequisites

- Demo mode: `NEXT_PUBLIC_DEMO_MODE=true`, or the real dev database with at least 11 transactions, and one participant with more than 10 transactions and a loan.
- Sign in as the owner. Repeat step 5 as staff.

## Run

```powershell
corepack pnpm dev
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm test:e2e
corepack pnpm check
```

No schema change, so `supabase test db` is not needed.

## Scenarios

1. **Main list pages (US1, FR-001 to FR-004)**: Open `/sinking-fund`. Only 10 rows show, the page controls match Expenses, and the range reads like `1–10 of 22 records`. Go to page 2, then search; the list returns to page 1. Refresh on page 3; page 3 opens. Edit the address to `page=99`; the last page shows.
2. **Single page**: Search until 10 or fewer rows match; no page controls show.
3. **Open participant (US2)**: In Participants view, search and sort, then choose **View details**. A full page opens, not a pop-up. Choose the back control; the same search and sort are still applied. Repeat with the browser back button.
4. **Card details and actions (US3)**: Confirm the four figures, both buttons, and every loan field match what the old pop-up showed. Add a transaction; figures, loans, and History refresh without a reload.
5. **History (US4)**: With more than 10 rows, 10 show with pages. Search notes, change the sort, open a row's menu, and void one row; its voided style stays and the counts refresh. Only this participant's rows ever appear. As staff, owner-only buttons are disabled or hidden as before.
6. **Edge links**: Open `/sinking-fund?view=participants&detail=<id>`; it lands on the participant page. Open a page for a random UUID; the not-found page offers a way back. Set `return` to an outside address; the back control falls back to the participants view.
7. **Mobile**: At 360 px, check the Transactions view, the participant page, loan cards, History, and pagination for sideways scrolling.

See [contracts/page-and-urls.md](contracts/page-and-urls.md) and [data-model.md](data-model.md).
