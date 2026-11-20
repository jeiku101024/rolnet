# Research: Sinking Fund Pagination and Participant Page

## R1. How the main list pages

- **Decision**: Use `page` in the address with the existing helpers: `parseListPage`, `fetchListPage` (database) or `pageRows`-style slicing (demo), `finishListPage`, and `<Pagination>`. Page size is `pageSize` (10).
- **Rationale**: Expenses already works this way (`components/ui/pagination.tsx`, `lib/pagination/list-page.ts`). `ListControls` already drops `page` on every search, filter, or sort change, which gives FR-003 for free. `fetchListPage` already reads the last page when the requested one is past the end (spec edge case).
- **Alternatives**: Keep `n` "Load more" (rejected: the user asked for numbered pages like Expenses); a client-side pager (rejected: breaks refresh and shared links, FR-004).
- **Detail**: The ledger query is a counted `range()` on `sf_ledger_v`; replace `range(0, n - 1)` with the `fetchListPage` runner. The result line becomes the page range, so the `Showing N of M` text is replaced by the `Pagination` `rangeLabel`, matching Expenses.

## R2. Participant page route and how it gets its data

- **Decision**: New server route `/sinking-fund/participants/[id]`. A new `loadParticipantPage(id, searchParams, isOwner)` returns the shared page data (participants, open loans, prefill, drivers, distributions, today) plus that participant's loans and one page of history. Unknown id returns `null`, and the route shows not-found.
- **Rationale**: A server route makes refresh, back, and shared links work (FR-004, SC-004) and lets history paging use the same address-based mechanism as the main list. The shared pieces are split out of `loadFromDatabase` into a base loader so the page does not load monthly flows or ranking it never shows.
- **Alternatives**: Keep the client-side fetch used by the pop-up (rejected: it was built to avoid page renders, which is the opposite of the new need); query-string detail view on the same route (rejected: the user wants a "specific participant page").

## R3. Reusing the dialogs on a second route

- **Decision**: Move the `Context.Provider`, `TooltipProvider`, dialog state, and dialog host out of `SinkingFundPage` into `SinkingFundShell`. Both pages render inside it. `useSfActions` keeps its name and shape, minus `viewParticipant`.
- **Rationale**: Add transaction, Withdraw savings, Add payment, Mark as withdrawal, and Void must behave exactly as today (FR-008, FR-011). They depend on `participants`, `openLoans`, `prefill`, `today`, and `distributions`, all of which the participant loader returns.
- **Alternatives**: Copy the host into the new page (rejected: drift risk); make the participant page a view inside `/sinking-fund` (rejected: same objection as R2).

## R4. History search, sort, and filters

- **Decision**: History uses the main list's `ListSearch` and `ListSort`, with the participant locked to the route's id, and shows the same `TransactionRow` in its table layout. Date range and type filters are not offered; the user asked for "search, pagination, and sorting".
- **Rationale**: Matches the request and the spec assumption without a second control spec. The sort options come from the same sinking-fund control spec so labels match the main list. If that spec cannot be reused without its Participant filter, a trimmed spec variant is added in `lib/list-controls`; this is settled in the first task that touches it.
- **Search fields**: The main list searches participant name and notes. On one participant's page, name search is redundant, so it searches notes and type; placeholder reads "Search notes".
- **Alternatives**: Full filter bar (rejected: scope beyond the request).

## R5. Returning to the participants view

- **Decision**: The link to a participant page carries a `return` parameter holding the participants view's query (`view=participants`, `q`, `psort`). The back control rebuilds the participants link from it. Only values that start with `/sinking-fund` are accepted.
- **Rationale**: Browser back alone cannot be relied on after a refresh or a shared link, and FR-006 requires the earlier search and sort. A validated parameter avoids an open redirect.
- **Alternatives**: `router.back()` only (rejected: fails for direct visits); session storage (rejected: lost across devices and links).

## R6. Legacy `?detail=<id>` links

- **Decision**: `/sinking-fund` redirects a valid `detail` parameter to the participant page. Other parameters are not carried, except `view=participants` query values for the back link.
- **Rationale**: FR-014. The old address came from the 016 pop-up and may exist in bookmarks.

## R7. Refresh after a change

- **Decision**: Existing mutations already refresh the page data. Confirm each sinking-fund action revalidates both `/sinking-fund` and the participant route (a layout-level revalidation of `/sinking-fund` covers both), and add it where missing.
- **Rationale**: FR-012. The pop-up refreshed because it re-fetched whenever page `data` changed; a route needs server revalidation or a router refresh instead.

## R8. Removals

Delete `participant-detail-dialog.tsx` and the `getParticipantDetail` action, and drop `n`, `hn`, `detail`, `loadMoreStep`, and `historyStep` from `url-state.ts`. Old `n` or `hn` values in a link are ignored.
