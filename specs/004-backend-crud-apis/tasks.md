# Tasks: Backend CRUD APIs

**Input**: Design documents from `/specs/004-backend-crud-apis/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/http-api.md`, `quickstart.md`

**Tests**: Required because the specification defines permission, lifecycle, concurrency,
idempotency, transaction, performance, and usability acceptance criteria.

**Organization**: Tasks are grouped by user story so each story can be implemented and validated as
an independent increment after the shared foundation.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it targets different files and has no incomplete dependency
- **[Story]**: Maps the task to a user story in `spec.md`
- Every implementation task names its exact repository path

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish API-specific test support and directories without adding a second application.

- [ ] T001 Add authenticated owner, approved-staff, pending-staff, deactivated-staff, and signed-out request fixtures in `tests/integration/api/fixtures.ts`
- [ ] T002 [P] Add reusable JSON request/response and cookie-session test helpers in `tests/integration/api/helpers.ts`
- [ ] T003 [P] Add an API integration test script that targets `tests/integration/api/**/*.test.ts` in `package.json`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Create the shared security, HTTP, persistence-audit, and validation boundary required by every resource.

**⚠️ CRITICAL**: No user-story implementation begins until this phase passes.

- [ ] T004 Add a safe business-change audit trigger that classifies insert/update/soft-delete/restore and excludes tokens, checksums, and private object paths in `supabase/migrations/20261027000100_add_complete_business_audit.sql`
- [ ] T005 [P] Prove audit rows are actor-attributed, immutable, and sanitized across all business tables in `supabase/tests/constraints/080_business_audit.sql`
- [ ] T006 [P] Define `ApiSuccess`, `ApiError`, stable error codes, database-error mappings, and non-leaking fallback behavior in `lib/api/errors.ts`
- [ ] T007 [P] Implement JSON-body, UUID, same-origin, approved-session, permission, and `Idempotency-Key` parsing helpers in `lib/api/request.ts`
- [ ] T008 [P] Implement `{ data, meta? }` success responses, error envelopes, private/no-store headers, and ETag formatting in `lib/api/response.ts`
- [ ] T009 [P] Implement strict `page` (1-based), `pageSize` (25 default, 100 maximum), allow-listed sort/direction/include parsing, count metadata, and primary-key tie-breaking in `lib/api/pagination.ts`
- [ ] T010 Create a server-only request context that returns the user-scoped Supabase client, approved profile, and role without a service key in `lib/domain/context.ts`
- [ ] T011 Test stable errors, origin checks, pagination bounds, forbidden-field rejection, no-store headers, and hidden inaccessible records in `tests/unit/api-foundation.test.ts`

**Checkpoint**: Shared API boundary is secure, audited, deterministic, and testable.

---

## Phase 3: User Story 1 - Read Fleet Records Consistently (Priority: P1) 🎯 MVP

**Goal**: Owner and staff can list and retrieve every permitted entity through consistent, paginated, role-specific JSON reads.

**Independent Test**: Seed all 15 entities, request collection/item routes as every account state,
and verify DTO fields, relationships, pagination, deterministic ordering, and non-disclosure.

### Tests for User Story 1

- [ ] T012 [P] [US1] Add collection/item contract tests for all 15 entities, empty results, invalid queries, stable pages, ETags, includes, 401/403/404 behavior, and owner/staff DTO differences in `tests/integration/api/read-resources.test.ts`
- [ ] T013 [P] [US1] Add owner/staff/anonymous RLS read cases for current, deleted, document, profile, settings, and audit rows in `supabase/tests/rls/080_api_reads_rls.sql`
- [ ] T014 [P] [US1] Add DTO redaction tests proving staff never receive audit/profile/document fields or private object paths in `tests/unit/api-dtos.test.ts`

### Implementation for User Story 1

