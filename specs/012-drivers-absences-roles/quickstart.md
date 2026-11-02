# Quickstart: Validating Feature 012

## Prerequisites

- `corepack pnpm install`
- Database checks: local Supabase can't run on this machine. pgTAP runs against **rolnet-dev**
  through the rollback wrapper, **only after the owner approves**. Both 012 migrations must be pushed
  to rolnet-dev first (also with approval).
- Demo build for e2e: `NEXT_PUBLIC_DEMO_MODE=true` (Playwright starts it on :3100).

## Automated checks (definition of done)

```bash
corepack pnpm lint
```

```bash
corepack pnpm typecheck
```

```bash
corepack pnpm test
```

```bash
corepack pnpm test:e2e
```

```bash
corepack pnpm check
```

```bash
corepack pnpm build:vinext
```

Then `supabase test db` against rolnet-dev via the wrapper (with approval). The new files are
`constraints/340`, `350`, `360` and `rls/230`. The full suite must stay green (see memory: run the
full pgTAP suite after trigger changes).

## Manual walkthrough (live dev server on :3000, real data on rolnet-dev)

Each step lists its expected result. Spec references are in brackets.

1. **List** [US3]: open `/drivers`.
   - There's no form card, and the table is full width.
   - The toolbar shows Search, Filters, and "+ Add a driver".
   - The meta row shows "Available for assignment: N of M".
2. **Add** [US8]: click "Add a driver" and save with no name. An inline error appears. Fill in the
   fields and save.
   - The toast reads "Driver added", and the row appears.
   - The driver is offered in `/units?view=daily` today.
3. **Day-off** [US1]: on the new driver's profile, choose Status → Day-off for tomorrow, reason Sick.
   - The toast reads "… is on day-off [tomorrow]".
   - The list shows "Next: Day-off …".
   - Units daily view for tomorrow: the driver isn't in the dropdowns. The day after, he is.
4. **Overlap** [FR-036]: add an On-leave covering tomorrow. An inline error names the existing
   day-off.
5. **Release** [US2]: save the driver on a unit for today and for the day after tomorrow, then add a
   leave from the day after tomorrow for 3 days.
   - "Release assignments?" lists only the day after tomorrow.
   - Confirm. That unit card is unassigned, and today's card is untouched.
6. **Past dates** [FR-038]: add a day-off on a past date that has an assignment and a remittance.
   - The amber warning shows the counts, and the button reads "Save anyway".
   - After saving, the past records are unchanged.
7. **Role** [US4]: click Backup in the header.
   - The toast with Undo appears, and Role history shows "Primary → Backup".
   - Yesterday's remittance card still shows Primary.
   - Click Undo within 5 s. The history entry disappears.
8. **Return to Active** [US7]: with a leave covering today, choose Status → Active.
   - The dialog appears. Tick "Also cancel 1 upcoming absence" and choose End absence now.
   - The leave shows Ended early, the upcoming one shows Cancelled, and the driver is available today.
9. **Stale** [US6]: in the demo (or a rolnet-dev row with a start 16 days ago), check the stale flag.
   - The list shows amber "Open for 16 days", and the banner counts it.
   - "Show them" filters to it. Dismissing hides the banner until a new session.
   - On the profile, "Still on leave" shows the toast, and the list shows "open-ended · checked".
   - "Set end date" opens the edit dialog with focus on To.
10. **Staff** [FR-050]: sign in as staff.
    - Role switch and absences work.
    - There's no Add a driver or Edit details, and Inactive is disabled in the Status dropdown.
11. **Layout** [FR-023, SC-006]:
    - At 1440 × 900 the header, summary strip, and details fit without scrolling.
    - At 360 px the cards are 2 per row, the tabs scroll sideways, and the page doesn't scroll
      horizontally.
12. **Tabs** [FR-021]: on a driver with more than 8 assignments, the tab shows 8 rows, and Load more
    shows 16.

## Expected e2e specs (demo)

- `tests/e2e/drivers-list.spec.ts`: columns, filters, the banner with Show them and dismiss, the
  preview panel, the Add driver modal (validation, Escape).
- `tests/e2e/driver-profile.spec.ts`: the 1440 × 900 fold check, 360 px layout, tab keyboard
  navigation, Load more, notices.
- `tests/e2e/driver-absences.spec.ts`: dialog validation (open-ended disables To, To ≥ From), the
  past-date warning copy, release dialog copy. Writes are disabled in demo, so save paths are checked
  on rolnet-dev manually.
