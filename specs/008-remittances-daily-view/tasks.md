---

description: "Task list for feature 008: Remittances Daily View"
---

# Tasks: Remittances Daily View

**Input**: Design documents from `specs/008-remittances-daily-view/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests**: Included. CLAUDE.md requires lint, typecheck, and tests to pass for every task, and plan.md lists the Vitest, Testing Library, and Playwright files. Write each story's tests first and confirm they fail.

**Organization**: Tasks are grouped by user story so each story can be built, tested, and demonstrated on its own.

**Hard rules for every task** (CLAUDE.md and the constitution):
- **No database changes.** No migration, RPC, grant, or `types/database.ts` regeneration. This was approved on 2026-10-30.
- Money is integer centavos, parsed and formatted only through `lib/money/centavos.ts`.
- Use only tokens from `app/globals.css`. No hex values, arbitrary sizes, or middle-dot strings in components, and no new npm packages.
- Every screen must work at 360 px.
- Read `node_modules/next/dist/docs/01-app/02-guides/preserving-ui-state.md` and `01-getting-started/04-linking-and-navigating.md` before routing work (`cacheComponents: true`).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: The user story the task belongs to (US1 to US5)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Branch, UI primitives, and design tokens that every story uses

- [X] T001 Create and switch to branch `008-remittances-daily-view` from `main`, and confirm `.specify/feature.json` points to `specs/008-remittances-daily-view`
- [X] T002 [P] Generate the shadcn `base-nova` wrappers with `corepack pnpm dlx shadcn@latest add popover dropdown-menu tooltip alert-dialog toggle-group progress` into `components/ui/` (`popover.tsx`, `dropdown-menu.tsx`, `tooltip.tsx`, `alert-dialog.tsx`, `toggle-group.tsx`, `progress.tsx`), then add `components/ui/segmented-toggle.tsx`, a thin wrapper over the generated toggle group for a two-option segmented control. Revert any `package.json` or lockfile change (they must import only `@base-ui/react`, which is already installed). Restyle each to the repo tokens: `rounded-md` (6 px) at most, no shadows except the focus ring, `border-rule`, `bg-surface`, `text-ink`, and 44 px touch targets (`touch-target`)
- [X] T003 [P] In `app/globals.css`, add `--token-info: #1f4f7a`, `--token-info-soft: #e6eef7`, and `--token-control-border: #7d8996` to `:root`. Add `--color-info`, `--color-info-soft`, `--color-control-border`, and `--breakpoint-desk: 75rem` to `@theme inline` (research R7, R8, R9)
- [X] T004 [P] In `DESIGN.md`, add the three tokens to the color table with their measured contrast (`#1f4f7a` on `#e6eef7` 7.30:1, `#7d8996` on white 3.56:1 and on `#fff1bd` 3.15:1). Add a layout note that Daily view's per-unit cards are a deliberate exception to "Do not put every element in a rounded card" (research R7)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: URL parsing, date helpers, the pure board builder, the date-scoped loader, demo data, and the page split. Every story depends on this.

**⚠️ CRITICAL**: No user story work starts until this phase is complete

- [X] T005 [P] Write `tests/unit/remittances-view-params.test.ts` covering every row of the URL table in `contracts/remittances-page.md`: `/remittances` gives daily/today; a valid past `date`; a `date` after today or an invalid one gives today; `view=list`; any list-only parameter (`q`, `page`, `sort`, `from`, `to`, `unit`, `driver`, `disposition`, `balance`) without `view` gives list
- [X] T006 [P] Implement `parseRemittancesView(params: SearchParams, today: string): { view: "daily" | "list"; date: string }` and the href builders `dailyHref(date?)` and `listHref()` in `lib/remittances/view-params.ts` so T005 passes
- [X] T007 [P] Write `tests/unit/fleet-date.test.ts`. `paymentTimestampFor(date, now)` returns `now.toISOString()` when `date === fleetToday(now)`, and otherwise noon of `date` in the fleet time zone with an offset (`2026-10-28T12:00:00+08:00` for Asia/Manila) whose Manila date equals `date`. `formatLongDate("2026-10-30")` is `"Friday, October 30, 2026"`. `formatShortDate("2026-10-28")` is `"Oct 28"`. `isAfterToday(date, today)` is also covered
- [X] T008 [P] Add `paymentTimestampFor`, `formatLongDate`, `formatShortDate`, and `isAfterToday` to `lib/dates/fleet-date.ts` (derive the offset with `Intl`, no date library) so T007 passes
- [X] T009 [P] Write `tests/unit/daily-board.test.ts` for `buildDailyBoard(date, today, rows, role)`:
  - `saved` with the record's driver even when the schedule changed (FR-013)
  - `unrecorded` Primary
  - `unrecorded` Backup with `coveringFor` set to the primary's name
  - `no-driver` (day off with no backup)
  - `in-repair` only when `date === today`; a past date ignores repair status; a saved record on an in-repair unit is still `saved`
  - no card for a unit whose primary starts after `date`
  - `recorded` and `countable` leave out `no-driver` and `in-repair` cards (FR-008)
  - `receivedCentavos` sums active payments
  - `freeDrivers` leave out inactive drivers, licenses expiring before `date`, and drivers with a primary or backup covering `date`
  - an empty board gives no cards (FR-032)
  - when every card is not operating: `recorded = 0`, `countable = 0`, and a progress value of 0
  - a retired unit with an open primary gets no card today, unless it has a saved remittance for today
  - cards sort by unit name
