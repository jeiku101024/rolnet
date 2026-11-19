# Contract: Expenses monthly download

## Route

`GET /api/expenses/month?month=YYYY-MM`

| Case | Status | Body |
|------|--------|------|
| Signed out | 401 | `UNAUTHENTICATED` |
| Account not approved | 403 | `ACCOUNT_NOT_APPROVED` |
| `month` missing, malformed, in the future, or more than ten years back | 400 | `INVALID_QUERY`, "Choose a valid month." |
| Success | 200 | JSON payload (below), `cache-control: no-store` |
| Unexpected failure | 500 | `UNEXPECTED`, "The file could not be created. Try again." |

Any approved user may call it (the Expenses page is open to every approved user). Data is read through the caller's session, so existing row-level security applies; deleted expenses are filtered out.

### Payload

```json
{
  "month": "2026-11",
  "monthLabel": "November 2026",
  "fileName": "rolnet-expenses-2026-11.xlsx",
  "units": [{ "id": "...", "name": "B1 DEYU" }],
  "expenses": [{
    "unitId": "...", "date": "2026-11-03", "category": "fuel",
    "customCategory": null, "replacedDate": null,
    "amountCentavos": 125000, "notes": "..."
  }]
}
```

`units` holds every non-archived unit plus archived units with an expense that month, in natural name order. `expenses` is ordered by date then creation time.

## Workbook (built in the browser)

One sheet per unit, named by `sheetNames` (31 characters, no `: \ / ? * [ ]`, duplicates numbered). A4 landscape, Narrow margins, fit one page wide, any height, rows 1 to 4 repeated on each page.

| Row | Content |
|-----|---------|
| 1 | Title band: "<unit name> · Expenses · November 2026" |
| 2 | Subtitle: expense count and total |
| 3 | Blank band row |
| 4 | Header: Date, Category, Amount, Last replaced, Notes |
| 5… | Expenses by date, oldest first; Category shows the custom name for Others; Last replaced shows "N/A" for Others |
| last | Total row: label and `SUM` of Amount (0 when empty) |

Empty unit: row 5 is the line "No expenses for November 2026", then the total row showing 0.

Text cells are written as inline strings, so a name or note starting with `=` is shown as text, not evaluated.

## Client

`ExpensesDownloadForm`: Month and Year selects (months up to the current month), default current month, `useActionForm` pending and error with Retry. It fetches the payload, loads the workbook builder with a dynamic import, and saves the file with the payload's `fileName`.
