# UI Contract: Feature 012

Visual reference: `drivers_page_stale_leave_mockup.html`. This spec wins where they differ. Use the
tokens in `app/globals.css` and the `components/ui/` primitives, with no hex colours or arbitrary
sizes. Reuse the Units and Expenses toolbar, the dialog style, `StatusBadge`, the toast, and the
Remittances `DriverTag` colours. Dates show as `MMM d` (for example "Nov 5"). Every screen works at
360 px.

## `/drivers` (list)

**URL params**: `q`, `kind` (`primary`/`backup`), `status` (`active`/`day_off`/`on_leave`/`inactive`), `stale` (`1`), `sort`, `page`.

```text
PageHeader  eyebrow "People and coverage"  title "Drivers"
Toolbar     [Search drivers…] [Filters (n)] [+ Add a driver]   ← Add button owner-only
Banner      (stale, when applicable; dismissible per session)
Meta row    "N drivers" [· Showing stale leaves. Clear]        "Available for assignment: N of M · Preview dropdown"
Table       Driver | Role | Current unit | Contact | Status today
```

- **Filters panel**: Role (Primary, Backup) and Status today (Active, Day-off, On-leave, Inactive).
  The badge counts the active filters.
- **Driver**: a link to `/drivers/[id]`.
- **Role**: `DriverTag` colours: Primary uses `bg-info-soft text-info`, Backup `bg-brand-soft text-brand-dark`.
- **Current unit**: the unit name, "Unassigned" (Active today with no assignment), or "—" (absent or Inactive).
- **Status today** badge:

  | Status | Tone | Icon |
  |--------|------|------|
  | Active | success | none |
  | Day-off | info (new `StatusBadge` tone: `bg-info-soft text-info`) | `Moon` |
  | On-leave | info | `CalendarDays` |
  | Inactive | muted | none |

  `StatusBadge` gains an optional `info` tone and an optional leading `icon`. The existing tones are
  unchanged.

  - Second line under On-leave: "until Nov 9" / "open-ended" / "open-ended · checked" /
    `TriangleAlert` + "Open for 16 days" (warning tone for amber, danger tone for red).
  - Separate small line: "Next: Day-off Nov 3" / "Next: On-leave Nov 5–Nov 9" / "Next: On-leave from Nov 5".
- **Empty**: "No drivers match."
- **Banner** (`stale-leave-banner.tsx`): "2 drivers have been on open-ended leave for 14 days or more."
  ("1 driver has been …"). It's danger-toned if any is red, warning-toned otherwise. It has a
  [Show them] button that sets `stale=1`, and an [X] (aria-label "Dismiss"). Dismissal is kept in
  `sessionStorage` (`rolnet:stale-banner-dismissed`).
- **Preview dropdown** (`availability-preview.tsx`, Popover on desktop, Sheet under 768 px):
  - Title "What the Assign driver dropdown lists on [date]", with a date input (default today).
  - The list shows "RA SHAA (Primary)" per available driver.
  - "Hidden on this date: 2 on day-off or leave · 1 inactive · 3 already assigned · 0 licence
    expired". Zero groups are omitted.
  - Note: "Stale leave flags don't change who is available."
- **Phones**: the table becomes stacked rows (the existing `DataTable` pattern). The toolbar wraps,
  and Add a driver keeps its label.

## Add driver modal (`add-driver-dialog.tsx`)

- Title "Add driver". The fields are in a 2-column grid from `sm`, 1 column below:
  - Full name*
  - Role* (two-option toggle Primary | Backup, default Primary)
  - Status (Active | Inactive, default Active)
  - Contact number* (`type="tel"`)
  - Licence number*
  - Licence expiry* (`type="date"`)
  - Address
  - Notes (textarea)
- Hint (muted, `Info` icon): "Day-off and On-leave are scheduled from the driver profile, because
  they need dates."
- Footer: [Cancel] [Save driver]. Inline field errors and a validation summary. Escape closes it.
  Focus is trapped (Base UI Dialog). On success it closes and shows the toast "Driver added".

## `/drivers/[id]` (profile)

**URL params**: `tab` (`assignments` default, `remittances`, `roles`, `absences`, `documents`), `rows` (8, +8 per Load more).

```text
← Back to drivers
Driver profile                                   [ Primary | Backup ]  [Status ▾]
RA SHAA
0917 123 4567 · Licence N01-23-456789
Notices (0..n)
┌Today's unit┐┌Remittances (30d)┐┌Balance owed┐┌Next absence / Last assignment┐
Details                                                        [Edit details]
  Full name · Contact · Licence · Licence expiry · Address · Role · Status today · Date joined · Notes
[Assignments][Remittances][Role history][Absences][Documents]
  table (8 rows)  [Load more]
```

- **Role switch** (`role-switch.tsx`): a Base UI `ToggleGroup` styled as segmented. It has
  `role="radiogroup"` and `aria-label="Driver role"`, and arrow keys move and select. Changing it
  calls `setDriverRole` and shows a toast with Undo (5 s), which calls `undoDriverRole`. It's
  disabled while pending and in demo mode.
