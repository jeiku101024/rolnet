# Feature Specification: Driver and Unit Status Toggles with Edit Locking

**Feature Branch**: `005-status-locking`

**Created**: 2026-10-29

**Status**: Draft

**Input**: User description: "Allow toggle edit from active to inactive/left/kicked or returnee at drivers/{id} page. Also, in the /drivers and /units page tables with the status column, allow toggle dropdown that will make it active/inactive and updates database. For inactive or other status drivers, editing is blocked/locked for owner/staff unless toggled to active again. In units, if for repair, also editing details are locked unless toggled to active."

## Clarifications

### Session 2026-10-29

- Q: Should the lock also block daily operations (remittances, expenses, maintenance, mileage,
  documents) for a locked driver or unit? → A: No. The lock covers only the record's own details;
  daily operations keep working.
- Q: What does "Returnee" mean, and should Left, Kicked and Returnee be locked? → A: Drop Left,
  Kicked and Returnee. Drivers have only two statuses: Active and Inactive.
- Analysis follow-up (2026-10-29): a unit set to Retired keeps its current and upcoming
  assignments, as for In repair.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Change a driver's status from the driver page (Priority: P1)

The owner opens a driver's page and switches the driver between Active and Inactive. The new
status is saved at once, shown on the page, and kept in the driver's history.

**Why this priority**: Today the active flag can only be changed through the full edit form.
A direct status control is the core of this request and drives every other rule.

**Independent Test**: Open an active driver's page, set the driver to Inactive, reload, and see
Inactive kept; set it back to Active and see Active kept. Each change appears in the driver's
history with who made it and when.

**Acceptance Scenarios**:

1. **Given** an active driver with no current or upcoming assignments, **When** the owner sets the
   driver to Inactive on the driver page, **Then** the status is saved, the page shows Inactive,
   and the change is recorded with the owner and the time.
2. **Given** an inactive driver, **When** the owner sets the driver to Active, **Then** the status
   is saved and the driver's details become editable again.
3. **Given** an active driver with a current or upcoming assignment, **When** the owner sets the
   driver to Inactive, **Then** the change is refused with a plain message to end or remove the
   assignment first, and the status stays Active.
4. **Given** the status change fails to save (for example, the connection drops), **When** the
   owner retries, **Then** the page still shows the last saved status and no duplicate history
   entry is created.

---

### User Story 2 - Locked editing for inactive drivers and in-repair units (Priority: P1)

When a driver is Inactive, or a unit is In repair or Retired, the record's own details cannot be
edited. The page clearly shows that the record is locked and why, and offers the status control as
the only way to unlock it. Attempts to edit the details through any route are refused. Daily
operations linked to the driver or unit keep working.

**Why this priority**: Locking is what makes the status meaningful: it stops accidental changes
to people and vehicles that are not in service.

**Independent Test**: Set a driver to Inactive and a unit to In repair, then try to edit each
one's details from its page and through the app's data interface; every attempt is refused and
the page shows a locked notice. Record a maintenance entry and a mileage reading for the in-repair
unit, and see both saved. Set both records back to Active and edit their details successfully.

**Acceptance Scenarios**:

1. **Given** an inactive driver, **When** the owner opens the driver page, **Then** the detail
   fields are shown read-only with a notice naming the status, and the edit and save controls are
   not available.
2. **Given** a unit with status In repair or Retired, **When** the owner opens the unit page,
   **Then** the unit's details are read-only with a notice, and only the status control can change
   the unit's own details; daily-operation sections on the page stay usable.
3. **Given** a locked driver or unit, **When** anyone tries to change its details by any route
   (including a direct data request), **Then** the change is refused with a plain message and
   nothing is saved.
4. **Given** a locked driver or unit, **When** the owner changes its status back to Active,
   **Then** the details become editable without reloading the app.
5. **Given** an inactive driver, **When** someone tries to give the driver a new assignment,
   **Then** it is refused, as for inactive drivers today.
6. **Given** a locked driver or unit, **When** staff or the owner record daily operations linked
   to it (remittances, expenses, maintenance, parts, tires, mileage readings, documents), **Then**
   those records are accepted under their existing rules; the lock does not apply to them.

---

### User Story 3 - Change status from the drivers and units tables (Priority: P2)

On the drivers list and the units list, the Status column is a dropdown. The owner can change a
driver's or unit's status directly from the table without opening the record; the change is
saved straight away and the row updates.

**Why this priority**: It speeds up a common action across many records, but the same result is
already possible from each record's page (User Story 1).

**Independent Test**: On the units list, change a unit from Active to In repair from the Status
dropdown, reload, and see In repair kept; on the drivers list, change a driver to Inactive and
see it kept.

**Acceptance Scenarios**:

1. **Given** the units list, **When** the owner picks In repair in a unit's Status dropdown,
   **Then** the status is saved, the row shows In repair, and the unit's page shows it locked.
2. **Given** the drivers list, **When** the owner picks Inactive for a driver with no current or
   upcoming assignments, **Then** the status is saved and the row updates.
