# Contract: Sinking fund standings

## Route

`GET /api/sinking-fund/standings?month=YYYY-MM`

| Case | Status | Body |
|------|--------|------|
| Signed out | 401 | `{ error: { code: "UNAUTHENTICATED", message } }` |
| Account not approved | 403 | `ACCOUNT_NOT_APPROVED` |
| Not owner | 403 | `FORBIDDEN`, "Only the owner can download this." |
| `month` missing, malformed, in the future, or more than ten years back | 400 | `INVALID_QUERY`, "Choose a valid month." |
| Success | 200 | The .xlsx bytes |
| Unexpected failure | 500 | `UNEXPECTED`, "The file could not be created. Try again." |

Success headers: `content-type` xlsx, `content-disposition: attachment; filename="rolnet-sinking-fund-standings-YYYY-MM.xlsx"`, `cache-control: no-store`. `connection()` is awaited first and outside the try, as in the other report routes.

## Database function

`public.sf_standings(p_as_of date)` returns `(participant_id uuid, name text, savings_centavos bigint, loans_centavos bigint, balance_to_pay_centavos bigint, has_overdue boolean)`.

- `security definer`, `set search_path = public`, `stable`.
- Calls `require_owner()` first; raises for anyone else.
- No EXECUTE for `public` or `anon`; granted to `authenticated` explicitly (the route calls it as the signed-in owner).
- pgTAP (`supabase/tests/sf_standings.test.sql`): non-owner refused; archived and later-joined participants left out; voided rows ignored; a loan repaid after the date still counts on the date; a loan withdrawn before the date does not; overdue flag by due date; savings as of date; empty fund returns no rows.

## Workbook

One sheet named "Standings", A4 portrait, Narrow margins, fit one page wide, tab color navy.

| Row | Content |
|-----|---------|
| 1 | Title band: "Sinking fund standings · November 2026" (current month adds " · as of Nov 19, 2026") |
| 2 | Subtitle: participant count and fund savings total |
| 3 | Legend line: "Overdue balances are shaded and marked" |
| 4 | Header: Rank, Participant, Total savings, Total loans, Unpaid balance |
| 5… | One row per participant in `rankRows` order; rank blank when the participant has no savings |
| last | Total row (live `SUM` formulas) |

Overdue unpaid balance: `overdueAmountCents` style (pale red fill, bold dark red, number format appends " Overdue"); value stays numeric.

## Client

`StandingsDownloadForm`: Month and Year selects (months up to the current month; years from the earliest ledger year or ten years back to this year), default current month, `useActionForm` for pending and error with Retry. It fetches the route and saves the response as a file using the server's file name.