- [ ] T015 [P] [US1] Define unit, driver, assignment, day-off, profile, and settings DTOs plus owner/staff projections in `lib/domain/master-data/dtos.ts`
- [ ] T016 [P] [US1] Define mileage, category, expense, remittance, payment, part, and tire DTOs with integer-centavo derived totals in `lib/domain/operations/dtos.ts`
- [ ] T017 [P] [US1] Define compliance-document DTOs, fleet-local expiry status, and sanitized immutable audit-event DTOs in `lib/domain/compliance/dtos.ts`
- [ ] T018 [P] [US1] Define allow-listed read filters/sorts/includes for units, drivers, assignments, days off, profiles, and settings in `lib/validation/api-master-data.ts`
- [ ] T019 [P] [US1] Define allow-listed read filters/sorts/includes for mileage, categories, expenses, remittances, payments, parts, and tires in `lib/validation/api-operations.ts`
- [ ] T020 [P] [US1] Define owner-only document/audit filters and reject private storage-field selection in `lib/validation/api-compliance.ts`
- [ ] T021 [US1] Implement permission-aware master-data list/detail queries with current-row defaults and deterministic pagination in `lib/domain/master-data/queries.ts`
- [ ] T022 [P] [US1] Implement permission-aware operational list/detail queries and exact remittance payment/balance/credit aggregation in `lib/domain/operations/queries.ts`
- [ ] T023 [P] [US1] Implement owner-only document/audit reads with sanitized DTOs and existing expiry rules in `lib/domain/compliance/queries.ts`
- [ ] T024 [US1] Add unit, driver, assignment, day-off, mileage, and expense-category GET handlers in `app/api/v1/units/route.ts`, `app/api/v1/units/[id]/route.ts`, `app/api/v1/drivers/route.ts`, `app/api/v1/drivers/[id]/route.ts`, `app/api/v1/assignments/route.ts`, `app/api/v1/assignments/[id]/route.ts`, `app/api/v1/driver-days-off/route.ts`, `app/api/v1/driver-days-off/[id]/route.ts`, `app/api/v1/mileage-readings/route.ts`, `app/api/v1/mileage-readings/[id]/route.ts`, `app/api/v1/expense-categories/route.ts`, and `app/api/v1/expense-categories/[id]/route.ts`
- [ ] T025 [P] [US1] Add expense, remittance, payment, part, and tire GET handlers in `app/api/v1/expenses/route.ts`, `app/api/v1/expenses/[id]/route.ts`, `app/api/v1/remittances/route.ts`, `app/api/v1/remittances/[id]/route.ts`, `app/api/v1/remittances/[id]/payments/route.ts`, `app/api/v1/remittance-payments/[id]/route.ts`, `app/api/v1/part-replacements/route.ts`, `app/api/v1/part-replacements/[id]/route.ts`, `app/api/v1/tire-installations/route.ts`, and `app/api/v1/tire-installations/[id]/route.ts`
- [ ] T026 [P] [US1] Add profile, settings, document, and audit GET handlers in `app/api/v1/profiles/route.ts`, `app/api/v1/profiles/[userId]/route.ts`, `app/api/v1/fleet-settings/route.ts`, `app/api/v1/documents/route.ts`, `app/api/v1/documents/[id]/route.ts`, `app/api/v1/audit-events/route.ts`, and `app/api/v1/audit-events/[id]/route.ts`
- [ ] T027 [US1] Refactor authenticated page reads to call shared query services directly rather than self-fetching Route Handlers in `app/(operations)/expenses/page.tsx`, `app/(operations)/remittances/page.tsx`, `app/(operations)/maintenance/page.tsx`, `app/(owner)/units/page.tsx`, `app/(owner)/drivers/page.tsx`, `app/(owner)/documents/page.tsx`, and `app/(owner)/audit/page.tsx`

**Checkpoint**: User Story 1 independently provides consistent, authorized reads for all entities.

---

## Phase 4: User Story 2 - Record Daily Fleet Operations (Priority: P1)

**Goal**: Owner and staff can create and perform allowed updates for mileage, expenses/receipts,
remittances/payments, parts, and tires with exact money and atomic maintenance behavior.

**Independent Test**: As approved staff, create each operational entity, update every mutable field,
append payments, attach a receipt, replace a tire, and verify invariants, attribution, and totals.

### Tests for User Story 2

- [ ] T028 [P] [US2] Add API mutation tests for valid/invalid operational creates and updates, immutable remittance fields, optional receipts, money bounds, and role denials in `tests/integration/api/operational-mutations.test.ts`
- [ ] T029 [P] [US2] Add database tests for mileage recalculation, receipt finalization, payment append, due thresholds, and atomic tire replacement in `supabase/tests/constraints/090_operational_crud.sql`
- [ ] T030 [P] [US2] Add staff/owner mutation allow-deny tests for all operational tables/functions in `supabase/tests/rls/090_operational_crud_rls.sql`

