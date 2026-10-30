# Research: Remittances Daily View

Every unknown in the Technical Context is settled below. Each entry has a decision, why it was
chosen, and the alternatives considered.

## R1. View and date state: in the page address, with soft navigation

- **Decision**: `/remittances` opens Daily view on today. `?view=list` shows List view, and
  `?date=YYYY-MM-DD` picks Daily view's date. `parseRemittancesView(params, today)` falls back to
  today when the date is missing, invalid, or after today, and it picks List view when `view=list`
  is set or any list-only parameter is present (`q`, `page`, `sort`, `from`, `to`, `unit`, `driver`,
  `disposition`, `balance`). That keeps old links working, such as the dashboard's
  `/remittances?balance=unpaid`, which also gains an explicit `view=list`. The toggle, arrows,
  calendar, Today button, note link, and row-date links all navigate with `<Link>` or
  `router.push`. That is a soft navigation, not a full reload (FR-001). The server component
  re-renders with the new date's rows. Switching from List view to Daily view drops `date`, so Daily
  view opens on today (FR-004). Row-date links set `date` (FR-039).
- **Rationale**: Keeping state in the address gives reload, bookmark, and Back support (FR-002) for
  free, and the page keeps loading data the way the rest of the app does. With
  `cacheComponents: true`, Next keeps up to 3 routes alive with `<Activity>`, so card drafts survive
  Back. Cards are keyed by `${date}:${unitId}` so a different date never shows another date's draft
  (`preserving-ui-state.md`).
- **Alternatives**: Client-only state plus `history.pushState`, which would need a client data
  fetch path that duplicates the server queries. Two separate routes (`/remittances/daily`), which
  would split the page, change the staff start page, and weaken the "one page, two views" toggle.

## R2. Building the cards: one date-scoped load plus a pure builder