- [X] T010 Implement `lib/remittances/daily-board.ts` (types `DailyBoard`, `DailyCard` with kinds `saved | unrecorded | no-driver | in-repair`, and `DriverOnCard { driverId, name, role: "primary" | "backup", coveringFor: string | null }`, exactly as in `data-model.md`). Reuse `coverageOn` from `lib/assignments/coverage.ts`. Precedence for units without a record: no card for a retired unit today, then `in-repair` (today only), then `no-driver`, then `unrecorded`. Card `key = ${date}:${unitId}`. Make T009 pass
- [X] T011 Implement `loadDailyRows(supabase | null, date, role)` in `lib/remittances/daily-query.ts` with the 5 parallel queries from research R2:
  - units (`id, name, body_number, status`, not deleted)
  - assignments in effect on `date` (primaries with `starts_on <= date` and `ends_on` null or `>= date`, plus backups with `starts_on = date`, with `drivers(full_name)`)
  - `driver_days_off` with `day_off_date = date`
  - active remittances with `service_date = date`, including active `remittance_payments(amount_centavos)`, `drivers(full_name)`, and `driver_assignments(assignment_type, covered_primary_assignment_id)`, plus the covered primary's driver name
  - for owners only, active drivers with `license_expiry_date >= date`

  All filters use `deleted_at is null`. `null` means demo mode, which reads from `lib/demo/mode.ts`
- [X] T012 In `lib/demo/mode.ts`, add `assignment_id` and the assignment type to `demoRemittances`, plus today records for ROLNET-1 (Returned, paid in full) and ROLNET-4 (Overnight / overtime, partly paid), each with a payment. Today's other primaries stay unrecorded, ROLNET-2 stays in repair with its driver off and no backup, and ROLNET-3 stays covered by Pedro Santos. Make sure `tests/e2e/units-register.spec.ts` and the existing List view demo still pass
- [X] T013 Restructure `app/(operations)/remittances/page.tsx`. Call `parseRemittancesView(await searchParams, fleetToday())`. Keep `PageHeader` (eyebrow "Daily income", title "Remittances"). Move the current table rendering, unchanged for now, into a `list` branch (a server component `components/remittances/remittances-list.tsx`). Add a `daily` branch that calls `loadDailyRows` and `buildDailyBoard` and renders a placeholder. List queries run only in the list branch, and daily queries only in the daily branch

**Checkpoint**: The board builder is tested, and `/remittances?view=list` renders exactly as before

---

## Phase 3: User Story 1 - Record today's remittances unit by unit (Priority: P1) 🎯 MVP

**Goal**: `/remittances` opens Daily view on today, showing one card per scheduled unit. Cards save and lock with a result badge, the header count and received total update, backup and not-operating units display correctly, and owners can assign a backup from the card.

**Independent Test**: With three units scheduled today, save ₱180 (Returned), ₱250 (Overnight / overtime), and ₱200 (Returned). The badges read "Paid", "Owes ₱50.00", and "Credit ₱20.00", the cards lock and turn muted, and the header reads "3 of 3 recorded" and "₱630.00 received".

### Tests for User Story 1 ⚠️