3. **Given** a status change from the table is refused (for example, a current assignment),
   **When** the refusal comes back, **Then** the dropdown returns to the saved status and a plain
   message explains why.
4. **Given** a 360 px wide phone screen, **When** the owner uses the Status dropdown, **Then** it
   fits without horizontal scrolling and can be operated by touch.
5. **Given** the list is being searched or filtered, **When** the owner changes a status,
   **Then** the search text and filters are kept.

---

### Edge Cases

- Two people change the same record's status at almost the same time: the later save must not
  silently overwrite a change it did not see; the second person is told the record changed and
  sees the current status.
- A driver whose license has expired is set back to Active: the status changes, but assignment
  rules for expired licenses still apply.
- A unit is set to In repair while it has current or upcoming assignments: assignments are kept
  (repair is usually short), and the unit page shows them with the locked notice.
- A unit is set to Retired: its current and upcoming assignments are kept, as for In repair, and
  the existing rule that retired units take no new assignments still applies, in addition to the
  lock.
- A license renewal for an Inactive driver: the renewal is accepted and updates the driver's
  license expiry, because documents are a daily operation.
- A mileage reading is recorded for a locked unit: it is accepted and updates the unit's current
  mileage, because mileage is a daily operation, not an edit of the unit's details.
- An archived (soft-deleted) driver or unit is not shown in the lists and its status cannot be
  changed until it is restored.
- Staff open the units or drivers list or a record page: they see the status as a read-only badge,
  with no status control or edit form (staff could already view these pages).
- The same status is picked again: nothing is saved and no history entry is added.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A driver MUST have exactly one of two statuses: Active or Inactive. Existing drivers
  keep their current active or inactive state.
- **FR-002**: A unit MUST keep its current statuses: Active, In repair, Retired.
- **FR-003**: The owner MUST be able to change a driver's status on the driver page and from the
  Status column on the drivers list.
- **FR-004**: The owner MUST be able to change a unit's status from the Status column on the units
  list and on the unit page.
- **FR-005**: Only approved owners MUST be able to change a driver's or unit's status; staff and
  pending users MUST be refused, whatever route they use.
- **FR-006**: The system MUST refuse to set a driver to Inactive while the driver has a current or
  upcoming assignment, with a message to end or remove it first.
- **FR-007**: While a driver is Inactive, the system MUST refuse every change to the driver's
  details (name, kind, license number and expiry, phone, address) by any route, and MUST refuse
  new assignments for that driver.
- **FR-008**: While a unit is In repair or Retired, the system MUST refuse every change to the
  unit's details (body number, plate number, make/model) by any route.
- **FR-009**: The lock MUST NOT block daily operations linked to a locked driver or unit
  (remittances, expenses, maintenance, parts, tires, mileage readings, documents); those keep
  their existing rules.
- **FR-010**: The driver and unit pages MUST show a locked record's details read-only, with a
  notice that names the status and says the record must be set to Active to edit it.
- **FR-011**: Every status change MUST be recorded in the record's history and the audit trail
  with the old status, the new status, who made the change, and when.
- **FR-012**: Status changes MUST be saved once even if the request is retried, and a change made
  from a stale view MUST be refused with the current status shown.
- **FR-013**: The status controls MUST show the saved status after a refused or failed change and
  explain the reason in plain language.
- **FR-014**: The status controls and locked pages MUST work on a 360 px wide screen without
  horizontal scrolling.
- **FR-015**: Each status MUST be shown with a label and an icon or style, not by colour alone.

### Key Entities *(include if feature involves data)*

- **Driver**: a person who drives units, with a status of Active or Inactive. Inactive drivers are
  locked.
- **Unit**: a tricycle, with a status of Active, In repair, or Retired. In repair and Retired units
  are locked.
- **Status change**: a history entry for a driver or unit with the old status, new status, actor,
  and time.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The owner can change a driver's or unit's status from the list in under 5 seconds and
  two taps, on a 360 px phone screen.
- **SC-002**: 100% of attempts to edit a locked driver's or unit's details are refused, whether
  through the app screens or a direct data request.
- **SC-003**: 100% of daily operations recorded for a locked driver or unit are accepted under
  their existing rules.
- **SC-004**: 100% of status changes appear in the record's history with old status, new status,
  actor, and time.
- **SC-005**: After setting a record back to Active, the owner can edit it on the first try,
  without reloading.
- **SC-006**: No existing driver or unit changes status when the feature is released.

## Assumptions

- Only the owner manages driver and unit records today (the drivers and units pages are
  owner-only); the lock therefore stops the owner's own edits and every direct data request.
  Staff keep their current access to daily operations.
- In the tables, the Status dropdown offers both driver statuses and all three unit statuses, so
  the tables and the record pages behave the same.
- Retired units are locked in the same way as In repair, because they are also out of service.
- Archiving (soft delete) and restoring records keep their current owner-only rules; this feature
  does not change them.
- Money, dates, and other existing rules from feature 001 are unchanged.
