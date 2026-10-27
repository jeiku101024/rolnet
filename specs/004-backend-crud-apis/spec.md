# Feature Specification: Backend CRUD APIs

**Feature Branch**: `master` (no branch hook configured)

**Created**: 2026-10-27

**Status**: Draft

**Input**: User description: "Implement the backend side: CRUD APIs for all entities."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Read Fleet Records Consistently (Priority: P1)

An approved owner or staff member retrieves the fleet records permitted for their role. Lists and
individual records behave consistently so every application screen can rely on the same backend
contract.

**Why this priority**: Every operational workflow depends on accurate, authorized reads.

**Independent Test**: Seed every in-scope entity, request lists and individual records as owner and
staff, and verify fields, relationships, ordering, pagination, and role restrictions.

**Acceptance Scenarios**:

1. **Given** an approved owner and records for every in-scope entity, **When** the owner requests a
   list or one record, **Then** the owner receives the permitted current data and relationships.
2. **Given** approved staff, **When** staff request operational records, **Then** they receive only
   the records and fields needed for authorized work.
3. **Given** a list larger than one page, **When** successive pages are requested with unchanged
   filters, **Then** records appear once in a stable order with page metadata.
4. **Given** a missing, deleted, or inaccessible record, **When** it is requested, **Then** a stable
   error is returned without revealing whether a forbidden record exists.

---

### User Story 2 - Record Daily Fleet Operations (Priority: P1)

An owner or staff member creates and updates authorized mileage, remittances and payments, expenses
and receipts, part replacements, and tire installations. The same rules apply regardless of which
screen initiates the operation.

**Why this priority**: These records capture daily income, costs, and maintenance.

**Independent Test**: As staff, create one valid record for every operational entity, retrieve it,
perform every allowed update, and verify totals, maintenance state, timestamps, and attribution.

**Acceptance Scenarios**:

1. **Given** valid master records, **When** staff create authorized operational records, **Then**
   each record is saved once with its actor and timestamps.
2. **Given** an expense, mileage reading, part replacement, or tire installation, **When** staff
   submit an allowed update using the current record version, **Then** the change is saved.
3. **Given** a remittance, **When** staff update it, **Then** only notes may change and payments are
   appended without changing its original service facts or amount due.
4. **Given** an invalid relationship, amount, date, mileage, assignment, or uniqueness condition,
   **When** it is submitted, **Then** no partial change is saved and corrective guidance is returned.

---

### User Story 3 - Administer Fleet Master Data (Priority: P1)

An owner maintains units, drivers, assignments, days off, expense categories, compliance documents,
staff account states, and fleet settings through secured backend operations.

**Why this priority**: Operational entries require valid master data and enforceable owner-only
administration.

**Independent Test**: As owner, complete every supported lifecycle in the entity matrix; repeat the
same requests as staff and verify rejection without data changes.

**Acceptance Scenarios**:

1. **Given** an approved owner, **When** valid master data is created or updated, **Then** it is
   immediately available to permitted readers.
2. **Given** a pending staff registration, **When** the owner changes its state through an allowed
   transition, **Then** the new state, actor, and access effect are recorded.
3. **Given** approved staff, **When** staff attempt an owner-only mutation, **Then** it is denied and
   no field changes.
4. **Given** a document or receipt upload, **When** its metadata or relationship is invalid, **Then**
   it is not finalized and private storage details are not exposed.

---

### User Story 4 - Remove and Restore Records Safely (Priority: P2)

An owner removes an eligible business record from current use without erasing history and restores
it when doing so does not violate current rules. Staff cannot delete or restore records.

**Why this priority**: Safe lifecycle controls allow corrections without sacrificing auditability.

**Independent Test**: Soft-delete and restore each eligible entity as owner, verify current views
and calculations exclude deleted data, and confirm history and attribution remain available.

**Acceptance Scenarios**:

1. **Given** an eligible current record, **When** the owner deletes it, **Then** it disappears from
   current views and calculations but remains in history.
2. **Given** a deleted record with no new conflict, **When** the owner restores it, **Then** it
   returns to current views and the lifecycle remains auditable.
3. **Given** a change that would break a dependency or create a conflict, **When** it is submitted,
   **Then** it is rejected without a partial change and identifies the blocker.
4. **Given** staff, **When** they request deletion or restoration, **Then** access is denied.

---

### User Story 5 - Recover from Retries and Concurrent Edits (Priority: P2)

Application screens can retry after connection loss and detect concurrent changes, preventing
duplicate financial entries and silent overwrites.

**Why this priority**: Mobile use over variable connections must not corrupt the fleet ledger.

**Independent Test**: Repeat one create request and submit two updates based on one version; verify
one logical creation, one successful update, and one clear stale-record response.

**Acceptance Scenarios**:

1. **Given** a retried financial or file-finalization request with the same submission identity,
   **When** it arrives repeatedly, **Then** only one logical result exists.
2. **Given** two users editing one record version, **When** the first saves and the second submits,
   **Then** the second does not overwrite the first and receives current data for review.
3. **Given** a multi-record transition, **When** any rule fails, **Then** none of its related changes
   are committed.

### Edge Cases

- Unapproved, rejected, deactivated, and signed-out users cannot access fleet data.
- Invalid identifiers and malformed filters return validation errors without exposing internals.
- Empty lists return an empty collection and valid page metadata.
- Deleted records are excluded by default; only owners may request supported history views.
- Duplicate identifiers, remittances, payments, and upload finalizations never create duplicate
  business results.
- Retired or in-repair units, expired licenses, overlapping assignments, and backup conflicts obey
  the existing fleet rules.
- Money rejects fractional centavos, prohibited negatives, and unsupported bounds.
- Immutable fields remain protected even when the caller can otherwise update the entity.
- Receipt removal does not orphan files, and failed upload finalization creates no usable attachment.
- Document and tire replacement preserves history and leaves one unambiguous current record.
- Protected fields cannot be inferred through errors, filters, ordering, or relationship expansion.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide authenticated create, read, update, and removal operations for
  each in-scope entity according to the lifecycle matrix.
- **FR-002**: Every operation MUST enforce the existing owner/staff permissions at record and field
  level; screen visibility MUST NOT grant access.
- **FR-003**: Unapproved, rejected, deactivated, and unauthenticated callers MUST NOT receive fleet
  data or perform fleet mutations.
- **FR-004**: Each in-scope entity MUST support permitted single-record and list reads.
- **FR-005**: Lists MUST provide stable pagination, deterministic ordering, and documented filters
  and relationship expansions.
- **FR-006**: Current reads MUST exclude soft-deleted records by default. Only owner history reads
  may explicitly include them.
- **FR-007**: Mutations MUST validate fields, ranges, relationships, permissions, and domain rules
  before committing changes.
- **FR-008**: Mutations MUST record timestamps and actors; deletion, restoration, reversal,
  replacement, and account-state actions MUST be auditable.
- **FR-009**: Business records MUST use soft deletion. Normal operations MUST NOT permanently delete
  financial, maintenance, compliance, or audit history.
- **FR-010**: Eligible records MUST support owner-only restoration when it creates no current-rule
  conflict.
- **FR-011**: Money inputs and outputs MUST use integer centavos and totals MUST remain exact through
  every lifecycle operation.
- **FR-012**: Multi-record changes MUST complete fully or leave every affected record unchanged.
- **FR-013**: Financial creation and upload finalization MUST support safe retry identities.
- **FR-014**: Updates MUST detect stale versions, reject silent overwrites, and return enough current
  information for review.
- **FR-015**: Every operation MUST use consistent success and error outcomes with stable codes,
  plain-language messages, and field errors where applicable.
- **FR-016**: Errors MUST NOT expose secrets, persistence errors, private file locations, stack
  traces, or inaccessible record existence.
- **FR-017**: Units, drivers, assignments, days off, mileage readings, expense categories, expenses,
  part replacements, and tire installations MUST support create, permitted read/update, owner-only
  soft deletion, and owner-only restoration.
- **FR-018**: Profiles MUST support staff registration, permitted reads, display-name updates, and
  owner-controlled approval, rejection, deactivation, and reactivation, with no general hard delete.
- **FR-019**: Fleet settings MUST support permitted reads and owner-only updates; their required
  singleton record MUST have no general creation or deletion operation.
- **FR-020**: Remittances MUST support create/read, note-only updates, and owner-only audited
  reversal/restoration. Service facts, calculated due, and original actor MUST remain immutable.
- **FR-021**: Remittance payments MUST support append/read. Corrections MUST use an owner-only audited
  workflow rather than overwrite or hard deletion.
- **FR-022**: Expenses MUST allow an optional receipt through a validated prepare/finalize lifecycle;
  missing receipts MUST NOT block expense creation.
- **FR-023**: Documents MUST support owner-only create/read, metadata correction, renewal,
  supersession, soft deletion, and restoration while preserving one current holder/type record.
- **FR-024**: Driver-license document expiry MUST match the driver profile; renewal MUST update both
  consistently or leave both unchanged.
- **FR-025**: Assignment operations MUST prevent overlapping primary assignments and multiple actual
  operating assignments for one unit or driver on one date.
- **FR-026**: Maintenance operations MUST preserve nondecreasing mileage, ordered due thresholds,
  tire history, and one current tire per unit position.
- **FR-027**: Active expense-category dependencies MUST block unsafe category removal.
- **FR-028**: Audit events MUST offer owner-only list/detail reads and no general create, update,
  delete, or restore operation.
