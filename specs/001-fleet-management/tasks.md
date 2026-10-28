# Tasks: Tricycle Fleet Management

**Input**: Design documents from `specs/001-fleet-management/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Tests**: Only the automated tests required by the specification and security contract are included: database constraints/RLS, exact financial calculations, upload authorization, expiry boundaries, CSV reconciliation, mobile workflows, and Workers compatibility.

**Organization**: Foundation is completed first. The seven delivery slices then proceed in the requested priority order; each slice is independently testable and ends with an explicit checkpoint. Slice labels are delivery labels: US1 units/drivers, US2 expenses, US3 remittances, US4 parts/tires, US5 documents, US6 dashboard, and US7 reports.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it changes different files and has no unfinished dependency
- **[Story]**: Functional slice (`US1` through `US7`); setup and foundation tasks intentionally have no story label
- Every task names the exact file or directory it changes

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initialize the single Next.js application and local toolchain without implementing business stories.

- [X] T001 Scaffold the Next.js 16.4 App Router TypeScript application with Tailwind CSS in `package.json`, `app/layout.tsx`, `app/page.tsx`, and `app/globals.css`
- [X] T002 Add Supabase SSR/client, Zod, React Hook Form, image compression, shadcn/ui utilities/CLI, vinext, Vitest, Playwright, and Supabase CLI dependencies and scripts in `package.json`; initialize `components.json`, `lib/utils.ts`, and `components/ui/button.tsx`
- [X] T003 [P] Configure TypeScript strict mode and application path aliases in `tsconfig.json`
- [X] T004 [P] Configure ESLint, Vitest, and Playwright with a 360 px mobile project in `eslint.config.mjs`, `vitest.config.ts`, and `playwright.config.ts`
- [X] T005 [P] Configure vinext and Cloudflare Workers Free deployment in `vite.config.ts` and `wrangler.jsonc`
- [X] T006 [P] Configure Next.js security headers and a Supabase-compatible Content Security Policy in `next.config.ts`
- [X] T007 Initialize the local Supabase project and migration paths in `supabase/config.toml` and `supabase/seed.sql`
- [X] T008 [P] Document public Supabase and Cloudflare variables without secrets in `.env.example`
- [X] T009 Verify the scaffold with lint, typecheck, unit-test discovery, `vinext check`, and a Workers build, then record the baseline in `specs/001-fleet-management/validation/setup.md`

---

## Phase 2: Foundation (Blocking Prerequisites)

**Purpose**: Establish authentication, roles, RLS primitives, auditability, validation, and the mobile-first shell used by every story.

**CRITICAL**: T010-T026 MUST be complete before any user-story task starts.

- [X] T010 Create shared PostgreSQL enums including `profile_status`, audit columns, timestamp/actor triggers, soft-delete protection, role/approval helper functions, and indexes in `supabase/migrations/20261019000100_create_shared_database_primitives.sql`
- [X] T011 Create the `profiles` table with `profile_status` values `pending`, `approved`, `rejected`, or `deactivated`, approval actor/timestamp fields, Auth-user trigger, last-approved-owner safeguards, timestamps, actors, and soft-delete constraints in `supabase/migrations/20261019000200_create_profiles.sql`
- [X] T012 Add RLS for `profiles` with deny-by-default anonymous policies, no data access for pending/rejected/deactivated staff, owner approval/rejection/deactivation management, and minimum approved-staff identity access in `supabase/migrations/20261019000300_add_profiles_rls.sql`
- [X] T013 Create and seed the singleton `fleet_settings` table with `Asia/Manila`, 18,000/30,000-centavo rates, and 30/7-day thresholds in `supabase/migrations/20261019000400_create_fleet_settings.sql`
- [X] T014 Add RLS for `fleet_settings` with owner-write and authenticated operational-read policies in `supabase/migrations/20261019000500_add_fleet_settings_rls.sql`
- [X] T015 Create the append-only `audit_events` table and safe audit triggers in `supabase/migrations/20261019000600_create_audit_events.sql`
- [X] T016 Add RLS for `audit_events` with owner-read-only access and denied application updates/deletes in `supabase/migrations/20261019000700_add_audit_events_rls.sql`
- [X] T017 [P] Implement browser, server, and middleware Supabase clients with cookie-backed sessions in `lib/supabase/client.ts`, `lib/supabase/server.ts`, and `lib/supabase/middleware.ts`
- [X] T018 [P] Define the owner/staff permission matrix and server-side role guards in `lib/permissions/roles.ts` and `lib/auth/guards.ts`
- [X] T019 Implement login, logout, staff self-registration, pending-account blocking, owner approve/reject/deactivate actions, and the PKCE callback in `app/(auth)/login/page.tsx`, `app/(auth)/register/page.tsx`, `app/(owner)/settings/staff/page.tsx`, `app/actions/auth.ts`, and `app/api/auth/callback/route.ts`
- [X] T020 [P] Implement the serializable action result envelope, safe error codes, and same-origin mutation guard in `lib/actions/result.ts` and `lib/auth/same-origin.ts`
- [X] T021 [P] Implement integer-centavo parsing/formatting and fleet-local date helpers in `lib/money/centavos.ts` and `lib/dates/fleet-date.ts`
- [X] T022 [P] Create reusable Zod audit, UUID, date, idempotency, and centavo schemas in `lib/validation/common.ts`
- [X] T023 Build the role-aware, mobile-first application shell, bottom navigation, loading/error states, and 360 px responsive styles in `app/layout.tsx`, `components/navigation/mobile-nav.tsx`, and `components/navigation/app-shell.tsx`
- [X] T024 [P] Write required pgTAP coverage for anonymous denial, pending-staff denial, owner approval/rejection/deactivation, owner/staff profile/settings permissions, immutable actor/deletion fields, and append-only audit events in `supabase/tests/rls/001_foundation_rls.sql`
- [X] T025 [P] Write the required 360 px self-registration, pending-block, owner-approval, approved-staff, and forbidden-navigation journey in `tests/e2e/foundation-auth.spec.ts`
- [X] T026 Complete the foundation checkpoint by running a clean database reset plus self-registration, approval/RLS, and mobile-shell checks and recording results in `specs/001-fleet-management/validation/foundation.md`

---

## Phase 3: User Story 1 - Units and Drivers (Priority: 1) MVP

**Goal**: Let the owner manage units, primary and backup drivers, license expiry, days off, mileage, and conflict-free assignment history while staff receive read-only operational context.

**Independent Test**: At 360 px, create two units, two primary drivers, and one backup driver; assign primaries, record a day off, cover it with the backup, verify both histories, reject a same-date conflict and expired license, and confirm staff cannot mutate master records.

- [X] T027 [US1] Create the `units` table with normalized unique body/plate numbers, status transitions, current mileage, audit fields, and soft deletion in `supabase/migrations/20261019001000_create_units.sql`
- [X] T028 [US1] Add owner CRUD/soft-delete and minimum staff operational-read RLS for `units` in `supabase/migrations/20261019001100_add_units_rls.sql`
- [X] T029 [US1] Create the `drivers` table with primary/backup kind, unique normalized license, expiry, contact details, audit fields, and soft deletion in `supabase/migrations/20261019001200_create_drivers.sql`
- [X] T030 [US1] Add owner CRUD/soft-delete and minimum staff operational-read RLS for `drivers` in `supabase/migrations/20261019001300_add_drivers_rls.sql`
- [X] T031 [US1] Create the `driver_assignments` table with exclusion constraints for primary ranges and transactional backup-coverage conflict checks in `supabase/migrations/20261019001400_create_driver_assignments.sql`
- [X] T032 [US1] Add owner mutation and minimum staff operational-read RLS for `driver_assignments` in `supabase/migrations/20261019001500_add_driver_assignments_rls.sql`
- [X] T033 [US1] Create the `driver_days_off` table with assignment-range and unique active date constraints in `supabase/migrations/20261019001600_create_driver_days_off.sql`
- [X] T034 [US1] Add owner mutation and minimum staff operational-read RLS for `driver_days_off` in `supabase/migrations/20261019001700_add_driver_days_off_rls.sql`
- [X] T035 [US1] Create the `mileage_readings` table and transactionally maintain nondecreasing `units.current_mileage` in `supabase/migrations/20261019001800_create_mileage_readings.sql`
- [X] T036 [US1] Add owner/staff create-update-read and owner-only soft-delete RLS for `mileage_readings` in `supabase/migrations/20261019001900_add_mileage_readings_rls.sql`
- [X] T037 [P] [US1] Write required pgTAP tests for uniqueness, authoritative profile/document license-expiry matching, expired-license/retired-unit rejection, range conflicts, backup coverage conflicts, mileage ordering, soft deletion, and the units/drivers RLS matrix in `supabase/tests/constraints/010_units_drivers.sql` and `supabase/tests/rls/010_units_drivers_rls.sql`
- [X] T038 [P] [US1] Define unit, driver, assignment, day-off, and mileage Zod schemas in `lib/validation/units.ts` and `lib/validation/drivers.ts`
- [X] T039 [US1] Implement owner unit and driver create/update/soft-delete actions with stale-write protection and authoritative profile license expiry in `app/actions/units.ts` and `app/actions/drivers.ts`
- [X] T040 [US1] Implement transactional primary assignment, day-off, backup coverage, and mileage actions with plain-language conflict errors in `app/actions/assignments.ts` and `app/actions/mileage.ts`
- [X] T041 [P] [US1] Build mobile unit list/detail/forms with current driver, mileage, status, and assignment history in `app/(owner)/units/page.tsx`, `app/(owner)/units/[id]/page.tsx`, and `components/forms/unit-form.tsx`
- [X] T042 [P] [US1] Build mobile driver list/detail/forms with kind, license expiry state, days off, backup coverage, and assignment history in `app/(owner)/drivers/page.tsx`, `app/(owner)/drivers/[id]/page.tsx`, and `components/forms/driver-form.tsx`
- [ ] T043 [US1] Complete the units/drivers checkpoint by running the independent test and recording owner/staff, conflict, expiry, history, and 360 px results in `specs/001-fleet-management/validation/us1-units-drivers.md`

---

## Phase 4: User Story 2 - Expenses (Priority: 2)

**Goal**: Let owner and staff log categorized per-unit expenses in integer centavos, optionally attach a compressed private receipt, and clearly identify missing receipts.

**Independent Test**: As staff on a phone, save each seeded category, save one expense without a receipt, compress and upload a large receipt image to the private bucket, edit the expense, and confirm owner-only deletion and cross-record storage access denial.

- [X] T044 [US2] Create and seed the `expense_categories` table with fuel, repairs, registration, and insurance in `supabase/migrations/20261019002000_create_expense_categories.sql`
- [X] T045 [US2] Add authenticated read, owner category management, and protected system-category RLS for `expense_categories` in `supabase/migrations/20261019002100_add_expense_categories_rls.sql`
- [X] T046 [US2] Create the `expenses` table with positive bigint centavos, optional receipt metadata, unique idempotency key, audit fields, and soft deletion in `supabase/migrations/20261019002200_create_expenses.sql`
- [X] T047 [US2] Add owner/staff create-update-read and owner-only soft-delete RLS for `expenses` in `supabase/migrations/20261019002300_add_expenses_rls.sql`
- [X] T048 [US2] Create the private `receipts` bucket with 500 KB hard limits and owner/staff path-to-expense Storage policies in `supabase/migrations/20261019002400_create_receipts_storage.sql`
- [X] T049 [P] [US2] Write required pgTAP coverage for centavo constraints, idempotency, missing receipts, soft deletion, expense RLS, and receipt path isolation in `supabase/tests/constraints/020_expenses.sql` and `supabase/tests/rls/020_expenses_storage_rls.sql`
- [X] T050 [P] [US2] Implement Canvas/Web Worker image resizing and JPEG/WebP compression targeting 300 KB in `lib/uploads/compress-image.ts` and `lib/uploads/hash-file.ts`
- [X] T051 [US2] Define expense and receipt upload/finalization Zod schemas in `lib/validation/expenses.ts`
- [X] T052 [US2] Implement idempotent expense create/update, owner soft-delete, direct-upload preparation/finalization, and short-lived signed receipt URLs in `app/actions/expenses.ts` and `lib/uploads/receipts.ts`
- [X] T053 [US2] Build the staff-capable mobile expense list/form with peso-to-centavo input, compression progress, upload recovery, and a visible missing-receipt state in `app/(operations)/expenses/page.tsx` and `components/forms/expense-form.tsx`
- [ ] T054 [US2] Complete the expenses checkpoint by running the independent test and recording category, centavo, upload-size, private-access, missing-receipt, role, and 360 px results in `specs/001-fleet-management/validation/us2-expenses.md`

---

## Phase 5: User Story 3 - Remittances (Priority: 3)

**Goal**: Let owner and staff record one remittance for the actual driver/unit/day, automatically charge ₱180 returned or ₱300 overnight/overtime, accept multiple payments, and preserve exact balance and credit history.

**Independent Test**: Record returned and overnight/overtime days for primary and backup assignments, add full/partial/unpaid/overpayments, retry idempotent requests, and verify due, paid, balance, credit, and conflict handling exactly in centavos.

- [X] T055 [US3] Create the `remittances` table with actual-assignment checks, unit/driver daily uniqueness, trigger-set 18,000/30,000-centavo due amounts, and idempotent creation function in `supabase/migrations/20261019003000_create_remittances.sql`
- [X] T056 [US3] Add owner/staff create-update-read and owner-only soft-delete/reversal RLS for `remittances` in `supabase/migrations/20261019003100_add_remittances_rls.sql`
- [X] T057 [US3] Create the `remittance_payments` table with positive immutable payments, unique idempotency keys, and transactional balance/credit queries in `supabase/migrations/20261019003200_create_remittance_payments.sql`
- [X] T058 [US3] Add owner/staff create-read and owner-only reversal RLS for `remittance_payments` in `supabase/migrations/20261019003300_add_remittance_payments_rls.sql`
- [X] T059 [P] [US3] Write required pgTAP tests for fixed rates, actual primary/backup assignment resolution, daily uniqueness, retired/repair warnings, idempotency, payment immutability, balances, credits, soft deletion, and remittance RLS in `supabase/tests/constraints/030_remittances.sql` and `supabase/tests/rls/030_remittances_rls.sql`
- [X] T060 [P] [US3] Define disposition, payment, and centavo-safe remittance Zod schemas in `lib/validation/remittances.ts`
- [X] T061 [US3] Implement create-remittance, staff note edits, and add-payment actions using database transactions and stable conflict codes; lock service date, assignment, disposition, calculated due, actor, and deletion fields in `app/actions/remittances.ts`
- [X] T062 [US3] Implement owner-only reversal and soft-delete actions that preserve history and emit audit events in `app/actions/remittance-corrections.ts`
- [X] T063 [P] [US3] Build the phone-first daily remittance form with assignment lookup, returned/overnight choice, computed due, payment entry, and duplicate-submit protection in `components/forms/remittance-form.tsx`
- [X] T064 [US3] Build remittance history and driver balance views with partial, unpaid, paid, and credit states, note editing, locked financial fields, and owner reversal affordances in `app/(operations)/remittances/page.tsx` and `app/(operations)/remittances/[id]/page.tsx`
- [ ] T065 [US3] Complete the remittance checkpoint by running the independent test and recording exact rates, assignment resolution, idempotency, payment history, balances, roles, and 360 px results in `specs/001-fleet-management/validation/us3-remittances.md`

---

## Phase 6: User Story 4 - Parts and Tires (Priority: 4)

**Goal**: Let owner and staff record part replacements and all tire positions with costs and date/mileage due thresholds while retaining replacement history.

**Independent Test**: Record mileage, one part, and front/rear-left/rear-right tires; replace one tire; advance date or mileage across each threshold; and verify current items, full history, due status, and staff no-delete enforcement.

- [X] T066 [US4] Create the `part_replacements` table with bigint centavo cost, replacement date/mileage, ordered optional due thresholds, audit fields, and soft deletion in `supabase/migrations/20261019004000_create_part_replacements.sql`
- [X] T067 [US4] Add owner/staff create-update-read and owner-only soft-delete RLS for `part_replacements` in `supabase/migrations/20261019004100_add_part_replacements_rls.sql`
- [X] T068 [US4] Create the `tire_installations` table with three positions, required due threshold, one current tire per unit/position, and atomic replacement linking in `supabase/migrations/20261019004200_create_tire_installations.sql`
- [X] T069 [US4] Add owner/staff create-update-read and owner-only soft-delete RLS for `tire_installations` in `supabase/migrations/20261019004300_add_tire_installations_rls.sql`
- [X] T070 [P] [US4] Write required pgTAP tests for due-threshold ordering, three tire positions, one current tire, atomic replacement history, mileage/date due boundaries, soft deletion, and maintenance RLS in `supabase/tests/constraints/040_parts_tires.sql` and `supabase/tests/rls/040_parts_tires_rls.sql`
- [X] T071 [P] [US4] Define part, tire, due-date, due-mileage, and cost-centavo Zod schemas in `lib/validation/maintenance.ts`
- [X] T072 [US4] Implement part replacement create/update and owner soft-delete actions in `app/actions/parts.ts`
- [X] T073 [US4] Implement transactional tire installation/replacement and owner soft-delete actions in `app/actions/tires.ts`
- [X] T074 [P] [US4] Build the mobile part replacement form and history list with due-basis labels in `components/forms/part-replacement-form.tsx` and `components/maintenance/parts-list.tsx`
- [X] T075 [P] [US4] Build the mobile tire form and per-position current/history display in `components/forms/tire-installation-form.tsx` and `components/maintenance/tire-positions.tsx`
- [X] T076 [US4] Assemble unit-scoped mileage, parts, and tire workflows in `app/(operations)/maintenance/page.tsx` and `app/(operations)/maintenance/[unitId]/page.tsx`
- [ ] T077 [US4] Complete the parts/tires checkpoint by running the independent test and recording positions, replacement history, date/mileage boundaries, roles, centavos, and 360 px results in `specs/001-fleet-management/validation/us4-parts-tires.md`

---

## Phase 7: User Story 5 - Documents (Priority: 5)

**Goal**: Let only the owner upload and manage OR/CR, driver-license, MTOP-franchise, and insurance files with structured expiry dates and retained supersession history.

**Independent Test**: Upload an image or PDF for each document type, renew one document, verify holder rules and expiry states at 31/30/7/1/0 days, and prove staff cannot list metadata, upload, read paths, or create signed URLs.

- [X] T078 [US5] Create the `documents` table with holder/type checks, expiry date, one current document per holder/type, private object metadata, supersession, audit fields, and soft deletion in `supabase/migrations/20261019005000_create_documents.sql`
- [X] T079 [US5] Add RLS for `documents` with owner-only CRUD/read access and explicit staff/anonymous denial in `supabase/migrations/20261019005100_add_documents_rls.sql`
- [X] T080 [US5] Create the dormant `notification_outbox` table with threshold, schedule, status, deduplication, timestamps, and no v1 sender in `supabase/migrations/20261019005200_create_notification_outbox.sql`
- [X] T081 [US5] Add owner-read-only and no normal application insert/update/delete RLS for `notification_outbox` in `supabase/migrations/20261019005300_add_notification_outbox_rls.sql`
- [X] T082 [US5] Create the private `documents` bucket with 5 MB limits and owner-only Storage policies in `supabase/migrations/20261019005400_create_documents_storage.sql`
- [X] T083 [US5] Add the stable `notification_candidates` and document-expiry query contract with exact expired/7-day/30-day local-date boundaries in `supabase/migrations/20261019005500_create_document_expiry_queries.sql`
- [X] T084 [P] [US5] Write required pgTAP tests for document holder/type validity, single-current supersession, expiry boundaries, soft deletion, metadata RLS, outbox denial, and object path isolation in `supabase/tests/constraints/050_documents.sql` and `supabase/tests/rls/050_documents_storage_rls.sql`
- [X] T085 [P] [US5] Define document metadata, holder, MIME, size, checksum, and expiry Zod schemas in `lib/validation/documents.ts`
- [X] T086 [US5] Implement owner-only upload preparation/finalization, driver-license expiry matching, atomic renewal of the profile and document, soft deletion, and signed download URL actions in `app/actions/documents.ts` and `lib/uploads/documents.ts`
- [X] T087 [P] [US5] Build the mobile document upload form with holder-aware fields, expiry input, image/PDF validation, compression where applicable, and recoverable upload errors in `components/forms/document-form.tsx`
- [X] T088 [US5] Build owner document list/detail screens grouped by unit/driver and type with current/superseded history in `app/(owner)/documents/page.tsx` and `app/(owner)/documents/[id]/page.tsx`
- [X] T089 [US5] Add 30-day, urgent 7-day, and expired status badges based only on derived query output in `components/documents/expiry-status.tsx`
- [ ] T090 [US5] Complete the documents checkpoint by running the independent test and recording holder rules, renewal history, expiry boundaries, private upload/download, role denial, and 360 px results in `specs/001-fleet-management/validation/us5-documents.md`

---

## Phase 8: User Story 6 - Dashboard (Priority: 6)

**Goal**: Give the owner a mobile dashboard for monthly income/expenses per unit, expiring documents, due parts/tires, and unpaid driver balances; staff have no dashboard access.

**Independent Test**: Seed two units for one month and verify exact per-unit and fleet totals, net income, 31/30/7/1/0-day expiry groups, date/mileage due maintenance, unpaid balances, detail links, owner-only access, and no horizontal scrolling at 360 px.

- [X] T091 [US6] Create the owner-only `dashboard_monthly_unit_summary(month_start)` SQL function using active remittances/payments/expenses and bigint-centavo aggregation in `supabase/migrations/20261019006000_create_dashboard_monthly_summary.sql`
- [X] T092 [US6] Create the owner-only `due_maintenance(as_of)` SQL function for part/tire date-or-mileage thresholds in `supabase/migrations/20261019006100_create_due_maintenance_query.sql`
- [X] T093 [US6] Create the owner-only `driver_outstanding_balances(as_of)` SQL function resolved to actual operating drivers in `supabase/migrations/20261019006200_create_driver_balance_query.sql`
- [X] T094 [US6] Add execute grants and owner-only RLS-backed access for all dashboard functions in `supabase/migrations/20261019006300_add_dashboard_function_security.sql`
- [X] T095 [P] [US6] Write required pgTAP reconciliation, soft-delete exclusion, expiry-boundary, maintenance-due, actual-driver balance, owner-only function, and 100-unit/24-month performance-fixture tests in `supabase/tests/constraints/060_dashboard_queries.sql` and `supabase/tests/rls/060_dashboard_rls.sql`
- [X] T096 [US6] Implement selected-month parsing and typed owner-only dashboard queries in `lib/dashboard/queries.ts` and `lib/validation/dashboard.ts`
- [X] T097 [P] [US6] Build responsive monthly unit income/expense/net summary cards with integer-centavo formatting in `components/dashboard/monthly-unit-summary.tsx`
- [X] T098 [P] [US6] Build the single Expiring Soon panel with 30-day, urgent 7-day, and expired groups plus record links in `components/dashboard/expiring-soon-panel.tsx`
- [X] T099 [P] [US6] Build due maintenance and unpaid balance panels with unit/driver links in `components/dashboard/due-maintenance-panel.tsx` and `components/dashboard/unpaid-balances-panel.tsx`
- [X] T100 [US6] Assemble the owner-only mobile dashboard, month selector, loading/empty/error states, and staff denial in `app/(owner)/dashboard/page.tsx`
- [ ] T101 [US6] Complete the dashboard checkpoint with the 100-unit/24-month fixture, three-second preview-deployment timing, reconciliation, alert boundaries, due logic, links, role denial, and 360 px results in `specs/001-fleet-management/validation/us6-dashboard.md`

---

## Phase 9: User Story 7 - Reports (Priority: 7)

**Goal**: Let the owner export monthly per-unit and fleet-wide CSV summaries that reuse database totals and reconcile exactly; staff cannot export.

**Independent Test**: Export one-unit, fleet, and empty-month CSV files; reconcile all bigint-centavo values to the dashboard fixtures; verify the fleet-total row, UTF-8 BOM, RFC 4180 escaping, Philippine characters, and staff denial.

- [X] T102 [US7] Create the owner-only `monthly_report(month_start, unit_id)` SQL function that reuses dashboard aggregation and returns unit rows plus fleet totals in `supabase/migrations/20261019007000_create_monthly_report_query.sql`
- [X] T103 [US7] Add execute grants and owner-only access for the monthly report function in `supabase/migrations/20261019007100_add_monthly_report_security.sql`
- [X] T104 [P] [US7] Write required pgTAP tests for unit/fleet/empty-month reconciliation, soft-delete exclusion, bigint centavos, and owner-only report access in `supabase/tests/constraints/070_monthly_reports.sql` and `supabase/tests/rls/070_reports_rls.sql`
- [X] T105 [P] [US7] Implement RFC 4180 escaping, fixed columns, UTF-8 BOM, and streaming serialization without recalculating totals in `lib/reports/monthly-csv.ts`
- [X] T106 [US7] Implement validated owner-only unit/fleet downloads and staff 403 responses in `app/api/reports/monthly/route.ts`
- [X] T107 [US7] Build the mobile report month/scope/unit selector with download, empty-state, and error feedback in `app/(owner)/reports/page.tsx` and `components/forms/report-export-form.tsx`
- [ ] T108 [US7] Complete the reports checkpoint by running the independent test and recording reconciliation, total row, empty file, escaping, authorization, download, and 360 px results in `specs/001-fleet-management/validation/us7-reports.md`

---

## Phase 10: Polish and Cross-Cutting Release Gates

**Purpose**: Validate the integrated application, free-tier posture, accessibility, migrations, and Workers deployment path after the selected stories are complete.

- [X] T109 [P] Add plain-language loading, empty, success, validation, stale-write, and recovery copy across shared components in `components/ui/feedback.tsx`
- [X] T110 [P] Add keyboard, focus, label, contrast, touch-target, and reduced-motion checks for shared navigation/forms in `tests/e2e/accessibility-mobile.spec.ts`
- [X] T111 Implement owner global and per-record audit queries/views, then run the soft-delete and direct staff mutation-denial journey in `lib/audit/queries.ts`, `app/(owner)/audit/page.tsx`, `components/audit/audit-history.tsx`, and `tests/e2e/soft-delete-audit.spec.ts`
- [X] T112 Verify every schema object rebuilds from committed migrations with no manual edits and record `supabase db reset`, pgTAP, and dry-run push results in `specs/001-fleet-management/validation/migrations.md`
- [X] T113 Verify Supabase database/storage usage checks, 300 KB receipt target, hard upload limits, data export/recovery, and the 80% warning procedure in `docs/free-tier-operations.md`
- [X] T114 Run lint, typecheck, required unit/database/end-to-end checks, `vinext check`, and the Workers production build; record compatibility and bundle/CPU findings in `specs/001-fleet-management/validation/release.md`
- [ ] T115 Execute every acceptance journey in `specs/001-fleet-management/quickstart.md`, including 10 non-technical participants at 360 px, timed expense/remittance entry, the 100-unit/24-month fixture, and three-second preview timing, then record final sign-off in `specs/001-fleet-management/validation/final-acceptance.md`

---

## Dependencies and Execution Order

### Phase Dependencies

- **Setup (Phase 1)** starts immediately.
- **Foundation (Phase 2)** depends on Setup and blocks every functional slice.
- **US1 through US7 (Phases 3-9)** proceed sequentially in the requested priority order: `Foundation -> US1 -> US2 -> US3 -> US4 -> US5 -> US6 -> US7`.
- **Polish (Phase 10)** follows whichever functional slices are selected for release; full release requires all seven checkpoints.

### User Story Dependency Graph

```text
Setup -> Foundation -> US1 Units/Drivers
                         -> US2 Expenses
                            -> US3 Remittances
                               -> US4 Parts/Tires
                                  -> US5 Documents
                                     -> US6 Dashboard
                                        -> US7 Reports
                                           -> Release Gates
