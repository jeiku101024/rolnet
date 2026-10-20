# Feature Specification: Tricycle Fleet Management

**Feature Branch**: `main` (no branch hook configured)

**Created**: 2026-10-19

**Status**: Draft

**Input**: User description: "Build a tricycle fleet management system for an owner operating multiple tricycle units, with owner and staff roles, fleet records, remittances, expenses, maintenance, document expiry alerts, dashboards, and CSV reports."

## Clarifications

### Session 2026-10-19

- Q: How should the daily or weekly remittance schedule be selected? → A: Remittance is daily:
  ₱180 when the unit is returned to the garage, or ₱300 total when the driver keeps the unit
  overnight for overtime.
- Q: Which records should staff be allowed to create and edit? → A: Staff can create and edit
  remittances, expenses, and maintenance records only.
- Q: Must every expense include a receipt photo before it can be saved? → A: No. Receipt photos are
  optional, and expenses without one must be clearly flagged.
- Q: How should the 30-day and 7-day document-expiry alerts be delivered in version 1? → A: In-app
  dashboard alerts only.
- Q: Can a unit or driver have more than one active assignment at the same time? → A: Each unit has
  a primary driver, while backup drivers ("extradors") cover units on primary drivers' days off.
  Each unit and driver can have only one actual operating assignment per calendar date.
- Q: Which expiry date should be authoritative when a driver profile and uploaded driver-license
  document contain different dates? → A: The driver profile's license expiry is authoritative. An
  uploaded driver-license document must match it, and a license renewal updates both records in one
  transaction.
- Q: How should the owner create and manage staff accounts? → A: Staff may self-register, but an
  owner must approve each account before it can access the application.
- Q: How should the owner review audit history? → A: Provide both a global owner-only audit log and
  a per-record history view.
- Q: After a remittance is saved, which fields should staff be allowed to change? → A: Staff may edit
  notes and add payments, while the service date, driver, unit, disposition, and calculated due stay
  locked. Owners correct mistakes through an audited reversal and replacement entry.
- Q: What acceptance method should be used for the usability and performance targets? → A: Use a
  repeatable acceptance run with 10 non-technical participants, a 100-unit/24-month dataset, a
  360-pixel phone viewport, and a preview deployment; record task completion, entry times, and
  dashboard response times.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Maintain Units, Drivers, and Assignments (Priority: P1)

The owner maintains an accurate register of tricycle units and drivers, manages each unit's primary
driver, records primary-driver days off, and assigns backup drivers ("extradors") for day-off
coverage. Staff cannot create or change these core records. The owner can see the scheduled and
actual driver for each date and the complete history of primary and backup assignments.

**Why this priority**: Units, drivers, and their assignments are the foundation for all money,
maintenance, compliance, dashboard, and reporting records.

**Independent Test**: Create two units, primary drivers, and one backup driver; schedule a primary
driver's day off, assign the backup for that date, and verify that current, substitute, and
historical assignments are accurate.

**Acceptance Scenarios**:

1. **Given** an owner is signed in, **When** the owner creates a unit with a unique body number and
   plate number, **Then** the unit appears with its make/model and selected operating status.
2. **Given** a driver profile with contact and license details, **When** the driver is assigned to a
   unit, **Then** the unit shows that driver as current and the assignment start date is recorded.
3. **Given** a current assignment, **When** the owner reassigns the unit, **Then** the prior
   assignment receives an end date and remains visible in assignment history.
4. **Given** a staff user, **When** the user opens settings or attempts to delete a record, **Then**
   the action is unavailable and no data is changed.
5. **Given** a primary driver's scheduled day off, **When** the owner assigns an available backup
   driver for that date, **Then** the backup is the unit's operating driver for that date while the
   primary assignment remains in effect for other dates.
6. **Given** a backup driver is already covering a unit on a date, **When** the owner attempts to
   assign that driver or unit to another coverage assignment on the same date, **Then** the system
   rejects the conflict and identifies the existing coverage.

---

### User Story 2 - Track Remittances and Balances (Priority: P1)

The owner or staff records whether the driver returned the assigned unit to the garage or kept it
overnight for overtime. The system applies the corresponding daily remittance due, records payments,
shows the remaining balance, and preserves partial and unpaid remittances.