- [X] T014 [P] [US1] Write `tests/unit/daily-card.test.tsx` (Testing Library, `saveDailyRemittance` and `assignBackupDriver` mocked):
  - the due shows ₱180.00 and switches to ₱300.00 as soon as the disposition changes, before any save (FR-019)
  - a save disables the disposition, payment, and notes fields, replaces the button with `BalanceBadge` and a "Saved" label with a lock icon, applies `bg-muted`, and shows the "Card options" menu only after saving (FR-021, FR-023)
  - a failed save keeps the entries and shows the action's message (FR-029)
  - an invalid payment such as `abc` or `-5` shows "Enter an amount like 180 or 180.50." and does not call the action
  - a `no-driver` card has no save button, shows "Not operating", and shows "Assign driver" only for owners, while staff see "Ask the owner to assign a backup driver."
  - an `in-repair` card shows "Not operating (in repair)" with no fields
  - a double press calls the action once with the same idempotency keys (FR-028)
  - a duplicate-record error keeps the entries and shows a **Reload** button that calls `router.refresh()`
  - in `tests/unit/daily-view.test.tsx`, with fake timers: advancing the fleet clock past midnight while today is selected shows "It's now a new day. Switch to today?" and keeps the date, and "Switch to today" opens the unsaved-changes dialog when a card has unsaved edits (FR-030, FR-031)
- [X] T015 [P] [US1] Write `tests/e2e/remittances-daily-view.spec.ts` (demo, 360 px and 1280 px):
  - `/remittances` shows Daily view on today with no search, Filters, or Sort (FR-001a, FR-009)
  - the toggle switches to List view and back without a full reload (check that a `window` marker set before the click survives)
  - 4 card columns at 1280 px, 2 at 768 px, and 1 at 360 px, by bounding-box x positions
  - the ROLNET-3 card shows Pedro Santos with a "Backup" tag whose tooltip reads "Covering for … , day off."
  - ROLNET-2 is "Not operating (in repair)" and isn't counted in "N of M recorded"
  - a long unit name is truncated with its full text in a tooltip
  - no horizontal scroll at 360 px

### Implementation for User Story 1

- [X] T016 [P] [US1] Create `components/remittances/view-toggle.tsx`. Use `segmented-toggle` (Base UI ToggleGroup from T002, `role="group"`, `aria-label="Remittances view"`) with "List view" and "Daily view" buttons that navigate with `<Link>` to `listHref()` and `dailyHref()` and mark the current one `aria-pressed="true"`. Both buttons check the board's unsaved-changes guard (see T022) before leaving Daily view
- [X] T017 [P] [US1] Create `components/remittances/driver-tag.tsx`. Show the driver name plus a `status-badge` tag: "Primary" (`bg-info-soft text-info`) or "Backup" (`bg-brand-soft text-brand-dark`), 4 px radius, never a pill. When `coveringFor` is set, the Backup tag is a focusable tooltip trigger with the text "Covering for {coveringFor}, day off." Lay out the name and tag as `flex flex-wrap items-center gap-1` so the tag wraps only when needed (FR-012, FR-015, FR-018)
- [X] T018 [US1] Add `dailyRemittanceSchema` to `lib/validation/remittances.ts`:
  - `assignmentId` uuid
  - `serviceDate` matching `/^\d{4}-\d{2}-\d{2}$/` and not after `fleetToday()`
  - `disposition` enum `returned | overnight_overtime`
  - `notes` string, max 1000, optional
  - `paymentCentavos` int, at least 0, optional
  - `remittanceKey` and `paymentKey` uuids
- [X] T019 [US1] Implement the `saveDailyRemittance(input)` server action in `app/actions/remittances.ts` following `contracts/daily-actions.md`:
  - `requireApprovedSession()`, then reuse the `createRemittance` insert logic, idempotent on `remittanceKey`
  - if `paymentCentavos > 0`, insert a payment with `paid_at = paymentTimestampFor(serviceDate, new Date())`, idempotent on `paymentKey`
  - return `{ id, updatedAt, receivedCentavos }`
  - return `PARTIAL` with "The remittance was saved, but the payment was not. Edit the card to add the payment." when only the payment fails
  - map the unique-index violations to the two duplicate messages in the contract
  - revalidate `/remittances` and `/dashboard`
