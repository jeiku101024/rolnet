# Data Model: Driver and Unit Status Toggles with Edit Locking

No new tables, columns or enum values. The feature adds rules to existing columns. Decisions are
explained in [research.md](research.md).

## Driver (`public.drivers`)

| Field | Role in this feature |
|---|---|
| `is_active` (boolean, default true) | The status: `true` = Active, `false` = Inactive |
| `full_name`, `driver_kind`, `license_number`, `phone`, `address` | Details. Locked while Inactive |
| `license_expiry_date` | Detail. While Inactive, it may change only to the `expires_on` of the driver's current `driver_license` document (renewal, R4) |
| `updated_at` | Version for the detail edit form's stale check. Status changes compare the shown status instead (R8) |
| `deleted_at`, `deleted_by`, `updated_by` | System columns. Not locked |

**States and transitions**

```text
Active ──(owner sets Inactive; no current/upcoming assignment)──▶ Inactive
Inactive ──(owner sets Active)──▶ Active
```

**Rules**

| Rule | Enforced by | Error |
|---|---|---|
| Only approved owners change `is_active` or details | Existing RLS `drivers_owner_update_policy` | RLS denial (no row updated) |
| Active → Inactive refused while any non-deleted assignment has `coalesce(ends_on,'infinity') >= Manila today` | New trigger `drivers_reject_deactivation_with_assignments` (BEFORE UPDATE OF is_active) | `23503` "This driver still has current or upcoming assignments. End or remove them before setting the driver to Inactive." |
| When the old row is Inactive, detail columns are unchanged (except the R4 expiry case) | New trigger `drivers_lock_inactive_details` (BEFORE UPDATE) | `23514` "This driver is Inactive. Set the driver to Active before editing their details." |
| No new assignment for an Inactive driver | Existing assignment trigger | Existing message |
| A license renewal sets the expiry only after the new current document exists | `renew_compliance_document` recreated in the new migration with the order supersede → insert renewal → update driver (R4) | None (renewals succeed for Inactive drivers) |

## Unit (`public.units`)

| Field | Role in this feature |
|---|---|
| `status` (`unit_status`: `active`, `in_repair`, `retired`) | The status |
| `body_number`, `plate_number`, `make_model` | Details. Locked while `in_repair` or `retired` |
| `current_mileage` | Daily operation. Not locked (R3) |
| `updated_at` | Version for the detail edit form's stale check. Status changes compare the shown status instead (R8) |
| `deleted_at`, `deleted_by`, `updated_by` | System columns. Not locked |

**States and transitions** (any to any, owner only)

```text
Active ⇄ In repair ⇄ Retired ⇄ Active
```

**Rules**

| Rule | Enforced by | Error |
|---|---|---|
| Only approved owners change `status` or details | Existing RLS `units_owner_update_policy` | RLS denial |
| When the old row is In repair or Retired, detail columns are unchanged | New trigger `units_lock_out_of_service_details` (BEFORE UPDATE) | `23514` "This unit is In repair (or Retired). Set the unit to Active before editing its details." |
| Current and upcoming assignments kept on In repair and on Retired; no new assignment on Retired | Existing assignment trigger (unchanged) | Existing message |

## Status change (derived, `public.audit_events`)

The status history is read from existing audit rows. Nothing is stored in a new place.

| Field | Source |
|---|---|
| Record | `entity_type` (`units` or `drivers`), `entity_id` |
| Old status | `changed_fields->'before'->>'status'` or `->>'is_active'` |
| New status | `changed_fields->'after'->>'status'` or `->>'is_active'` |
| Actor | `actor_user_id` (references `auth.users`; the display name comes from a second query on `profiles.user_id`) |
| Time | `occurred_at` |

A row counts as a status change only when `action` is not `insert` and the old and new values differ. Saving the same status
again writes nothing (R8), so it adds no row.

## Status presentation (`lib/status/record-status.ts`)

| Record | Value | Label | Tone | Locked |
|---|---|---|---|---|
| Driver | `true` | Active | success | no |
| Driver | `false` | Inactive | muted | yes |
| Unit | `active` | Active | success | no |
| Unit | `in_repair` | In repair | warning | yes |
| Unit | `retired` | Retired | danger | yes |

Each status badge shows its label and an icon, so it does not depend on colour (FR-015).