```

The arrows express delivery order. Each checkpoint remains independently testable using its own fixtures and screens; later slices integrate earlier records but do not invalidate earlier checkpoints.

### Within Each Story

1. Write the required constraint/RLS test files before implementing behavior and confirm the new cases fail for the expected reason.
2. Add each new table in its own committed migration, followed immediately by its RLS migration task.
3. Add database functions and constraints before Server Actions or Route Handlers.
4. Add Zod validation before wiring forms to mutations.
5. Complete the UI and role-specific states before the checkpoint.
6. Run and record the checkpoint before beginning the next story.

### Parallel Opportunities

- Setup tasks T003-T006 and T008 touch separate configuration files after T001-T002.
- Foundation tasks T017-T018 and T020-T022 can proceed in parallel after the foundational migrations.
- In US1, tests/schemas and the unit/driver screens are parallel after their database/action prerequisites.
- In US2-US5, test/schema or separate component tasks marked `[P]` can proceed concurrently once their migrations exist.
- In US6, the three dashboard panels can be built concurrently after typed queries exist.
- In US7, CSV serialization can be built alongside database tests after the report contract exists.
- `[P]` never permits skipping the phase checkpoint or starting the next prioritized story early.

## Parallel Examples

### US1 Units and Drivers

```text
T037 Database constraint/RLS tests
T038 Zod schemas

