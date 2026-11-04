# Contract: Report HTTP endpoints

Both endpoints keep feature 009's guard order: `connection()` outside the try, then session (401),
approval (403 `ACCOUNT_NOT_APPROVED`), and `export_reports` permission (403 `FORBIDDEN`). Errors are
`{ error: { code, message } }` with plain-language messages.

## `GET /api/reports/{kind}` — report data

Returns the data for one report as JSON. The browser builds the .xlsx from it (research R4); the server never
builds a workbook, because the free Workers plan's 10 ms CPU limit cannot generate a 100-unit file.

| `kind` | Period query | Example |
|--------|--------------|---------|
| `weekly` | `date=YYYY-MM-DD` (any day; the Monday–Sunday week holding it) | `/api/reports/weekly?date=2026-10-28&scope=all` |
| `monthly` | `month=YYYY-MM` | `/api/reports/monthly?month=2026-10&scope=unit&unitId=…` |
| `yearly` | `year=YYYY` | `/api/reports/yearly?year=2026&scope=all` |

Optional for every kind: `scope=all|unit` (default `all`; `fleet` is accepted as `all` for old
links), `unitId=<uuid>` (required when `scope=unit`).

### Responses

| Status | When | Body / headers |
|--------|------|----------------|
| 200 | OK | `application/json`, `cache-control: no-store`, the payload below |
| 400 `INVALID_QUERY` | Unknown kind, invalid or out-of-range period, bad scope, `scope=unit` without a valid uuid | "Choose a valid month." etc. |
| 401 / 403 | As above | |
| 404 `NOT_FOUND` | `unitId` is deleted, missing, or archived with no remittance or expense in the period | "That unit has no report for this period. Choose another unit." |
| 500 `UNEXPECTED` | Query or generation failure (logged) | "The report could not be created. Try again." |

An empty period is not an error: the workbook is still returned (FR-005).

### Payload

```json
{
  "kind": "monthly",
  "key": "2026-10",
  "scope": "all",
  "fileName": "rolnet-monthly-2026-10-all-units.xlsx",
  "units": [{ "id": "uuid", "name": "rolnet-1" }],
  "daily": { "<unitId>": { "remittances": [{ "date": "2026-10-01", "driverName": "Juan", "rentalCentavos": 18000, "allowanceCentavos": 4000 }], "expenses": [["2026-10-06", 12000]] } },
  "yearly": { "<unitId>": { "months": [{ "rentalCentavos": 0, "allowanceCentavos": 0 }], "expenseCentavos": 0 } }
}
```

- `key`: `YYYY-MM` (monthly), the Monday `YYYY-MM-DD` (weekly), `YYYY` (yearly).
- `units`: the units to report, already filtered by the eligibility rule and in natural name order. `scope` is `all` or `unit`.
- Exactly one of `daily` (weekly, monthly) and `yearly` (12 months) is present. Units without records are absent from it and mean "no data". All amounts are integer centavos.
- `fileName` follows the table below; the browser saves the workbook under it.

### File names (FR-006)

| Kind | All units | Single unit |
|------|-----------|-------------|
| weekly | `rolnet-weekly-<Monday YYYY-MM-DD>-all-units.xlsx` | `rolnet-weekly-<Monday>-<unit>.xlsx` |
| monthly | `rolnet-monthly-<YYYY-MM>-all-units.xlsx` | `rolnet-monthly-<YYYY-MM>-<unit>.xlsx` |
| yearly | `rolnet-yearly-<YYYY>-all-units.xlsx` | `rolnet-yearly-<YYYY>-<unit>.xlsx` |

`<unit>` = unit name with `\ / : * ? " < > |` and control characters removed, whitespace runs replaced
by "-", leading/trailing dots and dashes trimmed; empty → `unit`. Example: `rolnet-1` →
`rolnet-monthly-2026-10-rolnet-1.xlsx`. The header value is ASCII-quoted; a non-ASCII name also gets
`filename*=UTF-8''<percent-encoded>`.

## `GET /api/reports/units` — units for the Single unit dropdown (NEW)

Query: `kind` plus the same period parameter as the download (`date`, `month`, or `year`).

200 body:

```json
{ "units": [ { "id": "uuid", "name": "rolnet-1", "label": "rolnet-1", "archived": false } ] }
```

- Contains every non-deleted, non-archived unit, plus archived units with at least one non-deleted
  remittance or expense in the period. Archived ones have `label` = `"<name> (archived)"`.
- Sorted by natural name order (rolnet-1, rolnet-2, … rolnet-10), ties by id.
- Errors: 400 for an invalid kind or period; 401/403 as above; 500 `UNEXPECTED`.

## Removed behaviour

- The single-sheet "Weekly" / "Monthly" / "Yearly" layout and the `Weekly - <unit>` sheet names from
  feature 009 (`specs/009-remittance-financials-reports/contracts/report-sheets.md`) are replaced by
  [workbook-layout.md](workbook-layout.md).
- File names without `-all-units` are no longer produced.
- The route no longer returns .xlsx bytes (feature 009 did); the workbook is built in the browser.
