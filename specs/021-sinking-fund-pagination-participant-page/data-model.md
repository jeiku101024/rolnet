# Data Model: Sinking Fund Pagination and Participant Page

No tables, columns, views, functions, or policies change. This feature reshapes what the app reads.

## Existing sources (unchanged)

| Source | Used for |
|---|---|
| `sf_ledger_v` | Rows of the main list and of one participant's History (`participant_id` filter) |
| `sf_loans_v` | A participant's loans on their page |
| `sf_participant_summaries` (rpc) | The four figures and the participant's identity |

## Read shapes (app side)

**`SfLedgerPage`** (replaces the `n`-sized `ledger` slice)

| Field | Meaning |
|---|---|
| `rows` | At most 10 `SfLedgerRow` |
| `page`, `lastPage`, `total`, `rangeLabel` | A `ListPageState`, with `page` already clamped to `lastPage` |

**`SfParticipantPageData`** (replaces `SfDetail`)

| Field | Meaning |
|---|---|
| shared page data | `participants`, `openLoans`, `prefill`, `drivers`, `distributions`, `today`, `summary` (what the dialogs need) |
| `participant` | The `SfParticipantSummary` for the route id |
| `loans` | The participant's `SfLoan` list, newest first |
| `history` | An `SfLedgerPage` limited to this participant |

Returns `null` when the id is unknown, archived, or deleted.

## Address parameters

| Route | Parameter | Rule |
|---|---|---|
| `/sinking-fund` | `page` | whole number ≥ 1, clamped to the last page; replaces `n` |
| `/sinking-fund/participants/[id]` | `page`, `q`, `sort` | same parsing as `parseListPage`; `q` is trimmed to 100 characters |
| `/sinking-fund/participants/[id]` | `return` | must start with `/sinking-fund`; otherwise the back link uses the plain participants view |
| `/sinking-fund` | `detail` (legacy) | a valid UUID redirects to the participant page |
| dropped | `n`, `hn` | ignored |

## State and rules

- Voided rows stay in both lists and count toward pages.
- Page resets to 1 whenever search or sort changes (existing `ListControls` behavior).
- Soft-deleted or archived participants have no page.