**Why this priority**: Remittance tracking is the fleet's primary income record and enables the
owner to identify unpaid balances promptly.

**Independent Test**: Record standard and bring-home/overtime days plus full, partial, and unpaid
payments for one assignment, then verify each daily amount due and the driver's total outstanding
balance.

**Acceptance Scenarios**:

1. **Given** an active driver-unit assignment and the unit is returned to the garage, **When** the
   daily remittance is recorded, **Then** the amount due is ₱180.
2. **Given** an active driver-unit assignment and the driver keeps the unit overnight for overtime,
   **When** the daily remittance is recorded, **Then** the amount due is ₱300 total.
3. **Given** a partial payment, **When** an additional payment is recorded for the same remittance
   period, **Then** the total paid and remaining balance update without losing payment history.
4. **Given** an unpaid balance, **When** the owner views the driver or dashboard, **Then** the
   outstanding amount and related unit and period are visible.
5. **Given** a remittance without an active assignment for that date, **When** the user attempts
   to save it, **Then** the system rejects it and explains how to correct the assignment or date.

---

### User Story 3 - Record Expenses and Maintenance (Priority: P1)

The owner or staff records expenses, replacement parts, tires, receipt photos, and mileage so the
owner can understand unit costs and see maintenance items that are due.

**Why this priority**: Accurate operating costs and due maintenance directly affect safety,
availability, and profitability.

**Independent Test**: Add categorized expenses, a part replacement, and tires in all supported
positions for one unit, then advance its date or mileage and verify that due items are identified.

**Acceptance Scenarios**:

1. **Given** an existing unit, **When** a fuel, repair, registration, or insurance expense is
   recorded, **Then** the category, date, integer-centavo amount, unit, and receipt photo are saved.
2. **Given** no receipt photo is available, **When** an expense is saved, **Then** the expense is
   accepted and clearly flagged as missing a receipt.
3. **Given** a part replacement, **When** the part, cost, replacement date, and optional next due
   date or mileage are saved, **Then** the replacement appears in the unit's maintenance history.
4. **Given** a tire installation, **When** the position, brand, install date, cost, and replacement
   due value are saved, **Then** the current tire for that position and its history are visible.
5. **Given** the current date or unit mileage reaches a replacement threshold, **When** the owner
   opens the dashboard, **Then** the due part or tire is shown with its unit and due basis.

---

### User Story 4 - Track Compliance Documents (Priority: P1)

The owner uploads OR/CR, driver licenses, MTOP franchise documents, and insurance records with
expiry dates. The owner sees in-app warnings before documents expire.

**Why this priority**: Missing or expired documents can prevent units and drivers from operating
legally and can create avoidable penalties or downtime.

**Independent Test**: Add documents expiring in 31, 30, 7, 1, and 0 days and verify the correct
normal, 30-day, urgent 7-day, and expired states.

**Acceptance Scenarios**:

1. **Given** a supported document type, **When** its file, holder or unit, expiry date, and details
   are saved, **Then** the document can be found from the related driver or unit.
2. **Given** a document expires within 30 days but more than 7 days, **When** the dashboard is
   opened, **Then** it appears in the 30-day warning state.
3. **Given** a document expires within 7 days, **When** the dashboard is opened, **Then** it appears
   in a distinct urgent warning state.
4. **Given** an expired document, **When** the dashboard is opened, **Then** it is clearly marked
   expired and remains visible until replaced or resolved.

---

### User Story 5 - Review Fleet Performance Dashboard (Priority: P2)

The owner opens a phone-friendly dashboard to review monthly income and expenses per unit, expiring
documents, due maintenance, and drivers with unpaid balances.

**Why this priority**: A consolidated view helps the owner act without manually reviewing every
record, but it depends on the underlying operational records.

**Independent Test**: Seed one month of records across multiple units and confirm that totals,
alerts, due items, and balances match the source records and can be opened for detail.

**Acceptance Scenarios**:

1. **Given** remittance and expense records for a selected month, **When** the owner opens the
   dashboard, **Then** each unit shows paid income, categorized expenses, and net result.
2. **Given** expiring documents, due maintenance, and unpaid balances, **When** the owner opens the
   dashboard, **Then** each item is grouped by action needed and links to its underlying record.
