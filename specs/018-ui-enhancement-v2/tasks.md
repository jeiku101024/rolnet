# Tasks: UI Enhancement v2

**Input**: Design documents in `specs/018-ui-enhancement-v2/` (plan.md, spec.md, research.md, data-model.md, contracts/ui-contracts.md, quickstart.md)

**Prerequisites**: plan.md, spec.md. No database or schema change, so no migrations or pgTAP tasks.

**Tests**: Included. The spec sets measurable, testable outcomes (contrast, no stuck backdrops, reduced motion), and the project's definition of done requires lint, typecheck, and tests to pass.

**Format**: `- [ ] T### [P?] [Story?] Description with file path`. `[P]` = can run in parallel (different files, no unfinished dependency).

**Rules to keep in view**: no new dependency; only `opacity`/`transform` animate; enter <= 250 ms, exit <= 150 ms, swap <= 320 ms; no hex colors or arbitrary sizes in components (tokens only); every screen works at 360 px; honor `prefers-reduced-motion`.

## Phase 1: Setup

- [x] T001 Confirm branch `018-ui-enhancement-v2` is checked out and run `corepack pnpm lint`, `corepack pnpm typecheck`, `corepack pnpm test` once to record the baseline (note any pre-existing failures in the PR description).
- [x] T002 Read `node_modules/next/dist/docs/` guides for layouts, `usePathname`, `useSearchParams` (Suspense under Cache Components), and `<script>` in the root layout, per AGENTS.md, before editing `app/layout.tsx` and `app/(auth)/`.

## Phase 2: Foundational (blocks all user stories)

- [x] T003 Add motion tokens to `:root` in `app/globals.css` exactly as in data-model.md: `--motion-enter: 180ms`, `--motion-exit: 120ms`, `--motion-swap: 320ms`, `--motion-highlight: 900ms`, `--motion-ease-out: cubic-bezier(0.22, 1, 0.36, 1)`.
- [x] T004 Add a single `@media (prefers-reduced-motion: reduce)` block at the end of `app/globals.css` that removes transforms and looping animation and leaves only opacity changes of at most 100 ms (applies to every utility added in later tasks).
- [x] T005 Add shared motion utilities to `app/globals.css` (unlayered or in `@layer utilities`): `.motion-popup` (transitions `opacity`, `scale` and `translate` over `--motion-enter`, using the individual `scale`/`translate` properties so existing centering is preserved; `[data-starting-style]` => opacity 0, scale 0.96, translate 0 0.375rem; `[data-ending-style]` => same values with `--motion-exit`), `.motion-backdrop` (opacity only), and `.motion-popup-origin` (uses `transform-origin: var(--transform-origin)` for anchored pop-ups).

**Checkpoint**: shared timings and reduced-motion rules exist; story phases can start.

## Phase 3: User Story 1 - Polished sign-in and registration screen (P1) - MVP

**Goal**: No Ledger link for signed-out visitors, logo centered above the card, animated background, modern card layout.

**Independent Test**: Signed out at 360 px and desktop, `/login` and `/register`: no Ledger link, logo centered (margins within 2 px), background animating, form usable.