### Implementation for User Story 2

- [ ] T031 [US2] Add atomic mileage recalculation, receipt finalization, and tire replacement functions with grants/RLS in `supabase/migrations/20261027000200_add_operational_crud_functions.sql`
- [ ] T032 [P] [US2] Extend mileage validation for `reading_date`, non-negative `mileage`, optional `notes`, uniqueness per unit/date, and the verbatim rule "nondecreasing by date" in `lib/validation/maintenance.ts`
- [ ] T033 [P] [US2] Extend expense validation for required unit/category/date, verbatim rule "positive `amount_centavos`", optional notes, and receipt rule "MIME is JPEG/PNG/WebP and size is 1-512000 bytes" in `lib/validation/expenses.ts`
- [ ] T034 [P] [US2] Extend remittance/payment validation for active assignment/date, `returned|overnight_overtime`, notes-only updates, verbatim rule "positive `amount_centavos`", and immutable service identity in `lib/validation/remittances.ts`
- [ ] T035 [US2] Extend maintenance validation with part constraints "`part_name` (1-120)", "non-negative `cost_centavos`", "at least one next-due threshold", ordered dates/mileage, and tire constraints "position (`front|rear_left|rear_right`)", "brand (1-80)", and one current tire in `lib/validation/maintenance.ts`
- [ ] T036 [US2] Implement mileage, expense/receipt, remittance/payment, part, and tire create/update services using user-scoped queries and narrow RPCs in `lib/domain/operations/mutations.ts`
- [ ] T037 [US2] Add POST/PATCH and receipt/tire transition handlers in `app/api/v1/mileage-readings/route.ts`, `app/api/v1/mileage-readings/[id]/route.ts`, `app/api/v1/expenses/route.ts`, `app/api/v1/expenses/[id]/route.ts`, `app/api/v1/expenses/[id]/receipt/prepare/route.ts`, `app/api/v1/expenses/[id]/receipt/finalize/route.ts`, `app/api/v1/remittances/route.ts`, `app/api/v1/remittances/[id]/route.ts`, `app/api/v1/remittances/[id]/payments/route.ts`, `app/api/v1/part-replacements/route.ts`, `app/api/v1/part-replacements/[id]/route.ts`, `app/api/v1/tire-installations/route.ts`, `app/api/v1/tire-installations/[id]/route.ts`, and `app/api/v1/tire-installations/[id]/replace/route.ts`
- [ ] T038 [US2] Refactor existing operational Server Actions into thin adapters over shared mutation services in `app/actions/mileage.ts`, `app/actions/expenses.ts`, `app/actions/remittances.ts`, `app/actions/parts.ts`, and `app/actions/tires.ts`

**Checkpoint**: User Story 2 independently records daily operations without duplicating domain rules.

---

## Phase 5: User Story 3 - Administer Fleet Master Data (Priority: P1)

**Goal**: Owners can manage master entities, account states, settings, assignments, categories, and
compliance-document lifecycle while staff mutations remain forbidden.

**Independent Test**: Complete every owner master-data lifecycle and document upload/renewal, repeat
as staff, and verify valid state, private files, atomic driver-license synchronization, and denial.

### Tests for User Story 3

- [ ] T039 [P] [US3] Add owner master-data and staff-denial API tests for units, drivers, assignments, days off, categories, profiles, settings, and documents in `tests/integration/api/master-data-mutations.test.ts`
- [ ] T040 [P] [US3] Add constraint/transaction tests for assignments, last-owner protection, system categories, document holder/type rules, renewal, and license synchronization in `supabase/tests/constraints/100_master_data_crud.sql`
- [ ] T041 [P] [US3] Add RLS/function tests proving only owners mutate master data/documents and staff cannot infer private file metadata in `supabase/tests/rls/100_master_data_crud_rls.sql`

### Implementation for User Story 3