- [X] T020 [US1] Create `components/remittances/daily-card.tsx`, a client component for the kinds `unrecorded`, `saved` (locked), `no-driver`, and `in-repair`, laid out top to bottom as in `contracts/remittances-page.md`:
  - unit name (`truncate` with a tooltip) and `DriverTag`
  - "Due" in `text-page-title font-data`, computed on the client (Returned 18000, Overnight / overtime 30000)
  - a native `Select` labelled "Disposition" defaulting to `returned`
  - "Payment received (₱)" (`inputMode="decimal"`, placeholder `0.00`, parsed with `lib/money/centavos.ts`, empty means 0)
  - "Notes" (placeholder "Add a note", max 1000)
  - **Save remittance**, which calls `saveDailyRemittance`; per-card idempotency keys are created once per draft and kept across retries
  - when saved: fields disabled, `bg-muted`, `BalanceBadge` from `remittanceTotals`, "Saved" with a lucide `Lock` icon, and the ⋯ menu shell (`aria-label="Card options"`) in the top-right corner
  - not-operating cards: muted, labelled "Not operating" or "Not operating (in repair)", with no fields
  - on a duplicate-record error (the unit is already recorded for the date), keep the entries and show a **Reload** button that calls `router.refresh()` so the saved record replaces the card
  - report `dirty` changes to the board through a callback prop
- [X] T021 [US1] Create `components/remittances/assign-backup-picker.tsx` (owners only, rendered in `no-driver` cards). An **Assign driver** button opens a popover listing `freeDrivers` as buttons, or "No drivers are free on this date." when empty. Choosing one calls the existing `assignBackupDriver({ dayOffId, backupDriverId })` from `app/actions/assignments.ts`, then `router.refresh()`. A rejection keeps the card "Not operating" and shows the action's message. It must be keyboard-operable (FR-014b)
- [X] T022 [US1] Create `components/remittances/daily-view.tsx`, a client board taking a `DailyBoard` and the role:
  - a heading with `formatLongDate(date)` and a "Today" label when `isToday` (the date control replaces this in US3)
  - a header with `role="status"` showing `${recorded} of ${countable} recorded` and `${formatPesos(receivedCentavos)} received` as separate elements (no middle dot)
  - a thin `progress` bar with `aria-label="Recorded"`
  - the card grid `grid grid-cols-1 gap-4 md:grid-cols-2 desk:grid-cols-4` with cards keyed by `card.key`
  - the empty state "No units scheduled for this date."
  - local optimistic header totals after each save
  - the `dirty` set with an unsaved-changes `alert-dialog` ("You have unsaved changes on N cards. Leave without saving?", buttons "Leave" and "Stay"), a `beforeunload` listener, and a capture-phase `document` click listener for same-origin `<a>` clicks while dirty
  - the new-day banner: every 30 s and on `visibilitychange`, compare `fleetToday()` with `board.today`, and when the selected date is the old today, show `role="status"` "It's now a new day. Switch to today?" with a "Switch to today" button that runs the guard (FR-030, FR-031)
- [X] T023 [US1] Wire up `app/(operations)/remittances/page.tsx`: render `ViewToggle` in the header for both views, and replace the daily placeholder with `<DailyView board={buildDailyBoard(...)} role={profile.role} />`. Keep `/remittances` with no parameters on Daily view for every role (FR-001a)
- [X] T024 [P] [US1] In `lib/dashboard/queries.ts`, change the unpaid-balances "View all" link from `/remittances?balance=unpaid` to `/remittances?view=list&balance=unpaid`, and update any test that asserts it (`tests/unit/dashboard-*.test.ts`)

**Checkpoint**: User Story 1 works on its own and is the MVP. Run T014 and T015 plus the full `corepack pnpm test`

---

## Phase 4: User Story 2 - Correct a saved remittance (Priority: P2)

**Goal**: The ⋯ menu's **Edit remittance** unlocks payment and notes (the disposition stays locked), saving relocks the card, raising the payment adds the difference, an owner can lower it with a reason, staff are blocked from lowering, and the first past-date edit asks for confirmation.

**Independent Test**: Save Returned with ₱100 ("Owes ₱80.00"), then Edit to ₱180 and save. The card shows "Paid" and the received total goes up by ₱80.00. As staff, entering ₱50 is blocked. As the owner, ₱150 asks for a reason and shows "Owes ₱30.00".

### Tests for User Story 2 ⚠️

- [X] T025 [P] [US2] Write `tests/unit/payment-plan.test.ts` for `planPaymentChange({ currentCentavos, targetCentavos, role })`:
  - equal gives `none`
  - higher gives `add(diff)` for both roles
  - lower gives `replace(target)` for the owner and `blocked` for staff
  - lowering to 0 gives `replace(0)` (voids only, no insert)
  - negative or non-integer targets are rejected
