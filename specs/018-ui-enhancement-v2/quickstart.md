# Quickstart: validating UI Enhancement v2

Prerequisites: `corepack pnpm install`; demo mode (`NEXT_PUBLIC_DEMO_MODE=true`) or a configured `.env.local`. No database change, so no `supabase db reset` is needed.

```powershell
corepack pnpm dev
```

## Manual walkthrough (360 px and desktop)

1. Signed out, open `/login`: nav shows only **Sign in** and **Register** (no Ledger); logo centered above the card; background drifts slowly.
2. Click **Register for approval**: Sign in slides left and out, Register slides in from the right; the logo and background do not flicker; focus is in "Display name"; address is `/register`.
3. Press browser **Back**: reverse motion, address `/login`. Click rapidly 10 times: no stuck or overlapping cards.
4. Open `/register` directly and refresh: Register shows at once with no transition.
5. Submit a wrong password: the error appears in the Sign in card; no swap animation.
6. Theme: toggle Light/Dark in the header (also at 360 px); reload (no flash); choose **Match my device** and change the OS theme (the app follows).
7. Dark mode on every main screen (Dashboard, Units, Drivers, Remittances, Expenses, Documents, Sinking fund, Reports): readable, focus ring visible, status tags still show icon + label.
8. Open and close every pop-up kind (dialog, confirm, sheet, popover, menu, tooltip) with Close, Cancel, Escape, backdrop tap, and after a completed action: enter and exit animations visible, nothing stuck, focus returns to the trigger.
9. Create and edit a remittance, expense, and sinking-fund entry: spinner while saving, the changed row tints for about 1 s (new rows ease in), nothing animates on a failed save.
10. OS "Reduce motion" on: no sliding, scaling, or looping motion anywhere.

## Automated checks

```powershell
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm test:e2e
```

New coverage (see tasks): dark-token contrast unit test; theme script and toggle unit tests; Playwright specs for the auth swap (direction, history, focus, reduced motion), pop-up open/close cycles, and save highlight. No pgTAP changes (no schema change).