- **FR-029**: Notification-delivery records, authentication-provider identities, file objects, and
  derived reports/dashboard projections MUST NOT receive general CRUD through this feature.
- **FR-030**: Staff MAY create/update remittances, payments, mileage, expenses, parts, and tires but
  MUST NOT mutate master data, documents, profiles, settings, or deletion/restoration state.
- **FR-031**: All existing rules for rates, eligibility, documents, maintenance, receipts, and role
  access MUST remain authoritative.

### Entity Lifecycle Matrix

| Entity | Create | Read | Update / transition | Remove / restore |
|--------|--------|------|---------------------|------------------|
| Profile | Staff registration | Owner; own profile | Own display name; owner state changes | Deactivate/reactivate |
| Fleet setting | No general create | Permitted users | Owner | None |
| Unit | Owner | Owner/staff | Owner | Owner soft-delete/restore |
| Driver | Owner | Owner/staff operational fields | Owner | Owner soft-delete/restore |
| Driver assignment | Owner | Owner/staff operational fields | Owner | Owner soft-delete/restore |
| Driver day off | Owner | Owner/staff operational fields | Owner | Owner soft-delete/restore |
| Mileage reading | Owner/staff | Owner/staff | Owner/staff | Owner soft-delete/restore |
| Expense category | Owner | Owner/staff | Owner | Owner soft-delete/restore when eligible |
| Expense | Owner/staff | Owner/staff | Owner/staff | Owner soft-delete/restore |
| Remittance | Owner/staff | Owner/staff | Notes; owner correction | Owner reversal/restore |
| Remittance payment | Owner/staff append | Owner/staff | Owner corrective workflow | No general delete |
| Part replacement | Owner/staff | Owner/staff | Owner/staff | Owner soft-delete/restore |
| Tire installation | Owner/staff | Owner/staff | Owner/staff replacement | Owner soft-delete/restore |
| Compliance document | Owner | Owner | Owner correction/renewal | Owner soft-delete/restore |
| Audit event | System only | Owner | None | None |

### Key Entities *(include if feature involves data)*

- **Profile**: User display identity, role, approval state, and lifecycle attribution.
- **Fleet Setting**: Singleton fleet configuration for name, timezone, rates, and warning thresholds.
- **Unit**: Tricycle identity, make/model, operating status, and current mileage.
- **Driver**: Primary or backup driver, contact information, license, and status.
- **Driver Assignment**: Dated primary or backup relationship between a driver and unit.
- **Driver Day Off**: Dated primary-driver absence that may receive backup coverage.
- **Mileage Reading**: Dated unit odometer value.
- **Expense Category**: Owner-managed classification for unit expenses.
- **Expense**: Categorized unit cost with integer-centavo amount and optional receipt.
- **Remittance**: Daily amount due for an actual driver-unit assignment.
- **Remittance Payment**: Append-only dated payment against a remittance.
- **Part Replacement**: Maintenance event with cost and future due thresholds.
- **Tire Installation**: Tire-position history with replacement links and due thresholds.
- **Compliance Document**: Private fleet document with holder, expiry, lifecycle, and file metadata.
- **Audit Event**: Immutable owner-visible record of a business change.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Acceptance tests cover every matrix operation for 100% of the 15 in-scope entities,
  including every allowed and forbidden role.
- **SC-002**: 100% of unauthorized record and field operations are denied without data changes or
  protected-value disclosure.
- **SC-003**: Repeated financial and file-finalization submissions produce one logical result in
  100% of retry tests.
- **SC-004**: Stale updates are detected for every mutable entity and never silently overwrite newer
  data in concurrency tests.
- **SC-005**: With 100 units and 24 months of records, at least 95% of ordinary list/detail requests
  reach the consuming screen within one second and all complete within three seconds.
- **SC-006**: Controlled-dataset totals reconcile exactly after create, update, delete, restore,
  reversal, replacement, and retry scenarios.
- **SC-007**: 100% of tested business-record deletions remain recoverable and auditable while being
  excluded from current views and totals.
- **SC-008**: At least 9 of 10 non-technical participants complete an authorized create and update
  workflow without developer help, and all denied actions provide understandable guidance.

## Assumptions

- "All entities" means the user-facing business entities already defined by the fleet domain; it
  excludes auth-provider records, file objects, derived projections, and internal notification rows.
- Existing owner/staff permissions and business rules remain authoritative.
- CRUD is lifecycle-aware: append-only records, singleton settings, state transitions, renewal,
  reversal, and soft deletion replace unsafe generic update or delete behavior.
- The authenticated first-party web application is the initial consumer. Public developer access,
  API keys, cross-fleet tenancy, bulk import, and webhooks are out of scope.
- Dashboard summaries and monthly exports remain dedicated read workflows, not entities.
- Existing free-tier, monolithic, exact-money, audit, soft-deletion, and compliance constraints apply.
