# Validation: Remittances Daily View (feature 008)

Date: 2026-10-31. Branch: `008-remittances-daily-view`.

## Automated checks

| Check | Result |
|-------|--------|
| `corepack pnpm lint` | Pass (0 errors; 4 existing warnings in `app/actions/auth.ts` and `components/forms/demo-login-form.tsx`, unrelated) |
| `corepack pnpm typecheck` | Pass |
| `corepack pnpm test` | Pass: 30 files, 164 tests. New: `daily-board` (14), `daily-card` (17), `daily-view` (4), `month-calendar` (4), `payment-plan` (5), `fleet-date` (4), `remittances-view-params` (7) |
| `corepack pnpm check` (vinext) | 95% compatible, 0 issues (same as before) |
| `corepack pnpm build:vinext` | Pass |
| Playwright, demo build on :3100 | 40 passed, 6 failed. All 11 new `remittances-daily-view` tests and both new `accessibility-mobile` Remittances tests pass. The 6 failures are in `app-navigation`, `ui-system-refresh` and the first `accessibility-mobile` test: they need the public sign-in page (`/`, `/login`), which demo mode skips because it is always signed in. They don't touch Remittances. They were not re-run on `main` to confirm they fail there too |
| Schema unchanged (FR-044, SC-009) | `git status -- supabase types` is empty: no migration, RPC, grant or generated-type change |

## Browser check (demo build, 1280 px and 360 px)

- `/remittances` opens Daily view on today with 4 cards per row at 1280 px and 1 per row at 360 px, and no sideways scroll. It shows ROLNET-1 saved (locked, muted, "Paid", "Saved" with a lock, ⋯ menu), ROLNET-2 and ROLNET-7 "Not operating (in repair)", ROLNET-3 Pedro Santos with a Backup tag, the header "1 of 6 recorded" and "₱300.00 received", and a progress bar. There were no console warnings.
- List view (toggle): full-width list card (945 px of 945 px), the note under "30 records", row cursor `auto`, row dates link to `?date=`.
- Measured: placeholder `rgb(82, 97, 116)` (6.32:1 on white), typed text `rgb(15, 27, 45)`, search, Any date, Filters and Sort borders `rgb(125, 137, 150)` (3.56:1), and on focus a 3 px solid outline in `rgb(122, 75, 0)`. The search icon is `rgb(82, 97, 116)`.
- Unsaved guard: with an entry typed on ROLNET-4, a sidebar link click opened "You have unsaved changes on 1 card. Leave without saving?" and the page stayed put.
- A save in demo mode reaches the real backend, which has no demo assignment. The card kept "150" and showed "The driver wasn't assigned to this unit on this date. Reload the page." That is the expected failure path (demo mode has no writes).

## Plain-language review (constitution IV)

Every new label and message was reviewed for a non-technical owner or staff member. Each says what happened and what to do next, with no codes:

- Cards: "Due", "Disposition", "Payment received (₱)", "Notes", "Save remittance", "Saved", "Not operating", "Not operating (in repair)", "{name} is off today. No backup assigned.", "Ask the owner to assign a backup driver.", "Assign driver", "No drivers are free on this date.", "Disposition can't be changed after saving. Reverse it on the record's details page to change it."
- Errors: "Enter an amount like 180 or 180.50.", "Only the owner can lower a recorded payment.", "This unit already has a remittance for this date. Reload to see it." (with a Reload button), "Someone changed this remittance after you opened it. Reload the card and edit again.", "Some earlier payments were voided but the new amount wasn't saved. Save again to finish.", "The remittance was saved, but the payment was not. Edit the card to add the payment."
- Dialogs: "You're editing a record from Oct 28. Continue?", "Lower the payment from ₱180.00 to ₱100.00?" (with the reason field), "You have unsaved changes on N cards. Leave without saving?", and the banner "It's now a new day. Switch to today?"
- Wording changed as a result: the existing duplicate-remittance messages said "Open it from the list to add a payment", which List view no longer allows. They now say "Reload to see it." (`lib/actions/errors.ts`).

## Not yet done (T050)

- The quickstart walkthrough against **rolnet-dev** with real saves, edits, owner lowering, backup assignment and past-date payments, as owner and as staff. It needs a signed-in session on the real backend and your go-ahead.
- The timed phone run for SC-001 and SC-002 (a 9-unit day in under 3 minutes, at most 3 interactions per card).

## Deviations from tasks.md

- T002: the shadcn CLI failed (it calls a bare `pnpm` that isn't on PATH), so the Base UI wrappers were written by hand in the base-nova style. No package was added.
- T012: demo Daily view rows come from the existing `demoRemittances` (ROLNET-1 is saved today) instead of adding a ROLNET-4 record. That avoids changing List view's demo counts, which other e2e tests depend on.
- T013 and T041 were done together in `components/remittances/remittances-list.tsx`. The view toggle sits in the page header for both views, with an `UnsavedGuardProvider` so the toggle also asks before discarding entries.
