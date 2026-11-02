# Research: Drivers Page, Role Switch, Dated Absences, Stale Leave Flag

No open NEEDS CLARIFICATION items remained after `/speckit-clarify`. The decisions below settle the
design questions the spec leaves to planning.

## R1. Status today is derived, never stored

- **Decision**: `drivers.is_active` stays the only stored status. Status today comes from a pure
  function `statusToday(driver, absences, today)` in `lib/drivers/absences.ts`, with Inactive taking
  precedence over a covering absence, which takes precedence over Active.
- **Rationale**: FR-031 and FR-032. Absences end on their own (SC-003) without a scheduler, which
  the free tier and Principle II both favour.
- **Alternatives considered**: a nightly job flipping a stored status. Rejected: it needs a cron
  service, and it's wrong between midnight and the run.
- **Data conversion**: none. No stored Day-off status exists (spec Assumptions).

## R2. No overlap through an exclusion constraint on the effective range

- **Decision**: each absence's covered range is
  `daterange(start_date, least(end_date + 1, ended_early_on), '[)')`. `least` ignores nulls, so an
  open-ended leave that hasn't been ended early has an unbounded upper end. The table carries
  `exclude using gist (driver_id with =, <range> with &&) where (cancelled_at is null and deleted_at is null)`.
  Ending early on the start day gives an empty range, which overlaps nothing.
- **Rationale**: FR-034 and FR-036 become a database guarantee even when two people save at once.
  `btree_gist` is already enabled. A date-only `ended_early_on` keeps the expression immutable.
- **Message**: the constraint violation (`23P01`) is a fallback. `save_driver_absence` first looks up
  the conflicting absence and raises a friendly `23514` naming it ("RA SHAA is already on leave Nov 5
  to Nov 9."). The exclusion only fires on a true race, and `lib/actions/errors.ts` maps it to
  "This driver already has an absence on these dates. Reload to see it."
- **Alternatives considered**: a trigger with an advisory lock. Rejected: it's more code and gives a
  weaker guarantee.

## R3. Coverage semantics, shared by SQL and TypeScript

- **Decision**: the date `d` is covered when `cancelled_at is null`, `d >= start_date`,
  `d <= end_date` (if set), and `d < ended_early_on` (if set). `driver_absent_on(driver, date)` in SQL
  and `covers(absence, date)` in TypeScript implement the same rule, and both are tested with the
  same cases: inclusive range, open-ended, ended early mid-range, ended early on the start day, and
  cancelled.
- **End early**: `ended_early_on` is set to the fleet date today, so today stops being covered and
  the driver is available immediately (FR-045, FR-054). It applies only to absences that cover today.
  An upcoming absence is cancelled instead (FR-047).

## R4. Absent drivers are refused by the assignment trigger as well as hidden

- **Decision**: `validate_unit_assignment` (feature 010) gains a check after the active/licence
  check: if `driver_absent_on(new.driver_id, new.service_date)`, it raises `23514` "This driver is
  absent on this date. Choose another driver." `lib/units/assignment-query.ts` loads the absences
  that overlap the board date and drops those drivers. Future pre-fill skips a driver who isn't
  available (FR-041).
- **Rationale**: FR-040. The UI hides the driver, and the database still refuses a stale or crafted
  request.

## R5. Save absence and release assignments in one transaction, with a checked release list

- **Decision**: the flow has two steps.
  1. `previewAbsence` (a server action with plain reads) validates the form. It returns any
     overlap conflict, the past-date counts (assignments and remittances on dates before today in
     the range), and the today-and-later saved assignments the absence would newly cover (id, date,
     unit).
  2. `save_driver_absence(..., p_release_ids uuid[])` (SQL, `security definer` with an `is_approved_user()` check, because a released assignment no longer passes the read policy) re-checks
     everything. It recomputes the assignments to release. If that set differs from
     `p_release_ids`, it raises `P0001` "Assignments for these dates changed. Review them again."
     Then it upserts the absence and soft-deletes those assignments in the same transaction.
- **Locked rows**: soft-deleting an assignment whose unit and day already has a remittance hits the
  feature-010 lock in `validate_unit_assignment` and aborts the whole save. The function checks
  first and raises the plain safeguard message (FR-044): "[Unit] on [date] already has a remittance,
  so this assignment can't be released."
- **Staff release**: an RLS-bound update can't soft-delete an assignment, because the new row fails
  the read policy (`deleted_at is null`); the rolnet-dev dry run showed this. So the function is
  definer and checks `is_approved_user()` (owner and staff). `release_unit_assignments()` is
  owner-only and isn't used here.
- **Edit**: "Newly covered" means covered by the new range and not by the old one. Only today and
  later dates count (FR-042, FR-048).
- **Alternatives considered**: release first, then save (two writes). Rejected: a failed save would
  leave units released for no reason.

## R6. Cancel, end early, return to Active, and "Still on leave"

- `cancel_driver_absence(id, expected_updated_at)`: only for Upcoming rows (start > today). Sets
  `cancelled_at` and `cancelled_by`.
- `end_driver_absence(id, expected_updated_at, cancel_upcoming boolean)`: only when the absence
  covers today. Sets `ended_early_on = today`, `ended_early_at`, and `ended_early_by`. If
  `cancel_upcoming` is true, it also cancels the driver's Upcoming absences, in one transaction.
  This one function serves End early, End leave now, and the "Return to Active" dialog.
- `confirm_driver_leave(id)`: only for an open-ended leave covering today. Inserts a
  `driver_absence_confirmations` row and sets `snoozed_until = today + stale_leave_snooze_days`.
- All of them use optimistic `updated_at` checks, like the feature-005/010 actions, and return the
  updated row.

## R7. Role switch and undo by staff: a narrow definer function

- **Decision**: `set_driver_role(p_driver_id, p_to_role, p_expected_updated_at)` is
  `security definer` and requires `is_approved_user()`. It updates `drivers.driver_kind` and inserts a
  `driver_role_changes` row (`from_role`, `to_role`, `changed_by = auth.uid()`, `changed_at = now()`)
  in one transaction, and returns the change id. A request that sets the current role again does
  nothing.
- `undo_driver_role_change(p_change_id)` (definer, approved users) succeeds only if the change is
  the driver's latest un-withdrawn change, was made by the caller, and was made in the last 60
  seconds. The server window is longer than the 5-second toast to allow for network delay. It
  reverts `driver_kind` to `from_role` and soft-deletes the change row (`deleted_at`, `deleted_by`),
  so Role history no longer shows it while the audit log keeps it.
- `lock_inactive_driver_details` stops treating `driver_kind` as a locked field, because roles may
  change while a driver is Inactive (spec edge case).
- **Alternatives considered**: a staff UPDATE policy on `drivers`. Rejected: it would let staff edit
  every column.

## R8. Role on a date is computed in TypeScript

- **Decision**: `roleOn(changes, currentKind, date)`:
  - Use the latest un-withdrawn change with `changed_at` (fleet date) on or before the date: its
    `to_role`.
  - Before the first change: the first change's `from_role`.
  - With no changes: `currentKind`.
- The Remittances daily query, the profile's Assignments and Remittances tabs, and the dashboard (if
  it shows a role tag for a past day) load the changes for the drivers they show (one read, indexed
  on `(driver_id, changed_at)`).
