# Quickstart: Validate the Documents Page Redesign

The design is in [plan.md](plan.md), [data-model.md](data-model.md), and [contracts/](contracts/).

## Prerequisites

- Corepack pnpm with dependencies installed (`corepack pnpm install`).
- Demo mode for UI checks: `NEXT_PUBLIC_DEMO_MODE=true`.
- No local Supabase. pgTAP runs against rolnet-dev through the rollback wrapper, **only after
  approval**. The two new migrations must be pushed to rolnet-dev first (with approval).
- For the retention job: `CRON_SECRET` and `SUPABASE_SERVICE_ROLE_KEY` in the server environment,
  and the repository secrets `PURGE_URL` and `CRON_SECRET` for the workflow.

## Automated checks

```bash
corepack pnpm lint
```

```bash
corepack pnpm typecheck
```

```bash
corepack pnpm test
```

```bash
corepack pnpm test:e2e
```

```bash
corepack pnpm check
```

```bash
corepack pnpm build:vinext
```

Then the full pgTAP suite on rolnet-dev (wrapper), expecting every file to pass, including 370, 380,
240, and the updated 050 and 120.

Expected Vitest coverage: `lib/documents/status.ts` (boundaries today, +7, +8, −1), `tree.ts`
(folders including empty ones, filters, search rules, auto-expand, sort of folders and rows,
summaries and plurals), `search.ts` (highlight ranges), `url-state.ts` (round trip, legacy
`expiry=due`), and `file-label.ts`.

## Manual walkthrough (rolnet-dev data, 1440 px and 360 px)

1. **Layout**: open `/documents`. There is no form card. The header shows Recently reverted (badge)
   and "Sort (both panes)". The Unit pane is left (about 55%) and the Driver pane right. At 360 px
   they stack with Unit first, with no horizontal scroll.
2. **Tree**: all folders are collapsed, including a unit with no documents (count 0) and the pills.
   The archived unit is absent. Expand all and Collapse all work. Expanding the empty folder shows
   the message, and its link opens Upload with the unit preselected.
3. **Keyboard**: Tab into the tree, then Down, Up, Right, Left, Home, End, Enter. The focus ring is
   visible, and there is one tab stop.
4. **Search and filters**: in the unit pane, type part of a unit name, then "2026-10", then
   "expired". Check auto-expand, highlight, and "N results in M folders". Clear the search and the
   earlier open folders come back. Choose Status Expired plus Due within 7 days: two chips and badge
   2, empty folders hidden, and the driver pane unchanged. Reload: search, filters, and sort persist.
5. **Sort**: each of the 4 options orders both the folders and the rows, and the driver list.
6. **Dashboard link**: from the dashboard tile ("Expired or within 7 days"), View all opens with
   both panes filtered to Expired and Due within 7 days.
7. **Upload**: Unit pane Upload, a first upload for a unit. Check the file errors (a .docx file, a
   6 MB file), the file chip with Remove, then save. The folder expands and the toast has Undo. Tap
   Undo, and the document is gone: "Upload reverted…". Open Recently reverted, Bring back, and the
   document returns.
8. **Renew**: from the details modal, Renew. The banner and "Renew document" show. After saving,
   History has the old file and the toast has Undo.
9. **Revert**: Revert upload on the renewed document ("Revert to the previous version?"). The
   previous version is current and the mistaken file is in Reverted uploads with "File kept until".
   Revert on a single-version document ("Remove this upload?") makes it vanish, and the folder shows
   Empty when it was the last one.
10. **Restore**: on a document with 2 or more History entries, restore the oldest. The swap happens,
    the former current is at the top of History, status is recalculated, and **Revert upload is
    hidden**.
11. **License**: revert, restore, and bring back a driver's license. The driver profile's license
    expiry matches each time. Remove the only license and the profile keeps its date. Repeat for an
    inactive driver.
12. **Audit**: `/audit` shows document events with the summaries for every action above.
13. **Old links**: open an old `/documents/<id>` link from a unit page. It lands on Documents with
    the modal open.

## Retention job

1. On rolnet-dev, with approval, set one reverted row's `reverted_at` and `purge_after` 31 days back
   (in a rollback test, or on a throwaway document).
2. Call the route:

```bash
curl -X POST -H "Authorization: Bearer $CRON_SECRET" "$PURGE_URL"
```

3. Expect `{"purged":1,"failed":0}`. The object is gone from Storage, `file_deleted_at` is set, the
   details modal shows "File deleted" with no Bring back or View link, and the entry has left Recently
   reverted.
4. Call it without the header and expect `401`.
