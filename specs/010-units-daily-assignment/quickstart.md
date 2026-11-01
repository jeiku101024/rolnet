# Quickstart: Validate Units Daily Assignment

See [contracts/](contracts/) for exact rules and messages and [data-model.md](data-model.md) for the
records. Run every command from the repo root with Corepack pnpm.

## Prerequisites

- Branch `010-units-daily-assignment`, with dependencies installed (`corepack pnpm install`).
- No local Supabase is available here. Database tests run against **rolnet-dev** through the rollback
  wrapper, and only after the owner approves each run.
- **Release-day timing**: apply the three migrations on the morning the app is deployed. The seed
  copies drivers for the fleet date it runs on (research R13).

## 1. Static checks and unit tests

```bash
corepack pnpm lint
```

```bash
corepack pnpm typecheck
```

```bash
corepack pnpm test
```

These should pass, including `status-on`, `assignment-board`, `monthly-allowance`, `units-view-params`,
and the updated `daily-board` and `daily-card` tests.

## 2. Database tests (after approval)

Apply the migrations to rolnet-dev, regenerate the types, then run the full pgTAP suite (not only the
new files):

```bash
corepack pnpm exec supabase gen types typescript --linked > types/database.ts
```

Expected: 280–310 and rls/210 pass, and every updated legacy test passes. Key assertions:

- Two active rows can't share (unit, date) or (driver, date).
- Saving on a blocked date, before the unit existed, or with an ineligible driver is refused.
- Changing a unit to In repair releases only rows dated today or later that have no remittance.
- Archiving releases the same rows. Restoring brings nothing back.
- Deactivating or archiving a driver releases their rows from today on.
- A remittance insert with `assignment_id` is refused. One without a matching assignment is refused.
- Legacy remittances still accept payment changes, and their deposit updates.
- An assignment with a remittance can't be updated or released until the remittance is reversed.
- Staff can save assignments but can't update units.
- `soft_delete_record('units', …)` is refused.
- The seed created one row per available unit for the fleet date.

## 3. End-to-end (demo build)

```bash
corepack pnpm test:e2e
```

`e2e/units-daily-assignment.spec.ts` and `e2e/unit-archive.spec.ts` cover the scenarios below at
1280 px and 360 px.

## 4. Manual walkthrough (owner, then staff)

1. Open **Units**. The table is full width, with columns Unit … Mileage, Status (badge), and a menu. Choose **Add a unit**, save with Plate empty (an inline error shows), then fill it in: the modal closes and the "Unit added" toast shows.
2. Switch to **Daily assignment view** with no page reload. Today's date shows the "Today" tag and "0 of M units assigned". Assign driver A to unit 1 and save: the card locks and driver A disappears from the other dropdowns.
3. In two cards, pick the same driver and save both: the second card shows "Driver already assigned today" and resets.
4. Go to tomorrow: unit 1 is pre-filled with driver A ("Pre-filled from previous day"), and the count is still 0. Save it.
5. Go to yesterday and choose **Edit assignment**: the past-date confirmation shows once per session.
6. Open unit 1 → **More info**. Change the status to **In repair**: the release confirmation shows. Confirm. Daily assignment view now shows unit 1 blocked today and tomorrow, and driver A is free. Yesterday is unchanged.
7. In **Remittances Daily view** today, unit 1 is grayed out with "No remittance for this date" and left out of "N of M recorded". An unassigned unit shows **Assign driver**, which opens Units in Daily assignment view on that date.
8. Record a remittance for unit 2. In Daily assignment view, unit 2's card has no menu and says "A remittance is already recorded for this day."
9. Archive unit 3 from the row menu. The modal lists the counts with Cancel focused, and Escape closes it. Confirm: the "Unit archived" toast shows and the unit is gone from both daily views. It's still in Remittances List view and the Monthly report. Tick **Show archived (1)** → **Restore**: the "Unit restored" toast shows.
10. Deactivate a driver who's assigned tomorrow: the confirmation shows, and after confirming that unit is unassigned tomorrow.
11. Sign in as **staff**. Units opens straight into Daily assignment view with no toggle. Staff can save and edit assignments. Blocked cards have no "Open unit" link. `/units/<id>` is forbidden.
12. Repeat steps 2, 6, and 9 at a 360 px viewport: one card per row, no horizontal page scroll, and the dialogs fit.

## 5. Build checks

```bash
corepack pnpm check
```

```bash
corepack pnpm build:vinext
```