- [ ] T042 [US3] Add atomic backup coverage and document renewal/license synchronization functions with restricted grants in `supabase/migrations/20261027000300_add_master_data_crud_functions.sql`
- [ ] T043 [P] [US3] Extend unit validation with verbatim constraints "`body_number` (1-40)", "`plate_number` (1-20)", "`make_model` (1-120)", normalized active uniqueness, and status `active|in_repair|retired` in `lib/validation/units.ts`
- [ ] T044 [P] [US3] Extend driver validation with verbatim constraints "`full_name` (1-160)", kind `primary|backup`, unique `license_number`, required `license_expiry_date`, `phone`, optional `address`, and `is_active` in `lib/validation/drivers.ts`
- [ ] T045 [P] [US3] Add assignment/day-off/category validation for non-overlapping primary ranges, one unit/driver per backup date, active licensed drivers, non-retired units, day-off inside primary range, category `name` (1-80), and immutable system keys in `lib/validation/master-data.ts`
- [ ] T046 [P] [US3] Extend document validation for type `or_cr|driver_license|mtop_franchise|insurance`, exactly one holder, required expiry, image/PDF MIME, size 1-5242880 bytes, one current holder/type record, and matching driver-license expiry in `lib/validation/documents.ts`
- [ ] T047 [US3] Implement unit, driver, assignment, day-off, category, profile-state, and settings mutation services in `lib/domain/master-data/mutations.ts`
- [ ] T048 [P] [US3] Implement prepare/finalize, metadata correction, renewal/supersession, and signed-URL services without exposing private paths in `lib/domain/compliance/mutations.ts`
- [ ] T049 [US3] Add owner mutation/state-transition handlers in `app/api/v1/units/route.ts`, `app/api/v1/units/[id]/route.ts`, `app/api/v1/drivers/route.ts`, `app/api/v1/drivers/[id]/route.ts`, `app/api/v1/assignments/route.ts`, `app/api/v1/assignments/[id]/route.ts`, `app/api/v1/driver-days-off/route.ts`, `app/api/v1/driver-days-off/[id]/route.ts`, `app/api/v1/expense-categories/route.ts`, `app/api/v1/expense-categories/[id]/route.ts`, `app/api/v1/profiles/[userId]/route.ts`, `app/api/v1/profiles/[userId]/approve/route.ts`, `app/api/v1/profiles/[userId]/reject/route.ts`, `app/api/v1/profiles/[userId]/deactivate/route.ts`, `app/api/v1/profiles/[userId]/reactivate/route.ts`, `app/api/v1/fleet-settings/route.ts`, `app/api/v1/documents/uploads/prepare/route.ts`, `app/api/v1/documents/[id]/finalize/route.ts`, and `app/api/v1/documents/[id]/signed-url/route.ts`
- [ ] T050 [US3] Refactor master-data and document Server Actions into thin adapters over shared services in `app/actions/units.ts`, `app/actions/drivers.ts`, `app/actions/assignments.ts`, `app/actions/auth.ts`, and `app/actions/documents.ts`

**Checkpoint**: User Story 3 independently provides owner administration with staff isolation.

---

## Phase 6: User Story 4 - Remove and Restore Records Safely (Priority: P2)

**Goal**: Owners can soft-delete and safely restore eligible records while history and dependent
calculations remain correct and staff cannot invoke lifecycle removal.

**Independent Test**: Delete and restore every eligible entity, test dependency/conflict failures,
and reconcile current views, totals, derived mileage/current tire/document state, and audit history.

### Tests for User Story 4

- [ ] T051 [P] [US4] Add API lifecycle tests for each eligible entity, owner-only history, category-in-use, restore conflicts, remittance reversal, payment correction, and receipt detachment in `tests/integration/api/delete-restore.test.ts`
- [ ] T052 [P] [US4] Add database tests proving no physical deletes, safe restore constraints, derived-value recalculation, required reversal reasons, and complete audit history in `supabase/tests/constraints/110_delete_restore.sql`
- [ ] T053 [P] [US4] Add RLS tests proving staff cannot delete, restore, reverse, correct, detach receipts, or read deleted history in `supabase/tests/rls/110_delete_restore_rls.sql`

### Implementation for User Story 4