- [X] T026 [P] [US2] Extend `tests/unit/daily-card.test.tsx` (with `editDailyRemittance` mocked):
  - the menu offers "Edit remittance", plus "View record details" linking to `/remittances/{id}` for owners only
  - Edit unlocks payment and notes while the disposition stays disabled with "Disposition can't be changed after saving." (owners also see "Reverse it on the record's details page to change it.")
  - Cancel restores the saved values and relocks
  - staff lowering shows "Only the owner can lower a recorded payment." and does not call the action
  - owner lowering opens a dialog "Lower the payment from ₱180.00 to ₱100.00?" with a required "Reason" (3 to 500 characters) before calling the action
  - on a past date the first Edit asks "You're editing a record from Oct 28. Continue?" and the second Edit in the same session does not (`sessionStorage`)

### Implementation for User Story 2

- [X] T027 [P] [US2] Implement `planPaymentChange` in `lib/remittances/payment-plan.ts` (pure, integer centavos) so T025 passes
- [X] T028 [US2] Add `editDailyRemittanceSchema` to `lib/validation/remittances.ts`:
  - `remittanceId` uuid
  - `expectedUpdatedAt` an ISO datetime with offset
  - `notes` string, max 1000
  - `targetPaymentCentavos` int, at least 0
  - `reason` trimmed, 3 to 500 characters, optional (required by the action only for `replace`)
  - `paymentKey` uuid
- [X] T029 [US2] Implement the `editDailyRemittance(input)` server action in `app/actions/remittances.ts` following `contracts/daily-actions.md` step by step:
  - load the active remittance with its `service_date` and active payments
  - update the notes only if they changed, using the `updated_at` check, and return `STALE_RECORD` with "Someone changed this remittance after you opened it. Reload the card and edit again." when it doesn't match
  - run `planPaymentChange`:
    - `add`: insert the difference with `paid_at = paymentTimestampFor(service_date, now)`, idempotent on `paymentKey`
    - `replace`: `requirePermission("manage_master_data")`, call `rpc("correct_remittance_payment", { p_payment_id, p_reason })` for each active payment, then insert the target (unless 0) with the same `paid_at` rule and `paymentKey`. Return `PARTIAL` with "Some earlier payments were voided but the new amount wasn't saved. Save again to finish." if a step fails
    - `blocked`: return `FORBIDDEN` with "Only the owner can lower a recorded payment."
  - never write the disposition
  - return `{ updatedAt, receivedCentavos }` and revalidate `/remittances`, `/remittances/{id}`, and `/dashboard`
- [X] T030 [US2] Extend `components/remittances/daily-card.tsx` with:
  - the `dropdown-menu` items "Edit remittance" and, for owners, "View record details"
  - the `editing` state (payment prefilled with the recorded total, notes editable, disposition disabled with the FR-026 hint, **Save remittance** and **Cancel**)
  - the staff lowering block, and the owner's reason `alert-dialog`
  - calling `editDailyRemittance`, then relocking with the returned totals
  - on `PARTIAL` or `STALE_RECORD`, showing the message and calling `router.refresh()` to reload the record's real values
- [X] T031 [US2] In `components/remittances/daily-card.tsx`, add the past-date edit confirmation. When `!board.isToday` and `sessionStorage["rolnet:past-edit-confirmed"]` isn't set, show an `alert-dialog` "You're editing a record from {formatShortDate(date)}. Continue?" with Continue and Cancel. Continue sets the flag and unlocks, and Cancel keeps the card locked (FR-025)
- [X] T032 [US2] Pass the edit callbacks through `components/remittances/daily-view.tsx` so the header's `recorded` and `receivedCentavos` update after every edit save (FR-024)

**Checkpoint**: User Stories 1 and 2 both work. Run T025, T026, and the full unit suite

---

## Phase 5: User Story 3 - Review and fill in a past date (Priority: P2)

**Goal**: A date control (previous and next day, a calendar with month navigation, Today) picks any past date. Cards load for that date with historical drivers. Future dates are blocked.

**Independent Test**: Change a unit's primary today, then open an earlier date. The earlier driver shows, a record saved on that date shows its saved driver, an unrecorded unit can be saved, and Next day is disabled on today.

### Tests for User Story 3 ⚠️

