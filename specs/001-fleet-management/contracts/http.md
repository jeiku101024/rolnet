# HTTP and Download Contracts

The application is not a public API. Route Handlers exist only where browser navigation, Auth, or
file download requires an HTTP response. They authenticate and authorize exactly like Server Actions.

## `GET /api/auth/callback`

Exchanges the Supabase PKCE authorization code for a cookie-backed session.

- Query: `code` and an optional allow-listed relative `next` path.
- Success: `303` redirect to the validated destination or role-appropriate home page.
- Failure: `303` redirect to `/login?error=auth_callback` without exposing provider details.
- Security: no open redirects; secure HTTP-only cookie handling follows the Supabase SSR client.

## `GET /api/reports/monthly`

Downloads the owner-only monthly CSV.

Query parameters:

| Name | Format | Rules |
|---|---|---|
| `month` | `YYYY-MM` | Required valid calendar month |
| `scope` | `unit` or `fleet` | Required |
| `unitId` | UUID | Required only when scope is `unit` |

Responses:

- `200 text/csv; charset=utf-8` with UTF-8 BOM for spreadsheet compatibility.
- `400 application/json` for invalid parameters.
- `401` when unauthenticated; `403` for staff.
- `404` when the requested active unit is not visible.

CSV columns:

```text
month,unit_body_number,plate_number,remittance_due_centavos,
remittance_paid_centavos,outstanding_centavos,credit_centavos,
fuel_expense_centavos,repair_expense_centavos,registration_expense_centavos,
insurance_expense_centavos,other_expense_centavos,total_expense_centavos,
net_income_centavos
```

Fleet exports contain one row per unit and a final `FLEET TOTAL` row. Empty months retain headers and
zero-valued totals. Values are escaped according to RFC 4180 conventions; money remains integer
centavos to prevent spreadsheet rounding. The handler streams the shared database report result and
does not recalculate totals in JavaScript.

## Storage Traffic

Receipt and document bytes do not pass through application Route Handlers. The authenticated browser
compresses images, receives a policy-valid destination from a Server Action, and uploads directly to
private Supabase Storage. Download UI requests a short-lived signed URL after authorization.

## Error Envelope

JSON errors use:

```text
{ "error": { "code": "STABLE_CODE", "message": "Plain-language recovery guidance" } }
```

No response exposes SQL text, secrets, stack traces, raw Auth errors, or private object paths not
authorized for the requester.