After T039-T040:
T041 Unit screens
T042 Driver screens
```

### US5 Documents

```text
After T078-T083:
T084 Document/Storage tests
T085 Document validation schemas

After T086:
T087 Upload form
T089 Expiry badges
```

### US6 Dashboard

```text
After T091-T096:
T097 Monthly summary cards
T098 Expiring Soon panel
T099 Due maintenance and unpaid balances panels
```

## Implementation Strategy

### MVP First

1. Complete Setup and Foundation.
2. Complete US1 Units and Drivers.
3. Stop at T043 and validate the owner/staff, assignment, backup-driver, expiry, and mobile workflows.
4. Deploy a preview only after the applicable Phase 10 compatibility and migration gates pass.

This MVP establishes trustworthy master data and assignment history. It intentionally does not claim financial or compliance functionality before those later slices pass their own checkpoints.

### Incremental Delivery

1. Foundation + US1: fleet and assignment register.
2. Add US2: expense capture and receipt storage.
3. Add US3: daily remittances and payment balances.
4. Add US4: parts, tires, mileage, and replacement history.
5. Add US5: private compliance documents and expiry data.
6. Add US6: owner action dashboard.
7. Add US7: reconciled CSV exports.
8. Run Phase 10 and release only the slices whose checkpoints passed.

## Notes

- Commit each completed task or tightly coupled migration/RLS pair so every slice is reviewable and recoverable.
- `[P]` means different files and no unfinished dependency; shared migration order and shared UI files remain sequential.
- Money stays as integer centavos through database, validation, actions, dashboard, and CSV; peso formatting is presentation-only.
- All normal deletes are soft deletes, all business rows are timestamped/attributed, and no task authorizes manual remote database editing.
- Receipt and document bytes upload directly to private Supabase Storage after authorization; they do not transit the Worker.
- If vinext compatibility fails, stop the release and perform the documented OpenNext fallback assessment; do not convert the application to a static Pages export.
