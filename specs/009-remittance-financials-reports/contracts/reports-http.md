# Contract: Report downloads (HTTP)

`GET /api/reports/{kind}` replaces `GET /api/reports/monthly` (the CSV), which is removed.

| `kind` | Required query | Example |
|--------|----------------|---------|
| `weekly` | `date=YYYY-MM-DD` | `/api/reports/weekly?date=2025-01-29` covers Mon 27 Jan to Sun 2 Feb 2025 |
| `monthly` | `month=YYYY-MM` | `/api/reports/monthly?month=2025-01` |
| `yearly` | `year=YYYY` | `/api/reports/yearly?year=2025` |

These optional parameters apply to every kind:

- `scope=fleet|unit` (default `fleet`)
- `unitId=<uuid>` (required when `scope=unit`)

## Responses

| Status | When | Body |
|--------|------|------|
| 200 | OK | The .xlsx bytes. `content-type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `content-disposition: attachment; filename="<name>"`, `cache-control: no-store` |
| 400 `INVALID_QUERY` | Unknown kind; missing or invalid date, month, or year; a period more than 10 years from today; `scope=unit` without a valid `unitId` | `{ error: { code, message } }`, for example "Choose a valid month." |
| 401 `UNAUTHENTICATED` | Signed out | "Sign in to download reports." |
| 403 `ACCOUNT_NOT_APPROVED` / `FORBIDDEN` | Not approved, or no `export_reports` | "Only the owner can download reports." |
| 404 `NOT_FOUND` | `unitId` is not a non-deleted unit | "That unit was not found." |
| 500 `UNEXPECTED` | A query failed | "The report could not be created. Try again." (logged) |

The guard order matches the current route: `connection()` outside the try, then the session, approval, and permission checks.

## File names

| Report | Fleet | One unit (unit name, filename-safe) |
|--------|-------|-------------------------------------|
| Weekly | `rolnet-weekly-<monday>.xlsx` | `rolnet-weekly-<monday>-<unit>.xlsx` |
| Monthly | `rolnet-monthly-<YYYY-MM>.xlsx` | `rolnet-monthly-<YYYY-MM>-<unit>.xlsx` |
| Yearly | `rolnet-yearly-<YYYY>.xlsx` | `rolnet-yearly-<YYYY>-<unit>.xlsx` |

The sheet name is `Weekly`, `Monthly`, or `Yearly`, with ` - <unit name>` added for a unit report (truncated to Excel's 31-character limit, with `[]:*?/\` removed).

## Reports page (form)

- **Report:** Weekly / Monthly / Yearly. This is a segmented control on wide screens and a select on phones.
- **Period:**
  - Weekly: a date input, defaulting to today. The text below it reads "Covers Mon 27 Jan – Sun 2 Feb 2025".
  - Monthly: a month select plus a year select, defaulting to this month.
  - Yearly: a year select, defaulting to this year. The years offered run from the earliest data year (or 10 years back) to this year.
- **Scope:** Whole fleet / One unit. With One unit, a select lists every non-deleted unit as "ROLNET-1 (T-001)", with retired units shown as "ROLNET-9 (T-009) (retired)".
- **Download .xlsx** fetches the route, saves the blob under the server's file name, and shows a status. On failure it shows the response's message, or "Your session has ended. Sign in again, then download the report." for 401.
