# Feature Specification: Unit Name and Register Columns

**Feature Branch**: `007-unit-name-columns`

**Created**: 2026-10-30

**Status**: Draft

**Input**: User description: "Changes in unit page: 1. Unit is the name of the tricycle (e.g. "ROLNET-1"), 2. a separate body number column (e.g. "0633"), 3. Model is replaced by "motorcycle" (e.g. "Yamaha YTX"), 4. Current Driver column is added, 5. The rest stay the same, 6. if there will be model or table changes, do so. but if not, continue"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Name each tricycle (Priority: P1)

The owner gives every tricycle a short fleet name such as "ROLNET-1", separate from its body number ("0633"). The Units register shows the name in the **Unit** column and the body number in its own **Body number** column, so the owner can refer to a tricycle by the name the fleet actually uses.

**Why this priority**: Today a unit has no name; the register's Unit column shows "Body 0633". The name is new data, and every other change on the page builds on the register's new column layout.

**Independent Test**: Add a unit with name "ROLNET-1" and body number "0633", then open the Units register and confirm the row shows "ROLNET-1" under Unit (linking to the unit's page) and "0633" under Body number.

**Acceptance Scenarios**:

1. **Given** the owner is on the Units page, **When** they add a unit with name "ROLNET-1", body number "0633", plate, and motorcycle, **Then** the unit is saved and its row shows "ROLNET-1" in the Unit column and "0633" in the Body number column.
2. **Given** an active unit is already named "ROLNET-1", **When** the owner tries to add or rename another unit to "rolnet-1 " (different case or surrounding spaces), **Then** the save is rejected with a message that the name is already in use.
3. **Given** a unit exists, **When** the owner edits it on the unit's page and changes the name, **Then** the new name appears in the register and on the unit's page.
4. **Given** units existed before this feature, **When** the feature is released, **Then** each of them shows a name (initially its body number) and the owner can rename it.
5. **Given** the owner types "ROLNET-1" into the register's search, **When** results load, **Then** the matching unit is listed.

---

### User Story 2 - Show the motorcycle (Priority: P2)

The register's **Model** column becomes **Motorcycle**, showing the motorcycle the tricycle is built on (for example "Yamaha YTX"). The add and edit forms use the same "Motorcycle" label.

**Why this priority**: A label change on data that already exists; it makes the register match how the owner describes the vehicle, but nothing depends on it.

**Independent Test**: Open the Units register and confirm the column header reads "Motorcycle" and shows each unit's existing make and model; open the add form and confirm the field is labelled "Motorcycle".

**Acceptance Scenarios**:

1. **Given** a unit was recorded with make and model "Yamaha YTX", **When** the owner views the register, **Then** "Yamaha YTX" appears under the Motorcycle column.
2. **Given** the owner opens the add-unit form or the unit's edit form, **When** they look at the vehicle field, **Then** it is labelled "Motorcycle".

---

### User Story 3 - See who is driving each unit (Priority: P2)

The register gains a **Current driver** column showing who drives each unit today, so the owner can see the whole fleet's driver coverage at a glance without opening each unit.

**Why this priority**: High value for daily operations, but the data already exists through driver assignments; it is read-only on this page.

**Independent Test**: Assign a primary driver to one unit, leave another unassigned, record a backup covering a third unit's primary for today, then open the register and confirm each row's Current driver cell.

**Acceptance Scenarios**:

1. **Given** a unit has a primary driver assigned for today and that driver has no day off today, **When** the owner views the register, **Then** the Current driver column shows the primary driver's name.
2. **Given** a unit's primary driver has a day off today and a backup driver is covering it, **When** the owner views the register, **Then** the Current driver column shows the backup driver's name marked as "Backup".
3. **Given** a unit has no primary driver for today, **When** the owner views the register, **Then** the Current driver column shows "Unassigned" in a muted style.
4. **Given** a primary assignment has ended or starts in the future, **When** the owner views the register today, **Then** that driver is not shown as current.
5. **Given** a unit's primary driver has a day off today and no backup is assigned, **When** the owner views the register, **Then** the Current driver column shows "Day off · no backup" as a warning.

---

### Edge Cases

- A unit name is blank or only spaces: the add and edit forms reject it as required. A caller of the generic units API that leaves the name blank gets the body number instead (the same default existing units receive).
- A unit name longer than the allowed length (40 characters): rejected with a clear message.
- Two active units with the same name, ignoring case and surrounding spaces: rejected. A deleted unit's name may be reused.
- A pre-existing unit whose body number would clash with another unit's chosen name during backfill cannot happen, because body numbers are already unique; a later rename that clashes is rejected.
- The current driver's record is archived while still assigned: the register ignores that assignment and the unit shows "Unassigned" (archived drivers are not shown).
- Long names, motorcycle text, or driver names at a 360 px viewport: the register stays usable without overlapping columns. The page itself never scrolls sideways; the table may scroll inside its own bounded area, the interpretation of the mobile-first principle that feature 002 set for every table (002 spec FR-005, SC-005).
- Demo mode: the sample units show names and current drivers so the register looks complete without a database.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Each unit MUST have a name (1–40 characters after trimming), separate from its body number.
- **FR-002**: Unit names MUST be unique among non-deleted units, compared without regard to case or surrounding spaces.
- **FR-003**: The owner MUST be able to set the name when adding a unit and change it when editing a unit.
- **FR-004**: Units recorded before this feature MUST receive their body number as their initial name, so no unit is left without one.
- **FR-005**: The Units register MUST show these columns in this order: Unit (the name, linking to the unit's page), Body number, Plate, Motorcycle, Current driver, Mileage, Status.
- **FR-006**: The register's Motorcycle column MUST show the unit's existing make-and-model value; the add and edit forms MUST label that field "Motorcycle".
- **FR-007**: The Current driver column MUST show who operates the unit today, matching the unit page's "Operating driver": the primary driver whose assignment covers today; if that driver has a day off today, the backup covering it, marked "Backup", or "Day off · no backup" when none is assigned; and "Unassigned" when no primary assignment covers today.
- **FR-008**: Register search MUST match on the unit name in addition to the fields it matches today (body number, plate, motorcycle, status).
- **FR-009**: The register's sort options MUST include unit name A to Z and Z to A; existing sort and filter options stay available.
- **FR-010**: The unit's own page MUST show the unit's name as its title, with the body number still visible.
- **FR-011**: Name changes MUST be recorded in the audit history like other unit edits.
- **FR-012**: Status, mileage, plate, the add-unit panel, owner-only status changes, and pagination on the Units page MUST behave as they do today.
- **FR-013**: The register MUST remain usable at a 360 px viewport.

### Key Entities

- **Unit**: A tricycle in the fleet. Gains a **name** (fleet name such as "ROLNET-1"). Keeps body number, plate number, make and model (shown as "Motorcycle"), status, and current mileage.
- **Driver assignment** (existing, read-only here): Links a driver to a unit as primary (open-ended) or backup (single day, covering a primary). Determines the unit's current driver.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of units, including those recorded before release, show a non-empty name in the register.
- **SC-002**: The owner can identify the current driver of every unit from the register alone, without opening any unit page.
- **SC-003**: The owner can add a named unit in under 1 minute from the Units page.
- **SC-004**: Searching the register by a unit's exact name returns that unit as a result in every case.
- **SC-005**: At a 360 px viewport, every register column can be read without overlapping text.

## Assumptions

- "Unit" in the request means a new name field, not a renamed body number; body number stays as it is and gets its own column.
- "Motorcycle" is a relabel of the existing make-and-model field; no new data field is needed for it.
- "Current driver" means whoever operates the unit today, by the same rules as the unit page's "Operating driver": a backup takes over only on the primary driver's day off.
- Existing units are backfilled with their body number as the name; the owner renames them afterwards.
- Other screens that identify units by body number (remittances, expenses, maintenance, documents, reports, dashboard) are out of scope and stay as they are ("the rest stay the same").
- Sorting by current driver is out of scope; the column is display-only.
- Only the owner can add or edit units, as today; staff see the register read-only, including the new columns.