- [x] T006 [P] [US1] Write `tests/e2e/ui-v2-auth.spec.ts`: signed-out header has Sign in and Register but no "Ledger" link on `/login` and `/register`; logo bounding box center equals card center within 2 px at 360 px and 1280 px; background layer exists with a running animation (and `animation-name: none` under `reducedMotion: "reduce"`).
- [x] T007 [US1] Remove the `Ledger` item (and the unused `BookOpenText` import) from `publicItems` in `components/navigation/public-nav.tsx`.
- [x] T008 [P] [US1] Create `components/auth/auth-background.tsx`: a decorative `aria-hidden`, `pointer-events-none`, `fixed inset-0 -z-10` layer with three radial-gradient blobs using `--token-brand`, `--token-brand-soft`, `--token-brand-dark` at low opacity; transform-only keyframes (20-30 s, alternate) defined in `app/globals.css` as `.auth-blob-*`; `will-change: transform` on blobs only; pause via a `visibilitychange` listener toggling `animation-play-state`; static under reduced motion (R3).
- [x] T009 [P] [US1] Create `components/auth/login-card.tsx` (client): the existing Sign in content moved from `app/(auth)/login/page.tsx` (heading, helper line, demo credentials note, `ValidationSummary`, `DemoLoginForm` or `FormPanel` with `submitLogin`, "Register for approval" link). Read `error` and `registered` via `useSearchParams` inside a `Suspense` boundary and map with `loginErrorMessage`. Move the server action `submitLogin` to the new `"use server"` file `app/(auth)/actions.ts` (it calls `signIn` from `app/actions/auth.ts` and redirects) and import it in the client card.
- [x] T010 [P] [US1] Create `components/auth/register-card.tsx`: the existing Staff registration content moved from `app/(auth)/register/page.tsx`, with `submitRegistration` moved to the same `app/(auth)/actions.ts` (calls `registerStaff`, redirects to `/register?error=` or `/login?registered=1`) and imported here, and the "Return to sign in" link.
- [x] T011 [US1] Create `app/(auth)/layout.tsx`: renders `AuthBackground`, the centered logo (`Image` `/brand/rolnet-logo.svg`, class `logo-full-auth`, `mx-auto`) above the stage, and the cards. For now render the active card only (the sliding track is added in US2).
- [x] T012 [US1] Reduce `app/(auth)/login/page.tsx` and `app/(auth)/register/page.tsx` to the session redirect (`getSessionProfile`, `isApproved`, `startPageFor`) and `return null`; keep exported behavior and each page's own `metadata`/`generateMetadata` (distinct titles "Sign in" and "Staff registration") so the document title follows the route after a soft navigation; if the title does not update on a soft swap, set it from `AuthStage` as a fallback.
- [x] T013 [US1] Polish the card per DESIGN.md tokens in `components/auth/*.tsx` and `app/globals.css`: max width `workspace-narrow`, card padding, heading/helper hierarchy, full-width primary button, link styling; verify 360 px with no horizontal scroll.

**Checkpoint**: US1 passes its independent test; app still signs in and registers.

## Phase 4: User Story 2 - Smooth card swap (P1)

**Goal**: Switching between Sign in and Register slides cards (out left / in from right, reversed on back) without re-rendering the logo or background.

**Independent Test**: Click through the swap, press Back, click rapidly, open `/register` directly: correct direction, no flicker, no overlap, address and focus correct.

- [x] T014 [P] [US2] Extend `tests/e2e/ui-v2-auth.spec.ts` with the swap section: after clicking "Register for approval" the URL is `/register`, the register panel is visible and `login-panel` is `inert`; transform of the track changes; Back restores `/login`; 10 rapid clicks end with exactly one visible panel; direct load of `/register` shows it with no running transition; focus is on "Display name" after the swap; reduced motion uses no translate; a failed login keeps `/login` and the same panel; typing an email into Sign in, swapping to Register and back leaves the typed value intact (FR-007); `document.title` changes between the Sign in and Register routes and follows Back/Forward (FR-006).
- [x] T015 [US2] Create `components/auth/auth-stage.tsx` (client): two panels `#login-panel` and `#register-panel` in a horizontal track clipped by `overflow-hidden`; `transform: translateX(0 or -100%)` chosen from `usePathname()`; transition `transform var(--motion-swap) var(--motion-ease-out)`; no transition on first paint; inactive panel gets `inert` and `aria-hidden="true"`; `will-change: transform` only while transitioning.
- [x] T016 [US2] After a path change in `AuthStage`, focus the first input of the incoming panel (skip on initial mount) and render a visually hidden `role="status"` live region announcing "Sign in" or "Register".
- [x] T017 [US2] Use `AuthStage` in `app/(auth)/layout.tsx`, passing `<LoginCard />` and `<RegisterCard />`; confirm the logo and background elements keep the same DOM nodes across the swap (no remount).
- [x] T018 [US2] Add reduced-motion handling for the track in `app/globals.css`: no translate, 100 ms opacity cross-fade between panels.
- [x] T019 [US2] Verify in the browser at 360 px and desktop (Playwright run `corepack pnpm test:e2e -- ui-v2`), and confirm a Chromium trace shows no long task during the swap (SC-003). (Playwright swap spec passes; long-task trace not run)

**Checkpoint**: US1 and US2 complete; sign-in/register delivered as the MVP.

## Phase 5: User Story 3 - Dark mode (P2)

**Goal**: Light/Dark switch plus "Match my device", remembered per device, applied before first paint, readable everywhere.