- **Decision**: `loadDailyRows(supabase, date)` runs 5 parallel queries:
  1. Units that aren't deleted (`id, name, body_number, status`).
  2. Assignments in effect on `date`: primaries with `starts_on <= date` and `ends_on` null or
     at least `date`, plus backups with `starts_on = date`, including the driver's name.
  3. Days off with `day_off_date = date`.
  4. Active remittances with `service_date = date`, with active `remittance_payments`, the driver
     name, and the assignment the record was saved under (`assignment_type`,
     `covered_primary_assignment_id`, and the covered primary's driver name).
  5. For owners only, active drivers with `license_expiry_date >= date` for the backup picker.

  `buildDailyBoard(date, today, rows, role)` in `lib/remittances/daily-board.ts` is pure. For each
  unit it uses `coverageOn` from `lib/assignments/coverage.ts` and produces a card of one of these
  kinds: `saved`, `unrecorded`, `no-driver`, or `in-repair`. It also produces the header totals
  `{ recorded, countable, receivedCentavos }` and the list of free drivers for the picker. A unit
  gets a card only if it has a primary in effect on `date` or a saved remittance (FR-010).
- **Rationale**: This matches the rules the units register and unit page already use (feature 007's
  `currentDrivers`). Staff can read all of these tables under the existing RLS select policies
  (`*_staff_read_policy`). Keeping the builder pure means every rule (backup cover, no driver,
  repair status only for today, saved driver over the schedule) can be unit tested without a
  database.
- **Alternatives**: A SQL view or RPC that returns cards, which would be a schema change and is ruled
  out. Reusing `currentDrivers`, which returns only a driver kind, without the assignment id the save
  needs or the covered-primary name the tooltip needs. The builder calls `coverageOn` directly
  instead.

## R3. The driver on saved cards comes from the record itself

- **Decision**: For a saved card, the driver, tag, and tooltip come from `remittances.driver_id`
  and `remittances.assignment_id` (joined to that assignment's type and covered primary). They never
  come from `coverageOn`. If the schedule now says someone else drove that day, the saved card still
  shows the saved driver (FR-013). Saved cards are always counted, even for a unit that is in repair
  today or had no driver (FR-014a).
- **Rationale**: Remittances already store their own driver and assignment, and the
  `lock_remittance_financial_facts` trigger stops those from changing. So the requirement is met
  with no schema change.
- **Alternatives**: None needed, because the data is already there.

## R4. Dating payments on the card's date

- **Decision**: `paymentTimestampFor(date, now)` in `lib/dates/fleet-date.ts` returns `now` when
  `date` is today in the fleet time zone. Otherwise it returns noon of `date` in the fleet time zone
  as an ISO timestamp with an offset (for example, `2026-10-28T12:00:00+08:00` for Asia/Manila).
  Every payment written from a card passes it as `paidAt` (FR-020a). `paymentSchema` already
  accepts `paidAt`.
- **Rationale**: Noon can't cross into the next or previous date under any UTC offset, so the
  monthly summary and report, which bucket by `paid_at` as a Manila date, put the money in the
  selected date's month. Asia/Manila has no daylight saving time, and the helper derives the offset
  from `Intl` so a different `NEXT_PUBLIC_FLEET_TIMEZONE` still works.
- **Alternatives**: Midnight, which risks landing on the previous day under a negative offset or
  through rounding. 23:59, which risks the next day for the same reasons. A user-picked time, which
  the spec rejected.

## R5. Changing a saved card's payment

- **Decision**: `planPaymentChange({ currentCentavos, targetCentavos, role })` is pure and returns:
  - `none`: the totals are equal.
  - `add(diff)`: the target is higher. Anyone may do this. It calls the existing
    `addRemittancePayment` logic with `paidAt` from R4 and an idempotency key.
  - `replace(target)`: the target is lower and the user is an owner. `editDailyRemittance` (see
    [contracts/daily-actions.md](contracts/daily-actions.md)) checks the owner, re-reads the active payments, voids each one with
    `correct_remittance_payment(id, reason)` (audited, `require_owner()`), and then inserts a single
    payment equal to the target (none if ₱0.00) with an idempotency key.
  - `blocked`: the target is lower and the user is staff (FR-027).

  The writes run void first, insert last. If a step fails, the card reloads the record's real total
  and says: "Some earlier payments were voided but the new amount wasn't saved. Save again to finish."
  Saving again re-reads the active payments, so it converges on the same target, and the idempotency
  key stops a second insert.
- **Rationale**: The schema stays the same and the existing audited correction path is reused. The flow meets the four conditions of principle III's multi-step clause (constitution 1.1.0): atomic and audited writes, safe ordering, convergent retry, and a plain-language way to finish. A
  partial failure can only understate what was received, which is a visible "Owes" state that can
  be fixed. It never overstates or double-counts.
- **Alternatives**: A new transactional `replace_remittance_payments` RPC. It is atomic, but it adds a
  SQL function, migration, grant, and pgTAP file, which conflicts with "no changes to the database
  schema". The project owner declined it on 2026-10-30. Another option is
  inserting a negative payment, which `amount_centavos > 0` forbids.

## R6. UI primitives: Base UI through base-nova wrappers, plus an in-repo calendar

- **Decision**: Generate the shadcn `base-nova` wrappers for `popover`, `dropdown-menu`, `tooltip`,
  `alert-dialog`, `toggle-group` (wrapped as `segmented-toggle`), and `progress` into `components/ui/`
  with `corepack pnpm dlx shadcn@latest add …`. Then restyle them to the repo tokens: a 4 to 6 px
  radius, no pills, no decorative shadows, and the focus ring from `:focus-visible`. The calendar
  is `components/ui/month-calendar.tsx`, a `role="grid"` month table with "Previous month" and "Next
  month" buttons, arrow, Home/End, and PageUp/PageDown key handling, `aria-selected`, and
  `aria-disabled` on days after `max`. It renders inside the popover.
- **Rationale**: `@base-ui/react` 1.9 is already installed and ships all of these primitives with
  keyboard and ARIA support (FR-033). The shadcn `calendar` component pulls in `react-day-picker`,
  which CLAUDE.md forbids ("no new component or animation libraries"). A single month grid is small
  and needs no date library, using `addDays` and `Intl.DateTimeFormat`.
- **Alternatives**: A native `<input type="date">`. It doesn't support the custom "Today" label,
  styling, or a consistent max date across mobile browsers, and the spec asks for month navigation in
  a calendar. Using `react-day-picker` is forbidden.

## R7. Card layout and the 4/2/1 grid

- **Decision**: Lay the cards out with `grid-cols-1`, then `md:grid-cols-2` from 768 px, then
  `min-[75rem]:grid-cols-4` from 1200 px. That uses a rem breakpoint, not a pixel literal, and a new
  `--breakpoint-desk: 75rem` in `@theme` lets components write `desk:grid-cols-4`. Each card uses
  the existing `Card` component with the `rounded-lg` (6 px) radius and a rule border. Saved cards
  get `bg-muted` (#f3f4f6). The unit name is `truncate` and wrapped in a tooltip trigger with the full
  name. The driver line is `flex flex-wrap items-center gap-1`, so the tag wraps only when needed.
  The due uses `text-page-title font-data`, the largest figure on the card.
- **Rationale**: It meets FR-016 to FR-018 with tokens only. DESIGN.md's "Do not put every element in
  a rounded card" is about decoration. Here each card is one unit of work, as the spec asks, and
  DESIGN.md gets a short note recording that.
- **Alternatives**: CSS auto-fill columns, which wouldn't give exactly 4, 2, or 1 columns at the
  stated widths.

## R8. Primary and Backup tag colors

- **Decision**: Add `--token-info: #1f4f7a` and `--token-info-soft: #e6eef7` (7.30:1). The Primary
  tag uses `bg-info-soft text-info`. The Backup tag uses `bg-brand-soft text-brand-dark` (12.77:1).
  Both are `status-badge` shapes (4 px radius, not pills) with their text label, so color is never
  the only cue (FR-015). The "Covering for [name], day off." tooltip is on a focusable trigger. The
  "Not operating" label uses `bg-muted text-muted` (5.75:1) with an icon.
- **Rationale**: This follows the mockup (blue Primary, warm Backup) while keeping `warn`, which
  DESIGN.md reserves for "expiring soon", out of it, and the yellow accent never carries white text.
- **Alternatives**: `ok` and `warn` tokens, which would misuse the compliance status colors. A
  neutral color for both, which fails "different colors".

## R9. Search placeholder, control borders, and the focus ring

- **Finding**: `ListSearch` uses `placeholder:text-muted`. In Tailwind v4, the `text-muted` utility's
  color resolves through `@theme` to `--color-muted: var(--muted)`, which is `#f3f4f6`, a background
  tint. So the placeholder sits at 1.1:1 on white. The plain `.text-muted` class only looks right
  because `globals.css` overrides it, and that override doesn't apply to the `placeholder:` variant.
  Toolbar borders use `--token-rule` `#d8dee7`, which is 1.35:1 on white and fails the 3:1 non-text
  rule (FR-043).
- **Decision**:
  - Placeholder: `placeholder:text-muted-foreground`, which is `#526174`, a solid color at
    **6.32:1** on the white field. Typed text stays `text-ink` `#0f1b2d` (17.28:1), clearly darker
    (FR-040, FR-041). The placeholder text becomes "Search by driver or unit".
  - Borders: add `--token-control-border: #7d8996`, which is **3.56:1** on white, 3.15:1 on the
    brand-soft hover fill, and 3.24:1 on muted. Apply it to the search field and the Any date,
    Filters, and Sort buttons (`border-control`).
  - Text and icons on those controls are `text-ink` (17.28:1) or `text-muted-foreground` (6.32:1),
    and both pass.
  - Focus ring: `focus-visible:outline-3 focus-visible:outline-focus focus-visible:outline-offset-2`
    on the search input, so it doesn't depend on the base-layer rule (`#7a4b00`, 7.41:1) (FR-042).
  - The ratios above are calculated with the WCAG relative-luminance formula, and they are
    re-checked in the browser at implementation time with computed styles (quickstart step 8).
- **Alternatives**: `#6B6B66`, which the user suggested (5.36:1). It passes, but it is a new
  off-palette gray when `--token-muted` already passes. `--token-subtle` `#6d7a89` is 4.38:1, so it
  fails.

## R10. Unsaved edits and the midnight rollover

- **Decision**: The board keeps a `dirty` set of card keys. The arrows, calendar, Today button,
  toggle, and new-day banner check it before navigating and, if it isn't empty, open an alert dialog:
  "You have unsaved changes on N cards. Leave without saving?" A `beforeunload` listener covers
  reloads and closing the tab. A capture-phase `click` listener on `document` catches same-origin
  `<a>` clicks, such as the sidebar, while the board has unsaved cards. A 30-second interval, plus
  `visibilitychange`, compares `fleetToday()` with the board's `today`. When they differ and the
  selected date was the old today, it shows the banner "It's now a new day. Switch to today?" and
  keeps the selected date (FR-030, FR-031). The cards' "today" logic (payment timestamps, the
  next-day arrow) uses the board's frozen `today` until the user switches.
- **Rationale**: The App Router has no event to block route changes. Intercepting anchor clicks is
  the usual, dependency-free way to do it, and it covers every in-app link.
- **Alternatives**: Auto-saving drafts to `localStorage`, which is more scope than the spec asks for.

## R11. Past-date edit confirmation

- **Decision**: `sessionStorage["rolnet:past-edit-confirmed"] = "1"` after the first confirmed
  past-date edit. The prompt reads "You're editing a record from Oct 28. Continue?" in a short
  month-day format (FR-025).
- **Rationale**: `sessionStorage` lasts exactly one browser tab session, which matches the
  assumption in the spec.

## R12. Demo mode and tests

- **Decision**: `loadDailyRows` has a demo branch that builds rows from `lib/demo/mode.ts`. That data
  already includes ROLNET-2 in repair with its driver off and no backup, ROLNET-3 covered by Pedro
  Santos, and primaries on ROLNET-1 to ROLNET-8. Demo remittances gain `assignment_id`, today
  records for 2 units, and payments, so Daily view shows saved, unrecorded, backup, and
  not-operating cards. Demo mode has no database, so writes aren't available there, as on every
  other page today. Save, lock, edit, lower, and blocked behavior are covered by Testing Library
  tests with mocked actions (`tests/unit/daily-card.test.tsx`). Playwright covers rendering,
  navigation, layout, and contrast in demo mode.
- **Rationale**: This follows the suite's existing pattern (feature 007's register tests run in demo
  mode) without adding a fake write path to production code.

## R13. List view changes

- **Decision**: Remove the `<aside>` and `RemittanceForm` (its only use) and the `workspace-grid` two-column
  wrapper. The table goes directly in the section. Remove the `hint`. Add a `note` slot to
  `listView` that renders on its own line under the count, in `text-body-sm text-muted`. The default
  sort stays `newest` (already first in `listControlSpecs.remittances`). Rows have no row-level click
  handler. They keep the existing `.data-table tbody tr:hover` tint, which is the "subtle hover", and
  no `cursor-pointer`. The date cell links to `?date=<service_date>` (Daily view) instead of
  `/remittances/[id]`. The detail page stays, reached from the dashboard and from the owner's
  "View record details" card menu item.
- **Rationale**: The smallest change that meets FR-034 to FR-039.