- [X] T033 [P] [US3] Write `tests/unit/month-calendar.test.tsx`:
  - it renders a `role="grid"` for the month, labelled by the month heading
  - "Previous month" and "Next month" change the month
  - days after `max` have `aria-disabled="true"` and ignore clicks and Enter
  - arrow keys move by 1 day or 7 days, Home and End go to the start and end of the week, PageUp and PageDown change the month, and Enter selects
  - the selected day has `aria-selected="true"`
  - "Next month" is disabled when the following month starts after `max`
- [X] T034 [P] [US3] Extend `tests/e2e/remittances-daily-view.spec.ts`:
  - "Next day" (`aria-label`) is disabled on today, and "Previous day" loads yesterday with the URL `?date=` updated
  - the date button reads `formatLongDate` with a "Today" label only on today
  - the calendar moves back a month, picks a day, and loads it, and future days can't be picked
  - **Today** returns to today
  - `?date=2099-01-01` falls back to today
  - typing into a card and then pressing Previous day shows the unsaved-changes dialog, and "Stay" keeps the entry

### Implementation for User Story 3

- [X] T035 [P] [US3] Create `components/ui/month-calendar.tsx`, a client component with the props `{ value: string; max: string; onSelect(date: string): void }`. It renders one month as a `role="grid"` table using `addDays` and `Intl.DateTimeFormat` (no library), with "Previous month" and "Next month" buttons and the keyboard model from T033. Use tokens only, with 44 px day cells and a `bg-brand-soft text-brand-dark` selected day. Make T033 pass
- [X] T036 [US3] Create `components/remittances/date-control.tsx`:
  - a "Previous day" icon button (`aria-label="Previous day"`)
  - a date button with the accessible name "Choose date, {formatLongDate(date)}" and visible text `formatLongDate(date)`, opening a `popover` with `MonthCalendar` (`max = today`)
  - a "Next day" icon button (`aria-label="Next day"`), disabled when `date === today`
  - a **Today** button, disabled when already on today
  - a small "Today" label when `date === today`

  Every move goes through the board's unsaved-changes guard, then `router.push(dailyHref(newDate), { scroll: false })` (FR-003 to FR-007)
- [X] T037 [US3] In `components/remittances/daily-view.tsx`, replace the US1 date heading with `DateControl`, make sure cards stay keyed by `${date}:${unitId}` so drafts never carry over to another date, and keep the header totals and progress bar driven by the new date's board (FR-008)
- [X] T038 [US3] Check that `app/(operations)/remittances/page.tsx` passes the parsed `date` (not only today) to `loadDailyRows` and `buildDailyBoard`. A past date must use the historical assignments and days off and ignore repair status, and saved cards must show their saved driver (FR-011, FR-013, FR-014a)

**Checkpoint**: User Stories 1 to 3 work, and past dates show historical drivers and can be filled in or corrected

---

## Phase 6: User Story 4 - Browse the read-only remittance history (Priority: P3)

**Goal**: List view is a full-width, read-only table with the Daily view note under the record count, and each row's date opens Daily view on that date.

**Independent Test**: In List view there's no "Record daily remittance" panel, the table is full width, and rows have no pointer cursor. The note sits under the count with a working "Daily view" link, and a row's date opens Daily view on that date.

### Tests for User Story 4 ⚠️

- [X] T039 [P] [US4] Extend `tests/e2e/remittances-daily-view.spec.ts` (List view, demo):
  - no "Record daily remittance" or "The amount due is calculated from the unit's disposition." text, and no "Open an entry to add a payment or edit notes"
  - the table's width equals its section's content width at 1280 px
  - rows have a computed `cursor` of `auto` or `default`
  - the note "Turn on Daily view to record or correct each unit's remittance. List view shows all records, newest to oldest." appears directly under the record count, and its "Daily view" link opens Daily view on today
  - the first row's date link opens `?date={service_date}` in Daily view
  - the default order is newest first

### Implementation for User Story 4