- [ ] T054 [US4] Add narrow owner-only soft-delete/restore functions for eligible tables plus remittance reversal, payment correction, receipt detachment, dependency checks, and mileage/current-state recalculation in `supabase/migrations/20261027000400_add_delete_restore_functions.sql`
- [ ] T055 [US4] Implement lifecycle mutation services that require reasons where specified, classify `CATEGORY_IN_USE`/`RESTORE_CONFLICT`, and never issue physical deletes in `lib/domain/lifecycle/mutations.ts`
- [ ] T056 [US4] Add DELETE and `POST /restore` adapters for eligible core resources in `app/api/v1/units/[id]/route.ts`, `app/api/v1/drivers/[id]/route.ts`, `app/api/v1/assignments/[id]/route.ts`, `app/api/v1/driver-days-off/[id]/route.ts`, `app/api/v1/mileage-readings/[id]/route.ts`, `app/api/v1/expense-categories/[id]/route.ts`, `app/api/v1/expenses/[id]/route.ts`, `app/api/v1/part-replacements/[id]/route.ts`, and `app/api/v1/tire-installations/[id]/route.ts`
- [ ] T057 [US4] Add named lifecycle handlers in `app/api/v1/remittances/[id]/reverse/route.ts`, `app/api/v1/remittances/[id]/restore/route.ts`, `app/api/v1/remittance-payments/[id]/correct/route.ts`, `app/api/v1/remittance-payments/[id]/restore/route.ts`, `app/api/v1/expenses/[id]/receipt/route.ts`, `app/api/v1/documents/[id]/route.ts`, and `app/api/v1/documents/[id]/restore/route.ts`
- [ ] T058 [US4] Refactor existing owner corrections/deletions to shared lifecycle services in `app/actions/remittance-corrections.ts`, `app/actions/units.ts`, `app/actions/drivers.ts`, `app/actions/expenses.ts`, `app/actions/parts.ts`, `app/actions/tires.ts`, and `app/actions/documents.ts`

**Checkpoint**: User Story 4 independently proves recoverable, auditable, owner-only removal.

---

## Phase 7: User Story 5 - Recover from Retries and Concurrent Edits (Priority: P2)

**Goal**: Mutable requests reject stale versions, retryable financial/upload operations produce one
logical result, and multi-row transitions never partially commit.

**Independent Test**: Replay every protected request key, reuse a key with different content, submit
stale and missing ETags, and force each transaction's last step to fail.

### Tests for User Story 5

- [ ] T059 [P] [US5] Add API tests for ETag/If-Match success, missing 428, stale 409 with current DTO, equivalent retry replay, and changed-content idempotency conflict in `tests/integration/api/concurrency-idempotency.test.ts`
- [ ] T060 [P] [US5] Add database tests for durable expense/remittance/payment/receipt/document retry identities and rollback of every multi-row function in `supabase/tests/constraints/120_concurrency_idempotency.sql`

### Implementation for User Story 5

- [ ] T061 [US5] Add unique `expenses.receipt_finalize_key`, unique `documents.idempotency_key`, request fingerprints where needed, and supporting indexes without changing existing business rows in `supabase/migrations/20261027000500_add_api_idempotency.sql`
- [ ] T062 [P] [US5] Implement ETag parsing, `If-Match` precondition enforcement, stale-result DTOs, UUID idempotency parsing, and request fingerprint comparison in `lib/api/concurrency.ts`
- [ ] T063 [US5] Apply expected-`updated_at` conditional writes and durable replay handling across `lib/domain/master-data/mutations.ts`, `lib/domain/operations/mutations.ts`, `lib/domain/compliance/mutations.ts`, and `lib/domain/lifecycle/mutations.ts`
- [ ] T064 [US5] Apply ETag responses, `If-Match`, and `Idempotency-Key` requirements consistently to all mutable handlers under `app/api/v1/`
- [ ] T065 [US5] Add 360 px Playwright recovery coverage for retry, stale edit review, field guidance, and forbidden action feedback in `tests/e2e/backend-api-recovery.spec.ts`

**Checkpoint**: User Story 5 independently proves safe retries, concurrency, and transaction rollback.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Complete schema typing, performance, end-to-end contract coverage, documentation, and release gates.

