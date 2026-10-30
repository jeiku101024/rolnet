# Contract: Units register and unit forms

## Units register (`/units`)

**Columns, in order**: Unit · Body number · Plate · Motorcycle · Current driver · Mileage · Status

| Column | Content |
|--------|---------|
| Unit | `name`, linking to `/units/{id}` |
| Body number | `body_number`, in the data font |
| Plate | `plate_number`, in the data font (unchanged) |
| Motorcycle | `make_model` |
| Current driver | See [data-model.md](../data-model.md#derived-current-driver-per-unit-today) |
| Mileage | Unchanged |
| Status | Unchanged (a select for the owner, a badge for staff); its accessible label is `Status for {name}` |

**URL parameters** (they extend `specs/006-pagination-dashboard-refresh/contracts/list-paging.md`):

- `q`: matches `name`, `body_number`, `plate_number`, `make_model`, or the status label.
- `sort`: `name` (default), `name-desc`, `body`, `body-desc`, `mileage-desc`, `mileage`.
- `status`: unchanged.

## Add unit / Edit details forms

| Field | Name | Required | Max | Label |
|-------|------|----------|-----|-------|
| Unit name | `name` | yes | 40 | "Unit name" (placeholder "e.g. ROLNET-1") |
| Body number | `bodyNumber` | yes | 40 | "Body number" |
| Plate number | `plateNumber` | yes | 20 | "Plate number" |
| Motorcycle | `makeModel` | yes | 120 | "Motorcycle" (placeholder "e.g. Yamaha YTX") |
| Status | `status` | add form only | — | unchanged |

**Server actions** (`app/actions/units.ts`): `createUnit` and `updateUnit` accept `name` and write it
to `units.name`. New error:

| Code | When | Message |
|------|------|---------|
| `DUPLICATE_UNIT_NAME` | `units_name_unique` violated | "Another unit already uses this name. Choose a different name." |

## Generic API (`/api/units`)

`name` is added to `createFields`, `updateFields` and `sortFields`. It is optional on create: when it
is omitted, the database sets it to the body number (research R2).

## Unit page (`/units/{id}`)

The title is `name`. The description is `Body {body_number} · {plate_number} · {make_model}`. The
"Edit details" form follows the table above.