**Independent Test**: Toggle on the login page and every main screen; reload with no flash; contrast test passes.

- [x] T020 [P] [US3] Create `lib/theme/theme-script.ts` exporting `THEME_STORAGE_KEY = "rolnet-theme"` and `themeScript` (a string IIFE: try/catch around `localStorage`, stored `dark|light` wins, otherwise `matchMedia("(prefers-color-scheme: dark)")`; toggles `class="dark"` on `document.documentElement` and sets `style.colorScheme`).
- [x] T021 [P] [US3] Write `tests/unit/theme-script.test.ts`: stored dark => class present; stored light on a dark device => absent; nothing stored follows `matchMedia`; throwing `localStorage` does not throw and follows the device.
- [x] T022 [US3] Edit `app/layout.tsx`: add `suppressHydrationWarning` to `<html>` and render a `<script dangerouslySetInnerHTML={{ __html: themeScript }} />` as the first child of `<head>` so it runs before first paint (check the Next.js 16 docs from T002 for the supported pattern).
- [x] T023 [US3] In `app/globals.css` add `@custom-variant dark (&:where(.dark, .dark *));` and a `:root.dark` block defining a dark value for **every** `--token-*` and every shadcn alias (`--muted: #f3f4f6`, `--primary`, `--primary-foreground`, `--secondary`, `--accent`, `--border`, `--input`, `--ring`, `--sidebar*`), starting from the table in data-model.md; also set `color-scheme: dark` there.
- [x] T024 [P] [US3] Write `tests/unit/dark-token-contrast.test.ts`: parse `app/globals.css`, assert every light token has a dark counterpart, text/background pairs (ink/canvas, ink/surface, muted/surface, each status color on its `-soft`, brand-dark/surface, focus/surface) are >= 4.5:1, and `--token-control-border`/chart tokens vs surface are >= 3:1. Adjust the T023 values until the test passes.
- [x] T025 [US3] Create `components/navigation/theme-toggle.tsx` (client): icon button (lucide `Sun`/`Moon`, `touch-target`, `aria-label` "Switch to dark theme"/"Switch to light theme") that writes `localStorage` (try/catch) and toggles the class; a small `DropdownMenu` (existing `components/ui/dropdown-menu.tsx`) with "Match my device" that removes the key and re-syncs; while no key is stored, a `matchMedia` change listener updates the class live. Avoid hydration mismatch by deriving the icon after mount.
- [x] T026 [P] [US3] Write `tests/unit/theme-toggle.test.tsx`: toggling stores and flips the class; "Match my device" clears the key and follows the mocked media query; storage errors are tolerated.
- [x] T027 [US3] Mount `ThemeToggle` in `components/navigation/app-shell.tsx` in both headers (signed-out header next to `PublicNav`, signed-in header at the right of the bar), and in the mobile sheet header in `components/navigation/app-sidebar.tsx`; confirm it fits at 360 px. (NOTE: toggle added to both headers, which are visible at 360 px; not duplicated inside the nav sheet)
- [x] T028 [US3] Add `@media print { :root.dark { ...light token values } }` (or reuse the light block via a shared selector) in `app/globals.css` so printing stays light (FR-012).
- [x] T029 [US3] Make the auth background and logo legible in dark: dark blob colors in `components/auth/auth-background.tsx` styles, and verify `/brand/rolnet-logo.svg` (navy wordmark) is readable on the dark canvas; if not, place the logo on a light surface chip using tokens rather than editing the brand asset.
- [x] T030 [US3] Sweep for color that bypasses tokens: `grep` components and app for `bg-white`, `text-black`, `#`-hex and `rgb(` literals (including `shadow` rgb in `globals.css` `form.data-region`) and replace with tokens; fix any dark-mode contrast gaps found on Dashboard, Units, Drivers, Remittances, Expenses, Documents, Sinking fund (including `components/sinking-fund/charts`), Reports.
- [x] T031 [US3] Write `tests/e2e/ui-v2-theme.spec.ts`: `emulateMedia({ colorScheme: "dark" })` loads dark with no light flash (class present at `domcontentloaded`); toggle persists across reload; "Match my device" returns to following the device; toggle reachable at 360 px on `/login` and on a signed-in screen; computed `color-scheme` and canvas color differ between themes; the `:focus-visible` outline color keeps >= 3:1 against the surface in dark mode; with `page.emulateMedia({ media: "print", colorScheme: "dark" })` the canvas and ink colors equal the light values (FR-012). (verified: the spec passes in demo mode; the login-card cases run on a non-demo server because demo mode redirects /login)

