# Data Model: Unit Name and Register Columns

## Unit (`public.units`) — changed

| Field | Change | Rules |
|-------|--------|-------|
| `name` | **New**, `text not null` | 1–40 characters after trimming; unique among non-deleted units, ignoring case and surrounding spaces (`units_name_unique` on `lower(trim(name)) where deleted_at is null`). |
| `body_number` | Unchanged | Still required and unique; now its own register column. |
| `plate_number` | Unchanged | — |
| `make_model` | Unchanged in storage | Shown to users as **Motorcycle**. |
| `status`, `current_mileage`, audit fields, `deleted_at` | Unchanged | — |

**Migration** (`supabase/migrations/20261030000200_add_unit_name.sql`, new):

1. Add `name` as nullable.
2. Backfill every row: `name = trim(body_number)`, including soft-deleted rows, so the history stays complete.
3. Set `not null`, then add the length check and the `units_name_unique` partial index.
4. Add the trigger `units_default_name` (`before insert or update`): when `name` is null or blank,
   set it to `trim(body_number)`. The function is a trigger, so it gets no EXECUTE grant for
   `anon` or `authenticated`.

Existing triggers keep working unchanged: `units_audit_fields`, `units_no_hard_delete`, and the
business audit trigger, which records the whole row as `to_jsonb` and so captures name changes (FR-011).
RLS stays as it is, because the policies are row-level and no column-level grants apply.

## Driver assignment / day off — read-only here

There are no schema changes. The register reads:

- `driver_assignments` for the page's unit ids, where `deleted_at is null` and either
  primary with `starts_on <= today` and (`ends_on is null` or `ends_on >= today`), or backup with
  `starts_on = today`. It embeds `drivers(full_name)`.
- `driver_days_off` for those primary assignment ids where `day_off_date = today`.

## Derived: current driver (per unit, today)

Computed in `lib/assignments/current-drivers.ts` on top of `coverageOn`:

| Situation | Shown | Tone |
|-----------|-------|------|
| Primary covers today, no day off | Primary's name | default |
| Primary has a day off, backup covers it | Backup's name + "Backup" badge | default |
| Primary has a day off, no backup | "Day off · no backup" | warning |
| No primary covers today | "Unassigned" | muted |
| The assigned driver is archived (hidden by RLS) | "Unassigned"; the row is dropped before coverage | muted |

## Validation (`lib/validation/units.ts`)

`unitSchema` gains `name: z.string().trim().min(1).max(40)`. `unitDetailsSchema` inherits it, so both
create and edit require a name.