- [ ] T066 Regenerate the complete Supabase schema after all migrations and replace partial declarations in `types/database.ts`
- [ ] T067 [P] Add representative 100-unit/24-month API seed fixtures without production-only credentials in `supabase/seed.sql`
- [ ] T068 Measure collection query plans and add only demonstrated filter/order indexes in `supabase/migrations/20261027000600_optimize_api_queries.sql`
- [ ] T069 [P] Add full route-matrix smoke coverage for all methods/status codes and forbidden unsupported methods in `tests/e2e/backend-api-contract.spec.ts`
- [ ] T070 [P] Document implemented request examples, lifecycle caveats, and stable errors by reconciling code with `specs/004-backend-crud-apis/contracts/http-api.md`
- [ ] T071 Run every command and manual acceptance scenario in `specs/004-backend-crud-apis/quickstart.md`, recording any environment-specific deviations in `specs/004-backend-crud-apis/validation.md`
- [ ] T072 Re-run the constitution review for free-tier quotas, monolith boundaries, integer-centavo handling, audit/soft deletion, mobile recovery, and document expiry in `specs/004-backend-crud-apis/plan.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Starts immediately.
- **Foundational (Phase 2)**: Depends on Setup and blocks all stories.
- **US1 (Phase 3)**: Starts after Foundation and establishes shared reads/DTOs used by later stories.
- **US2 (Phase 4)**: Depends on Foundation and US1 DTO/query conventions; operational mutation work
  can begin in parallel with US3 after US1 contracts stabilize.
- **US3 (Phase 5)**: Depends on Foundation and US1 DTO/query conventions; can run beside US2.
- **US4 (Phase 6)**: Depends on US2 and US3 because deletion/restoration wraps their resources.
- **US5 (Phase 7)**: Depends on US2-US4 mutation services so concurrency/idempotency is applied once
  across the final mutation surface.
- **Polish (Phase 8)**: Depends on all selected user stories.

### User Story Dependency Graph

```text
Setup → Foundation → US1 Reads ─┬→ US2 Operations ─┐
                                └→ US3 Master Data ─┴→ US4 Lifecycle → US5 Resilience → Polish
```

### Within Each User Story

- Write contract, database, and RLS tests first and confirm they fail for the intended reason.
- Apply migrations before generating types or implementing services that call new functions.
- Validation/DTOs precede services; services precede Route Handlers and Server Action adapters.
- Complete the independent test before treating the story as ready for the next dependent phase.

### Parallel Opportunities

- T002-T003, T005-T009, and each story's independent test files can run in parallel.
- US1 DTO/validation tasks T015-T020 and query tasks T022-T023 are separable by domain.
- After US1 stabilizes, US2 and US3 can be assigned to different developers.
- Within US2, T032-T034 are parallel and T035 follows T032 in the shared maintenance schema; within
  US3, T043-T046 are parallel.
- Polish fixtures, e2e contract coverage, and contract reconciliation can run concurrently after the
  final schema and route surface stabilize.

---

## Parallel Execution Examples

### User Story 1

```text
Task T015: master-data DTOs in lib/domain/master-data/dtos.ts
Task T016: operational DTOs in lib/domain/operations/dtos.ts
Task T017: compliance DTOs in lib/domain/compliance/dtos.ts
Task T018-T020: domain-specific query validation files
```

### User Story 2 and User Story 3

```text
Developer A: T028-T038 (daily operational mutations)
Developer B: T039-T050 (owner master-data administration)
```

### User Story 4

```text
Task T051: HTTP lifecycle tests
Task T052: database lifecycle tests
Task T053: RLS lifecycle tests
```

### User Story 5

```text
Task T059: HTTP concurrency/idempotency tests
Task T060: database retry/rollback tests
Task T062: shared concurrency helpers after contract expectations are fixed
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Complete Setup and Foundation.
2. Complete US1 read DTOs, queries, and all resource GET handlers.
3. Stop and run US1 contract/RLS/redaction tests.
4. Demonstrate consistent authorized reads before adding mutations.

### Incremental Delivery

1. **MVP**: shared foundation + US1 reads.
2. Add US2 daily operational mutations and validate exact money/maintenance behavior.
3. Add US3 owner administration and private document lifecycle.
4. Add US4 recoverable deletion/restoration and correction workflows.
5. Add US5 cross-resource concurrency/idempotency guarantees.
6. Finish performance, full route matrix, mobile recovery, and constitution gates.

### Parallel Team Strategy

After Foundation and US1:

- Developer A owns operational schema/services/routes/tests (US2).
- Developer B owns master/compliance schema/services/routes/tests (US3).
- Both converge on the shared DTO/error contract before US4 and US5.

## Notes

- `[P]` marks tasks that touch different files and have no unfinished prerequisite.
- No task introduces a second backend, ORM, paid service, broad CORS, or service-role routine access.
- Migrations must preserve existing data and pass a clean database reset.
- Commit after each task or coherent migration/test/service/route group.