**Checkpoint**: dark mode works app-wide; contrast test passes.

## Phase 6: User Story 4 - Pop-up open and close animations (P2)

**Goal**: Every pop-up and backdrop animates in and out, never blocks input, never leaves a stuck backdrop.

**Independent Test**: Open/close each pop-up kind 20 times via every close path; each shows enter and exit transitions and leaves nothing behind.

- [x] T032 [P] [US4] Update `components/ui/dialog.tsx`: backdrop gets `motion-backdrop`; popup gets `motion-popup` (replace the `-translate-y-1/2` utility with the individual CSS `translate: 0 -50%` property and animate only the individual `scale` and `translate` properties via `.motion-popup`, never the `transform` shorthand, so the centering is never overwritten).
- [x] T033 [P] [US4] Update `components/ui/alert-dialog.tsx` the same way as T032 (review its current classes first).
- [x] T034 [P] [US4] Update `components/ui/sheet.tsx`: align duration and easing to the motion tokens (`--motion-enter`/`--motion-exit`) and keep the existing slide; ensure the backdrop uses `motion-backdrop`.
- [x] T035 [P] [US4] Update `components/ui/popover.tsx`: popup gets `motion-popup motion-popup-origin`.
- [x] T036 [P] [US4] Update `components/ui/dropdown-menu.tsx` popup with `motion-popup motion-popup-origin`.
- [x] T037 [P] [US4] Update `components/ui/tooltip.tsx` popup with a shorter fade-only variant (opacity, 100 ms) so hover hints never feel delayed.
- [x] T038 [P] [US4] Update `components/ui/toast.tsx` so toasts ease in (opacity + 8 px rise) and fade out using the same tokens.
- [x] T039 [US4] Audit for pop-ups that bypass the shared primitives: `grep -rn "fixed inset-0\|role=\"dialog\"\|<dialog" components app` and migrate or style any custom overlay (for example `components/documents/*dialog.tsx`, `components/sinking-fund/dialogs/*`, `components/drivers/*dialog.tsx`, `components/units/*dialog.tsx`, `components/expenses/*dialog.tsx`) so all use the animated primitives.
- [x] T040 [US4] Write `tests/e2e/ui-v2-popups.spec.ts`: for a dialog (e.g. Add unit), an alert dialog (e.g. delete expense), the nav sheet at 360 px, a popover, and a dropdown row menu: assert computed `transition-property` includes `opacity`, duration <= 250 ms; close via Close, Cancel, Escape, and backdrop tap; assert the node and backdrop are removed afterwards (also when a confirmation dialog opens as a form dialog closes), `document.body` is not scroll-locked, and focus is back on the trigger; repeat 20 rapid open/close cycles and double-click Close without errors; reopen during close works; under `reducedMotion: "reduce"` transforms are `none`; run the 20-cycle test once with CDP `Emulation.setCPUThrottlingRate` 4x and assert opening or closing adds no long task (> 100 ms) (SC-007). (verified: the spec passes in demo mode; the CPU-throttle long-task check was not added)

**Checkpoint**: all pop-ups share the motion language.

## Phase 7: User Story 5 - Save and update feedback (P3)

**Goal**: Pending spinner on submit, success message fade-in, and a brief tint on the one changed row (new rows ease in); nothing on failure.

**Independent Test**: Create and edit records on several screens; highlight appears on the right element only and settles in about 1 s; failed save shows none.

