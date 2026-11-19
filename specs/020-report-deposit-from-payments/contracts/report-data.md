# Contract: Report data (routes and database function)

The routes, URLs, permissions and status codes from features 014 and 019 do not change. Only the data they return gains fields.

## `GET /api/reports/{weekly|monthly|yearly}` (response additions)

For weekly and monthly, each remittance in `daily[unitId].remittances[]` becomes:

```json
{
  "date": "2026-11-17",
  "rentalCentavos": 18000,
  "allowanceCentavos": 4000,
  "depositCentavos": -4000,
  "driverName": "Juan Dela Cruz",
  "latePayments": [{ "date": "2026-11-22", "amountCentavos": 18000 }]
}
```

- `depositCentavos`: the stored deposit (non-voided payments minus allowance); may be negative.
- `latePayments`: non-voided payments whose fleet-time-zone date is after `date`, oldest first; `[]` when none.

For yearly, each entry of `yearly[unitId].months[]` gains `depositCentavos` (the month's sum of stored deposits).

Compatibility: a payload without the new fields (an old cached browser bundle after a deploy) must not crash the builder: missing `depositCentavos` falls back to `rentalCentavos - allowanceCentavos`, and a missing `latePayments` is treated as empty.

## Database function

`public.report_unit_month_totals(p_from date, p_to date)` returns the columns listed in data-model.md, with the new `deposit_centavos bigint` after `allowance_centavos`.

- `language sql stable security invoker set search_path = public`, as before.
- `drop function public.report_unit_month_totals(date, date)` then `create function`, in one migration (`20261119000200_report_month_deposits.sql`).
- `revoke all ... from public, anon, authenticated; grant execute ... to authenticated;`.
- pgTAP (`supabase/tests/constraints/460_report_month_deposits.sql`): an unpaid remittance gives -4000; a part-paid one gives paid minus 4000; a voided payment is ignored; a deleted remittance is ignored; a month with only expenses gives 0; deposits add up per unit and month; `anon` cannot call it; the function is not security definer; the existing `400_report_unit_month_totals.sql` and `rls/250_report_month_totals_rls.sql` still pass.
