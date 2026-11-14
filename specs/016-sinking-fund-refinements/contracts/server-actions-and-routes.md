# Contract: Server Actions and HTTP routes

Pattern from feature 015 (`app/actions/sinking-fund.ts`): authorize, validate with Zod, call exactly one SQL function, `revalidatePath("/sinking-fund")`, return `ActionResult`. Demo mode returns the existing `DEMO_MODE` message for writes.

## Server Actions (`app/actions/sinking-fund.ts`)

### `distributeInterest(input)` (changed, owner only)

```text
input:  { date: string (YYYY-MM-DD), participantIds: string[] (uuid, 1..200),
          notes?: string (<= 500), expectedTotalCentavos: number (int >= 1), idempotencyKey: string (uuid) }
result: { distributionId: string, totalCentavos: number, participants: number,   // took part
          shareCount: number, remainderCentavos: number }
errors: FORBIDDEN (staff), VALIDATION, DEMO_MODE, plus the function's messages (shown as-is)
```

Toast: "₱X distributed to N participants. Year closed. Everyone starts again from ₱0.00." where N is `shareCount` (participants who received a share above ₱0.00), as spec US1 scenario 6 says.

### `getParticipantDetail({ participantId, historyCount })` (new, approved users)

Returns the pop-up data: participant summary, loans (`sf_loans_v`), the first `historyCount` history rows (`sf_ledger_v`) and `historyTotal`. Replaces loading the detail through the `?detail=` page param. Read-only; no revalidation.

### `getDistributionDetails({ id })` (new, owner only)

```text
result: { distribution: SfDistributionSummary, rows: SfDistributionRow[],   // already sorted
          totals: { endedTotalCentavos | null, shareCentavos } }
errors: FORBIDDEN (staff), NOT_FOUND
```

### `voidDistribution(input)` (unchanged signature, owner only)

New failure message when a participant has later activity (see the SQL contract).

## HTTP route

### `GET /api/sinking-fund/distributions/{id}/xlsx`

| Aspect | Contract |
|--------|----------|
| Auth | Signed in, approved, owner. 401 `UNAUTHENTICATED`, 403 `ACCOUNT_NOT_APPROVED` or `FORBIDDEN` ("Only the owner can download this."), same JSON error shape as `lib/reports/http.ts`. |
| Params | `id`: uuid, else 400 `INVALID_QUERY`. Unknown id: 404 `NOT_FOUND`. |
| Success | 200, body = XLSX bytes, `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `Content-Disposition: attachment; filename="rolnet-sinking-fund-{year}-{YYYY-MM-DD}.xlsx"`, `Cache-Control: no-store`. |
| Demo mode | Serves from demo data (read-only), same format. |
| Failure | 500 `UNEXPECTED` with a plain message; details only in the server log. |
| Next.js | Read the route-handler and caching guide in `node_modules/next/dist/docs/` first (this Next.js has breaking changes); call `connection()` before reading the session, as the report routes do. |

Layout: [excel-layout.md](excel-layout.md).

## Page loader (`lib/sinking-fund/queries.ts`)

- `loadSfPageData` no longer loads `data.detail` from the URL for the pop-up; it loads `distributions` only when the caller is the owner (an empty array for staff).
- The `detail` and `hn` URL params stay valid on first load (a refresh keeps the pop-up open): the client reads them once and opens the pop-up through `getParticipantDetail`.