3. **Given** a phone-sized display, **When** the owner uses every dashboard section, **Then** all
   information and actions remain usable without horizontal scrolling.

---

### User Story 6 - Export Monthly Reports (Priority: P3)

The owner selects a month and exports a CSV summary for one unit or the whole fleet for bookkeeping
and offline review.

**Why this priority**: Export is important for reconciliation and sharing, but daily operations can
continue using on-screen records while it is developed.

**Independent Test**: Export unit and fleet reports for a known month and reconcile all income,
expense, balance, and net totals against the dashboard and source records.

**Acceptance Scenarios**:

1. **Given** a selected month and unit, **When** the owner requests an export, **Then** a CSV is
   produced with unit identity, remittance due and paid, outstanding balance, expense totals by
   category, and net result.
2. **Given** a selected month, **When** the owner requests a fleet export, **Then** the CSV contains
   each unit's summary and whole-fleet totals.
3. **Given** no records for the selected month, **When** an export is requested, **Then** a valid
   CSV with headers and zero totals is produced.

### Edge Cases

- Duplicate body or plate numbers are rejected with a clear message identifying the conflict.
- Retired units remain in historical records but cannot receive new assignments or remittances.
- Units marked in repair remain reportable and retain history; the user is warned before creating
  an active assignment or remittance for the repair period.
- A driver with an expired license is visibly flagged and cannot receive a new active assignment.
- An uploaded driver-license document whose expiry date differs from the driver profile is rejected
  with guidance to correct the date; a renewal updates both records atomically.
- A self-registered staff account remains pending and cannot sign in or access data until an owner
  approves it; the owner can reject or deactivate staff accounts.
- The owner can review audit events in a global log or from the related record; staff cannot view
  audit history.
- Staff cannot change a saved remittance's service date, driver, unit, disposition, or calculated
  due; they may edit notes and add payments. Owner corrections use an audited reversal and replacement
  entry.
- Primary assignment ranges cannot overlap for the same unit. Day-off coverage may overlap a
  primary assignment, but each unit and each driver can have only one operating assignment on a
  calendar date.
- Only one remittance record is allowed for an assignment on a calendar date; a repeated submission
  returns the existing record instead of creating a duplicate amount due.
- Remittance overpayments are recorded as a non-negative credit rather than a negative balance.
- Repeated payment entries cannot silently create duplicate payments for the same submission.
- Expense, part, tire, remittance, or document records linked to history are soft-deleted only by
  the owner and are excluded from current totals while remaining auditable.
- Replacing a document, part, or tire closes the prior current record but preserves its history.
- Missing receipt photos do not block expense entry, but the record is visibly marked as having no
  receipt; an unreadable or failed upload produces a recoverable error.
- Due-date boundaries use the fleet's local calendar date, including exactly 30 and exactly 7 days.
- CSV values containing commas, quotes, line breaks, or Philippine characters export correctly.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST authenticate users and assign each user exactly one role: owner or
  staff. Staff may self-register, but a staff account MUST remain pending and unable to access the
  application until an owner approves it.
- **FR-002**: The owner MUST have access to all records, dashboards, reports, user management, and
  system settings, including approving, rejecting, and deactivating staff accounts.
- **FR-003**: Staff MUST be able to view the operational context needed for data entry and create or
  update remittances, expenses, and maintenance records. Staff MUST NOT create or modify units,
  drivers, assignments, documents, users, or settings, and MUST NOT delete records, view
  owner-only dashboards and reports, or export reports.
- **FR-004**: The system MUST record creation and last-update timestamps and the responsible user
  for every business record.
- **FR-005**: Owner deletion actions MUST soft-delete records and retain their history; normal
  application workflows MUST NOT permanently delete business records.
- **FR-006**: The system MUST store all monetary amounts as integer centavos and display them as
  Philippine peso amounts to users.
- **FR-007**: The owner MUST be able to create and update units with a unique body number, unique
  plate number, make/model, and status of active, in repair, or retired.
- **FR-008**: The owner and staff MUST be able to maintain a current mileage reading and dated
  mileage history for each unit as part of maintenance encoding.