- **Status dropdown** (`driver-status-control.tsx`): Active, Day-off, On-leave, Inactive. The value
  shows the status today.
  - Day-off or On-leave on an Inactive driver shows the toast "Inactive drivers cannot have absences".
  - Otherwise Day-off or On-leave opens the absence dialog with that type.
  - Active on an Inactive driver calls `setDriverStatus` and shows "[Name] is Active again" (owner only).
  - Active while absent today opens `return-to-active-dialog.tsx` (owner **and staff**, since it only
    ends the absence).
  - Inactive calls `driverReleasePreview`, then opens the release confirmation (locked rows listed as
    "kept (remittance recorded)"), then `setDriverStatus` (owner only).
  - Staff see Inactive disabled, and Active disabled for an Inactive driver, with the tooltip "Only the
    owner can change this."
- **Notices** (`driver-notices.tsx`, the `Notice` style from `feedback.tsx`): the copy is exactly as
  in spec User Story 5 scenario 2 and User Story 6 scenario 5.
  - The stale notice has buttons [Set end date] [End leave now] [Still on leave].
  - The upcoming notice adds "+N more upcoming." when there's more than one.
- **Summary strip** (`summary-strip.tsx`): 4 compact cards, `grid-cols-2` below `lg` and
  `grid-cols-4` from `lg`. Balance owed uses `text-danger` when above zero, formatted with
  `lib/money/centavos.ts`.
- **Details** (`driver-details-section.tsx`): a definition-list grid (2 columns from `sm`).
  - [Edit details] (owner only, hidden for Inactive drivers because details are locked) swaps in
    inputs, with [Save details] [Cancel].
- **Tabs** (`profile-tabs.tsx`): `role="tablist"` of links with roving tabindex and Left/Right/Home/End
  keys. The tab strip scrolls horizontally on phones (`overflow-x-auto`).
  - **Assignments**: Date | Unit (link) | Role that day.
  - **Remittances**: Date | Unit | Rental | Paid | Balance | Role that day. Rows with a balance use
    the `bg-danger-soft` row tint and show "Owes ₱X".
  - **Role history**: Date | Change ("Backup → Primary") | By | Time. Below it is "Status changes",
    the existing status history.
  - **Absences** (`absences-table.tsx`): [Add absence] above, disabled with a tooltip for Inactive
    drivers. Columns Type | Dates | Reason | Status | actions.
    - Dates: "Nov 5" / "Nov 5 to Nov 9" / "from Nov 1 (open-ended)". The note shows in a tooltip.
    - Status: a badge for Upcoming, Active now, Completed, Cancelled, or Ended early, plus an
      "Open N days" tag (warning or danger tone) and "Checked Nov 2" below.
    - Actions (dropdown menu): Upcoming has Edit and Cancel (with an alert-dialog confirm). Active
      now has Edit and End early (with an alert-dialog confirm).
  - **Documents** (owner only): the existing licence `DocumentList`.
  - Every tab: 8 rows, [Load more] while more exist, newest first.

## Absence dialog (`absence-dialog.tsx`)

- Title "Add absence · [Name]" or "Edit absence".
- **Type**: segmented "Day-off, one date | On-leave, date range".
- **Day-off**: Date*. **On-leave**: From*, To*, and the checkbox "No end date yet (open-ended)".
  Ticking it clears and disables To and removes the asterisk.
- **Reason***: select (Sick, Vacation, Family emergency, Personal, Other). **Note (optional)**: textarea.
- **Conflict**: an inline error under the dates with the database message.
- **Past dates**: an amber notice "Past dates selected. 3 assignments and 3 remittances already exist
  in this range. They will not be changed." The primary button reads "Save anyway".
- **"Set end date" entry**: open-ended is unticked, To is empty, and focus is on To.
- **Release step** (`release-confirm-dialog.tsx`, the same dialog, second view):
  - Title "Release assignments?". It lists "Nov 5 · Unit 3" rows, with the text "These units will be
    unassigned on these dates. Past records are not affected."
  - Buttons [Back] [Release and save].

## Return to Active dialog (`return-to-active-dialog.tsx`)

- Title "Return [Name] to Active?". Body "On leave Nov 3 to Nov 10." (or a day-off or open-ended
  variant).
- When upcoming absences exist, a checkbox "Also cancel N upcoming absences".
- Buttons [Keep absence] [End absence now]. End absence now calls `endAbsence` with
  `cancelUpcoming` and shows the toast "Leave ended. [Name] is available for assignment" (for a
  day-off, "[Name] is Active again").

## Cross-page

- **Units Daily assignment**: the dropdown drops absent drivers (FR-040). The label stays
  "Name (Role)" with the current role. Pre-fill is skipped when that driver isn't available.
- **Remittances daily cards**: `DriverTag` role = `roleOn(changes, current, serviceDate)`.
- **Unit detail page** (`/units/[id]`): the assignment history's Role column uses `roleOn` for each row's date (FR-029).
- **Dashboard**: the available backup drivers list leaves out drivers absent today (FR-064).
- **Audit page**: entity labels "Absences", "Leave checks", "Role changes".