- No backfill: existing drivers have no history rows (FR-062).
- **Alternatives considered**: a SQL `driver_role_on()` used in every query. Rejected: it adds a
  function and grants for something only rendering needs, and TypeScript is easier to test.

## R9. The Drivers list filters and pages in memory

- **Decision**: the list loads every non-deleted driver, all un-cancelled absences ending today or
  later (or open-ended), today's `unit_assignments`, and the stale settings. It builds rows with
  `lib/drivers/list-board.ts`, then applies search, Role, Status today, and `stale=1`, and pages
  with the existing `pageRows` helper (the demo path already works this way).
- **Rationale**: Status today and the stale flag are derived (R1), so SQL filtering would need a
  view or RPC. A small fleet (around 30 drivers) makes in-memory filtering instant. The existing sort
  options (name, licence expiry) are kept.
- **URL params**: `q`, `kind` (existing), `status` (`active`, `day_off`, `on_leave`, `inactive`),
  and `stale` (`1`). The Filters badge counts `kind` and `status`.

## R10. Toast with Undo

- **Decision**: extend `components/ui/toast.tsx` so `useToast()` accepts
  `toast(message, { action?: { label, onClick }, timeout? })`. It uses Base UI Toast `actionProps`.
  The role toast uses a 5000 ms timeout. Other toasts keep 4 s. No new library.

## R11. Profile tabs and Load more are URL-driven

- **Decision**: `?tab=assignments|remittances|roles|absences|documents&rows=8`. "Load more" is a
  link that adds 8 to `rows`, with `scroll={false}`. The server reads `rows + 1` to know whether more
  exist. Tabs are a `role="tablist"` of links with roving focus and arrow keys (a small client
  wrapper). Only the active tab's data is read.
- **Rationale**: it matches the URL-driven paging already used everywhere, works when JavaScript is
  slow, and needs no client cache.

## R12. Summary strip data

- **Today's unit**: today's `unit_assignments` row for the driver.
- **Remittances (last 30 days)**: count of the driver's non-deleted remittances with
  `service_date` from today − 29 to today.
- **Balance owed**: computed from the driver's remittances and payments with
  `lib/remittances/financials.ts`, so staff see it too. The `driver_outstanding_balances()` RPC is
  owner-only.
- **Next absence / Last assignment**: from the absences and assignments already read.

## R13. Settings

- **Decision**: add to `fleet_settings` `stale_leave_amber_days smallint not null default 14`,
  `stale_leave_red_days smallint not null default 30`, and `stale_leave_snooze_days smallint not null
  default 7`, with checks `amber > 0`, `red > amber`, and `snooze > 0`. Approved users can already read
  `fleet_settings`. There is no editing screen in this feature (spec Assumptions), and the existing
  owner update policy is unchanged.

## R14. Old profile sections and the legacy tables

- **Decision**: the profile stops reading `driver_assignments` and `driver_days_off`. The tables,
  their API v1 read access, and their data stay as they are. The active/inactive status history
  (`components/records/status-history.tsx`) is shown under the Role history tab as a second list,
  "Status changes" (FR-022).

## R15. API v1 and audit

- **Decision**: the new tables aren't exposed through API v1 in this feature. Their writes are
  audited by `audit_business_change` triggers, so they appear on the Audit page with labels
  "Absences", "Leave checks", and "Role changes" (added to the `list-control-specs` entity labels).

## R16. Demo mode

- **Decision**: `lib/demo/mode.ts` gains absences relative to today: one Day-off today, one leave
  with an end date, one open-ended leave 16 days old (amber), one 31 days old and snoozed, and one
  upcoming Day-off. It also gains two role changes (one Primary → Backup 10 days ago) and notes on
  some drivers. Writes stay disabled in demo, as on other pages.