- [X] T040 [P] [US4] In `components/ui/paged-list.tsx`, add an optional `note?: ReactNode` to `listView` options, rendered on its own line directly under the count in `text-body-sm text-muted`. Make sure other lists render unchanged (`tests/unit/list-page.test.ts`, `tests/e2e/paged-lists.spec.ts`)
- [X] T041 [US4] Update `components/remittances/remittances-list.tsx` (from T013):
  - remove the `<aside>` (the "Record remittance" heading, helper text, and `RemittanceForm`) and the `workspace-grid` wrapper so the `DataTable` sits directly in the section at full width (FR-034)
  - remove the `hint` (FR-036)
  - pass `note` with the FR-038 sentence and a `<Link className="muted-link" href={dailyHref()}>Daily view</Link>`
  - make the Date cell `<Link href={dailyHref(r.service_date)} aria-label={`Open ${formatLongDate(r.service_date)} in Daily view`}>` instead of `/remittances/{id}` (FR-039)
  - no row click handler or `cursor-pointer` (FR-035)
  - keep search, dates, Filters, and Sort with `newest` as the default (FR-037)
- [X] T042 [US4] Delete `components/forms/remittance-form.tsx` (its only importer was the removed side panel) and remove its import from the remittances page or list component

**Checkpoint**: List view is read-only history, and User Stories 1 to 4 work

---

## Phase 7: User Story 5 - Read the search field easily (Priority: P3)

**Goal**: The search placeholder is solid `#526174` (6.32:1) and reads "Search by driver or unit", typed text is ink, control borders reach at least 3:1, and the search field has a visible focus ring.

**Independent Test**: In DevTools, the placeholder's computed color is `rgb(82, 97, 116)` and the borders are `rgb(125, 137, 150)`, and tabbing into search shows the focus outline.

### Tests for User Story 5 ⚠️

- [X] T043 [P] [US5] Extend `tests/e2e/remittances-daily-view.spec.ts` (List view):
  - the search input's `placeholder` is "Search by driver or unit"
  - `getComputedStyle(input, "::placeholder").color` is `rgb(82, 97, 116)`
  - the input's text color is `rgb(15, 27, 45)`
  - the input and the Any date, Filters, and Sort buttons have `border-color` `rgb(125, 137, 150)`
  - after `Tab` focus, the input's `outline-style` isn't `none` and its `outline-color` is `rgb(122, 75, 0)`

### Implementation for User Story 5

- [X] T044 [P] [US5] In `components/ui/list-search.tsx`, change `placeholder:text-muted` (which resolves to `#f3f4f6`, research R9) to `placeholder:text-muted-foreground`, `border-rule` to `border-control-border`, and add `focus-visible:outline-3 focus-visible:outline-focus focus-visible:outline-offset-2`. Keep `text-ink` for typed text. Make sure the Search icon stays `text-muted` (6.32:1). This fixes every list's search (FR-040 to FR-042). Also, in `components/ui/paged-list.tsx`, add an optional `searchPlaceholder?: string` to the `listView` options and pass it to `ListSearch` as the placeholder, falling back to `${searchLabel}…`
- [X] T045 [P] [US5] In `components/ui/list-controls.tsx`, change `border-rule` to `border-control-border` in `field`, `toolButton`, and `chipButton`, and in the `ListSort` control. Confirm the text and icons are `text-ink` or `text-muted` (4.5:1 or more) and the borders are 3:1 or more (FR-043)
- [X] T046 [US5] (Depends on T013 and T044.) In `components/remittances/remittances-list.tsx`, pass `searchPlaceholder: "Search by driver or unit"` (with `searchLabel` "Search by driver or unit" for the screen-reader label)