- **FR-009**: The owner MUST be able to create and update driver profiles containing the driver's
  name, contact information, license number, and license expiry date. The driver profile's license
  expiry date is authoritative for assignment eligibility.
- **FR-010**: The system MUST prevent a new active assignment when the driver's license is expired.
- **FR-011**: The owner MUST be able to assign a primary driver to a unit with start and end dates,
  classify drivers as primary or backup, record primary-driver days off, assign an available backup
  driver to cover a unit for a date, and view complete primary and backup assignment history from
  both the unit and driver.
- **FR-012**: The system MUST prevent overlapping primary assignment periods for the same unit,
  prevent more than one operating driver for a unit on a calendar date, prevent a driver from
  operating more than one unit on a calendar date, and prevent assignments to retired units.
- **FR-013**: Users MUST be able to record one daily remittance for an active driver-unit assignment,
  including the date, whether the unit was returned to the garage or kept overnight for overtime,
  and one or more payments.
- **FR-013a**: Staff MUST be able to edit remittance notes and add payments after creation, but MUST
  NOT change the service date, driver, unit, disposition, or calculated amount due. Owner corrections
  MUST use an audited reversal and replacement entry.
- **FR-014**: The system MUST set the daily amount due to 18,000 centavos when the unit is returned
  to the garage or 30,000 centavos total when it is kept overnight for overtime, then calculate
  total paid, remaining balance, and any overpayment credit without allowing a negative balance.
- **FR-015**: The system MUST preserve individual payment dates, amounts, and encoders for audit and
  reconciliation.
- **FR-016**: Users MUST be able to view each driver's outstanding remittances with the associated
  units and periods.
- **FR-017**: Users MUST be able to record a unit expense with category, date, integer-centavo
  amount, optional notes, and an optional receipt photo. An expense without a receipt photo MUST be
  saved successfully and clearly flagged as missing a receipt.
- **FR-018**: Expense categories MUST include fuel, repairs, registration, and insurance; the owner
  MAY manage additional categories through settings.
- **FR-019**: Users MUST be able to log a replacement part by unit with part name, cost, replacement
  date, optional replacement mileage, and an optional next-replacement date or mileage.
- **FR-020**: Users MUST be able to log tire installation by unit with position of front,
  rear-left, or rear-right, brand, install date, cost, and a next-replacement date or mileage.
- **FR-021**: The system MUST preserve replacement history and identify the current tire in each
  position and the latest installed instance of each tracked part.
- **FR-022**: The system MUST mark parts and tires due when the current date or mileage meets or
  exceeds their configured next-replacement threshold.
- **FR-023**: The owner MUST be able to upload and record OR/CR, driver license, MTOP franchise, and
  insurance documents with document type, related unit or driver, issue details, expiry date,
  status, and file attachment. A driver-license document's expiry date MUST match the authoritative
  driver profile, and renewing it MUST update both records in one transaction.
- **FR-024**: The system MUST make a document discoverable from its related unit or driver and MUST
  preserve superseded document history.
- **FR-025**: The system MUST classify documents as valid, due within 30 days, due within 7 days,
  or expired based on the fleet's local calendar date and show the warning on the owner's dashboard.
  Version 1 MUST NOT send expiry alerts through email, SMS, or push notifications.
- **FR-026**: The dashboard MUST show paid remittance income, expenses by category, and net result
  for each unit for a user-selected month.
- **FR-027**: The dashboard MUST show expired and expiring documents, due parts and tires, and
  drivers with outstanding balances, with navigation to the related record.
- **FR-028**: The owner MUST be able to export a monthly CSV summary for one unit or the whole fleet.
- **FR-029**: Each monthly CSV MUST include unit identity, remittance due, remittance paid,
  outstanding balance, expenses by category, total expenses, and net result, plus fleet totals when
  exporting the whole fleet.
- **FR-030**: Current views, calculations, and exports MUST exclude soft-deleted records while an
  owner-accessible global audit log and per-record history views retain them.
- **FR-031**: All owner and staff workflows MUST be usable on a phone-sized display, use plain
  language, and provide corrective guidance when validation or upload actions fail.
- **FR-032**: Version 1 MUST NOT include GPS tracking, payroll processing, or payment gateway
  integration.