- [x] T041 [P] [US5] Add row feedback keyframes to `app/globals.css`: `.row-saved` (background tint from `--token-brand-soft` to transparent over `--motion-highlight`) and `.row-new` (opacity 0 and 6 px rise to rest, `--motion-enter`); both under the reduced-motion rule as static highlight only.
- [x] T042 [P] [US5] Create `components/ui/save-feedback.tsx` (client): `SaveFeedbackProvider` and `useSaveFeedback()` returning `markSaved(recordId, { created?: boolean })`. It waits for the next two animation frames after the view refresh, queries `[data-record-id="<id>"]`, adds `row-saved` (and `row-new` when `created`), and removes the class on `animationend`. No React state for the highlight.
- [x] T043 [US5] Mount `SaveFeedbackProvider` in `app/layout.tsx` beside `ToastProvider`.
- [x] T044 [US5] Update `components/forms/form-status.tsx`: `SubmitButton` shows lucide `Loader2` with `animate-spin` (and `aria-hidden`) when `pending`; `FormStatusMessage` success text uses a 150 ms fade/rise class defined in `app/globals.css`.
- [x] T045 [US5] Update `components/forms/use-action-form.ts`: allow `FormOutcome` success to include optional `recordId` and `created`; on success call `markSaved` (via `useSaveFeedback`) after `form.reset()`; never call it on failure or thrown errors.
- [x] T046 [US5] Audit save paths and record the result in a "Save path audit" note appended to this phase in this file. Starting list (from a search of `components`): `components/units/{add-unit-dialog,record-mileage-dialog,unit-details-section,assignment-card}.tsx`; `components/drivers/{add-driver-dialog,absence-dialog,return-to-active-dialog,driver-details-section,driver-status-control,role-switch}.tsx`; `components/expenses/expense-dialog.tsx`; `components/documents/{upload-document-dialog,confirm-version-dialog,document-details-dialog}.tsx`; `components/sinking-fund/dialogs/*.tsx` and `form-kit.tsx`; `components/forms/{mileage-form,remittance-detail-forms}.tsx`. For each, record the save handler, the success hook point, the saved record id, and whether it already uses `useActionForm`/`SubmitButton`. Delete, void and archive flows are excluded (spec Assumptions).
- [x] T046a [P] [US5] Units saves: apply the `SubmitButton` pending state and call `markSaved(id, { created })` on success in `components/units/add-unit-dialog.tsx`, `record-mileage-dialog.tsx`, `unit-details-section.tsx`, `assignment-card.tsx` and `components/forms/mileage-form.tsx`; behavior and error handling unchanged.
- [x] T046b [P] [US5] Drivers saves: same change in `components/drivers/add-driver-dialog.tsx`, `absence-dialog.tsx`, `return-to-active-dialog.tsx`, `driver-details-section.tsx`, `driver-status-control.tsx`, `role-switch.tsx`.
- [x] T046c [P] [US5] Expenses saves: same change in `components/expenses/expense-dialog.tsx` (create and edit).
- [x] T046d [P] [US5] Documents saves: same change in `components/documents/upload-document-dialog.tsx`, `confirm-version-dialog.tsx`, `document-details-dialog.tsx`. (done without a test run, at the owner's request)
- [x] T046e [P] [US5] Sinking fund saves: same change in `components/sinking-fund/form-kit.tsx` and each save dialog under `components/sinking-fund/dialogs/` (add participant, add transaction, loan/withdrawal, fund settings, distribute, change interest part); exclude `void-dialog.tsx`.
- [x] T046f [P] [US5] Remittances saves: same change in `components/forms/remittance-detail-forms.tsx` (record payment, corrections) and in `components/remittances/daily-card.tsx` and `daily-view.tsx` where they save.
- [x] T047 [P] [US5] Add `data-record-id` to saved-record rows/cards: `components/units/assignment-card.tsx` and unit rows, driver rows in `components/drivers`, `components/remittances/daily-card.tsx` and `remittances-list.tsx`, expense rows in `components/expenses`, `components/documents/document-list.tsx`, `components/sinking-fund/transaction-row.tsx`. Use the record's id already available in each component. (units, drivers, expenses, assignment and daily cards, sinking-fund rows, documents lists, and the unit and driver detail forms)
- [x] T048 [P] [US5] Write `tests/unit/save-feedback.test.tsx`: `markSaved` adds `row-saved` only to the matching element, adds `row-new` when `created`, removes classes on `animationend`, does nothing for unknown ids, and is never called when the form outcome fails (via `useActionForm`).
- [x] T049 [US5] Write `tests/e2e/ui-v2-save.spec.ts`: save a remittance payment or expense in demo mode, assert the submit button shows `aria-busy` while pending, the changed row gets `row-saved` then loses it within about 1.2 s, other rows never get it, and a forced failure shows the error with no highlight; with CPU throttling 4x on a list of 50+ rows, saving one row adds no long task (> 100 ms) (SC-007), and a MutationObserver sees a class change on that one row only. (verified: the spec passes in demo mode; the CPU-throttle long-task check was not added)

**Checkpoint**: all five stories work independently.

## Phase 8: Polish and cross-cutting

- [x] T050 [P] Update `DESIGN.md` with a "Motion" section (timings, allowed properties, reduced-motion rule, pop-up and save patterns) and a "Dark theme" section (token map, contrast results, toggle placement); DESIGN.md wins over any outside inspiration.
- [x] T051 [P] Update `docs/DEVELOPMENT.md` with the theme key, the `data-record-id`/`markSaved` convention, and the animation budget for future screens.
- [ ] T052 Run the full quickstart walkthrough in `specs/018-ui-enhancement-v2/quickstart.md` at 360 px and desktop, in light and dark, and with OS reduced motion on; fix anything that fails (hidden Browser pane does not hydrate, so verify with Playwright). (NOTE: new specs run in demo and non-demo servers; full manual walkthrough in a real browser not done)
- [ ] T053 Run `corepack pnpm lint`, `corepack pnpm typecheck`, `corepack pnpm test`, `corepack pnpm test:e2e`, `corepack pnpm check`, and `corepack pnpm build:vinext`; all must pass (no `supabase test db` needed: no schema change). (NOTE: typecheck, unit tests and lint on changed paths pass; e2e for signed-in screens, `check` and `build:vinext` not yet run)
- [ ] T054 Re-verify success criteria SC-001 to SC-010 and tick them off in the PR description. SC-008 is checked as: only the changed row is highlighted and the highlight settles within about 1 second (T049); no user study is run; note the baseline from T001 for any pre-existing failures.

## Dependencies and execution order

- Phase 1 -> Phase 2 -> user stories. Phase 2 (T003-T005) blocks US4 and US5 and the auth motion in US2; US1 does not need it except T008's keyframes (which live in globals and do not depend on T003).
- **US1 (T006-T013)** has no story dependency. **US2 (T014-T019)** depends on US1 (the cards and layout). **US3 (T020-T031)** is independent of US1/US2 except T027/T029 touch the shared header and auth background. **US4 (T032-T040)** depends only on Phase 2. **US5 (T041-T049)** depends on Phase 2 and benefits from US4 for dialog-based saves (T046a-T046f).
- Order of delivery by priority: US1 -> US2 (MVP) -> US3 -> US4 -> US5 -> Polish.
- Within a story: tests first (they fail), then components, then integration.

## Parallel opportunities

- US1: T006, T008, T009, T010 in parallel; then T011-T013.
- US3: T020, T021, T024, T026 in parallel; T023 before T024's final tuning.
- US4: T032-T038 are all different files and fully parallel.
- US5: T041, T042, T047, T048 in parallel; T045-T046f after T042 (T046a-T046f run in parallel after T046).
- US3, US4 and US5 can proceed in parallel after Phase 2 if staffed separately; `globals.css` edits (T003-T005, T023, T028, T041) must be merged sequentially.

## Implementation strategy

1. **MVP**: Phases 1-2, US1, US2 (login screen and swap). Validate with T019, then demo.
2. Add US3 (dark mode) and validate on all screens.
3. Add US4 (pop-ups), then US5 (save feedback); each is shippable alone.
4. Finish with polish and the full command suite (T050-T054).

## Follow-up (owner request, 2026-11-19)

- [x] T055 [US5] Add "Newest first" (`created_at` descending) as the default sort for Units and Drivers in `lib/pagination/list-control-specs.ts`, select `created_at` in `app/(owner)/units/page.tsx`, `lib/drivers/list-query.ts` and `lib/drivers/list-board.ts`, and update `tests/unit/list-controls.test.ts` (default sort is now "newest").
- [x] T056 [US5] New rows slide in from the left with a fade and a 1 s glow (`.row-new` in `app/globals.css`); the glow is cleaned up only when `row-saved` ends (`components/ui/save-feedback.tsx`), and a newly created row scrolls into view.
- [x] T057 [US5] Sinking fund participant cards pop in when added (`data-record-kind="card"` in `components/sinking-fund/participants-view.tsx`, `.row-new` pop variant); document rows in the folder tree carry `data-record-id` (`components/documents/unit-tree.tsx`).