**Checkpoint**: All five stories work independently

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T047 [P] Add `/remittances` (Daily view) and `/remittances?view=list` to the 360 px no-horizontal-scroll and keyboard-reachability checks in `tests/e2e/accessibility-mobile.spec.ts` (SC-007, SC-008)
- [X] T048 [P] Update the remittance business rules in `docs/DEVELOPMENT.md`: Daily view is where recording and correcting happen; payments from a card are dated on the card's date (noon in fleet time for past dates); the disposition is locked after saving (reverse on the details page); only the owner can lower a payment (it voids the old ones and records the new total)
- [X] T049 Run `corepack pnpm lint`, `corepack pnpm typecheck`, `corepack pnpm test`, `corepack pnpm test:e2e`, `corepack pnpm check`, and `corepack pnpm build:vinext`, and fix any failures. Confirm `git diff main --stat -- supabase/ types/database.ts` is empty (FR-044, SC-009)
- [ ] T050 Walk through `quickstart.md` steps 1 to 10 against rolnet-dev as owner and staff at 360 px and 1280 px, and record the results in `specs/008-remittances-daily-view/validation.md`. Include: (a) a plain-language review of every new label, hint, dialog, and error message in `contracts/remittances-page.md` and `contracts/daily-actions.md`, confirming that a non-technical owner or staff member can tell what happened and what to do next, with no jargon or codes, and recording any wording changed as a result (constitution IV); (b) a timed phone run recording a 9-unit day in under 3 minutes with no more than 3 interactions per card (SC-001, SC-002)

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (Phase 1)**: No dependencies. T002, T003, and T004 can run in parallel after T001
- **Foundational (Phase 2)**: Depends on Setup, and **blocks every story**. T005 to T009 can run in parallel; T010 needs T009; T011 needs T010; T012 needs T011's row shapes; T013 needs T006, T010, and T011
- **US1 (Phase 3)**: Depends on Phase 2
- **US2 (Phase 4)**: Depends on US1's card (T020) and board (T022)
- **US3 (Phase 5)**: Depends on US1's board (T022). Its calendar (T033, T035) can start right after Phase 2
- **US4 (Phase 6)**: Depends on Phase 2 only (T013). It can run in parallel with US1 to US3, though T041's "Daily view" link targets are only meaningful once US1 lands
- **US5 (Phase 7)**: T043 to T045 depend on Setup (T003 tokens) only. T046 needs T013 (Phase 2) and T044. US5 doesn't depend on US4
- **Polish (Phase 8)**: Depends on every story you plan to ship

### Story completion order

```text
Setup → Foundational ─┬─▶ US1 (MVP) ─┬─▶ US2
                      │              └─▶ US3
                      ├─▶ US4 (independent)
                      └─▶ US5 (independent; T046 needs T013)
                                      └──────▶ Polish
```

### Within each story

Tests first (they must fail), then pure lib code, then server actions, then components, then page wiring.

### Same-file conflicts to sequence (not [P])

- `components/remittances/daily-card.tsx`: T020, then T030, then T031
- `components/remittances/daily-view.tsx`: T022, then T032, then T037
- `app/actions/remittances.ts`: T019, then T029
- `lib/validation/remittances.ts`: T018, then T028
- `components/remittances/remittances-list.tsx`: T013, then T041, then T046
- `components/ui/paged-list.tsx`: T040 and T044 (different stories, run them one after another)
- `tests/e2e/remittances-daily-view.spec.ts`: T015, then T034, T039, and T043 (append separate `describe` blocks; run them one after another if they are edited at the same time)

---

## Parallel Examples

### Phase 2

```text
Task: "T005 tests/unit/remittances-view-params.test.ts"
Task: "T007 tests/unit/fleet-date.test.ts"
Task: "T009 tests/unit/daily-board.test.ts"
Task: "T006 lib/remittances/view-params.ts"
Task: "T008 lib/dates/fleet-date.ts helpers"
```

### User Story 1

```text
Task: "T014 tests/unit/daily-card.test.tsx"
Task: "T015 tests/e2e/remittances-daily-view.spec.ts"
Task: "T016 components/remittances/view-toggle.tsx"
Task: "T017 components/remittances/driver-tag.tsx"
Task: "T024 lib/dashboard/queries.ts View all link"
```

### Across stories, after Phase 2

```text
Developer A: US1 (T014–T023), then US2
Developer B: US4 (T039–T042), then US5 (T043–T046), then the US3 calendar (T033, T035)
```

---

## Implementation Strategy

### MVP first (User Story 1 only)

1. Phase 1 Setup, then Phase 2 Foundational.
2. Phase 3 (US1): today's cards, save and lock, tags, not-operating, owner backup picker, and the toggle.
3. **Stop and validate**: run T014 and T015 and the quickstart steps 1 to 3 and 7.
4. At this point the old side-panel form still exists in List view, so nothing is lost if you pause here.

### Incremental delivery

1. US1, the MVP: record today's remittances.
2. US2: corrections. US3: past dates. They can ship together as "Daily view complete".
3. US4: List view goes read-only, which removes the old form. Ship it only after US1 so recording is never unavailable.
4. US5: the accessibility fix. It's independent and can ship first if you want it early.
5. Polish: the full check suite, docs, and validation.

---

## Notes

- [P] means different files and no dependency on an incomplete task. [USn] maps a task to a story in spec.md.
- Commit after each task or logical group, on the `008-remittances-daily-view` branch only.
- Never add a migration, RPC, or package. If a task seems to need one, stop and ask (the plan's R5 decision was approved on 2026-10-30).