### Key Entities *(include if feature involves data)*

- **User**: A person who accesses the system; has an owner or staff role and an activity history.
- **Unit**: A tricycle identified by body and plate numbers, with make/model, operating status,
  current mileage, documents, assignments, financial records, and maintenance history.
- **Mileage Reading**: A dated odometer value for a unit used to assess mileage-based maintenance.
- **Driver**: A primary or backup driver profile with contact details, license identity and expiry,
  days off, assignments, remittances, and documents.
- **Assignment**: A dated relationship between one driver and one unit, identified as a primary
  assignment or a one-day backup coverage assignment, preserving scheduled and actual operating
  responsibility.
- **Remittance**: One daily amount due for an assignment, including whether the unit was returned or
  kept overnight for overtime, with calculated paid, balance, and credit values.
- **Remittance Payment**: An individual dated payment against a remittance, including amount and
  encoding user.
- **Expense**: A categorized, dated unit cost with an amount, optional notes, and optional receipt.
- **Part Replacement**: A unit maintenance event with part, cost, replacement date or mileage, and
  optional next-replacement threshold.
- **Tire Installation**: A tire history record for a unit position with brand, date, cost, and
  next-replacement threshold.
- **Document**: An uploaded compliance record of a supported type, related to a unit or driver,
  with issue details, expiry date, lifecycle status, and supersession history.
- **Audit Record**: The actor, timestamps, and soft-deletion state that preserve accountability for
  business-record changes; visible to the owner through a global log and related-record history.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In a repeatable usability run with 10 non-technical participants at a 360-pixel phone
  viewport, at least 90% can complete their authorized workflows without assistance on the first try:
  owners can create a unit and driver, while owner and staff participants can record an expense and
  remittance.
- **SC-002**: In the same acceptance run, a practiced staff user can record a standard expense with
  a receipt in under 90 seconds and a remittance payment in under 60 seconds on a phone.
- **SC-003**: On the preview deployment, for a test fleet of 100 units with 24 months of records, the
  owner sees any selected monthly dashboard within 3 seconds of requesting it.
- **SC-004**: For a controlled monthly dataset, dashboard and CSV income, expense, balance, and net
  totals reconcile to the source records with 100% accuracy and no centavo rounding differences.
- **SC-005**: All test documents at the 30-day, 7-day, and expired boundaries appear in the correct
  alert state, with zero missed or early alerts.
- **SC-006**: All parts and tires whose date or mileage threshold has been reached appear as due,
  while no item below both thresholds appears as due.
- **SC-007**: Permission testing confirms that staff can complete all authorized encoding workflows
  and cannot perform deletion, settings, user-management, or report-export actions.
- **SC-008**: Every primary workflow is fully operable at a 360-pixel-wide viewport without
  horizontal scrolling or reliance on hover interactions.
- **SC-009**: Monthly unit and fleet CSV files open successfully in common spreadsheet applications
  and reconcile to the on-screen monthly summary for all acceptance datasets.

## Assumptions

- Version 1 serves one fleet organization, one owner role, and multiple staff accounts.
- Staff may view the operational context needed to encode remittances, expenses, and maintenance.
  Units, drivers, assignments, documents, dashboards, reports, exports, user management, soft
  deletion, and settings are owner-only.
- Each unit has at most one primary driver assignment at a time. A backup driver may temporarily
  cover a unit on the primary driver's day off, but each unit and each driver has only one actual
  operating assignment per calendar date.
- Remittance is daily and its amount due is automatic: ₱180 for a unit returned to the garage or
  ₱300 total for a unit kept overnight for overtime.
- Remittance payments are recorded after they occur outside the system; version 1 does not collect
  or transfer money.
- Expense receipt photos are encouraged but optional because paper receipts can be missing.
- Expiry alerts are shown on the owner's in-app dashboard only; email, SMS, and push notifications
  are outside version 1.
- Replacement reminders use a due date, a mileage threshold, or whichever occurs first when both
  are supplied. Users maintain current unit mileage for mileage-based reminders.
- Monthly income means remittance payments received during the selected month; net result means
  paid remittance income minus recorded expenses for that month.
- Dates and monthly boundaries use the fleet's configured local timezone.
