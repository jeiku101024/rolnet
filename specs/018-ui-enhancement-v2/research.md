# Research: UI Enhancement v2

All unknowns from the plan's Technical Context are resolved here. Web references were consulted on 2026-11-18.

## R1. Pop-up enter/exit animation

- **Decision**: Use CSS transitions driven by Base UI's `data-starting-style` (enter) and `data-ending-style` (exit) attributes on every `Backdrop`/`Popup` in `components/ui/{dialog,alert-dialog,sheet,popover,dropdown-menu,tooltip}.tsx`. Properties: `opacity` + `transform` (scale 0.96 and 6 px rise) only. Enter 180 ms, exit 120 ms, `ease-out`. Shared via `--motion-*` tokens and one utility class in `app/globals.css`.
- **Rationale**: Base UI mounts the popup with the starting attribute, removes it one frame later (so a transition runs), and keeps the popup mounted on close until its transition ends (it detects `opacity` animations via `getAnimations()`), so exit animations need no JS and no timers. `sheet.tsx` already uses this pattern, so the other pop-ups just match it. Only compositor properties animate, so no layout work and no lag.
- **Alternatives rejected**: Motion/Framer (new dependency, violates CLAUDE.md "no new animation libraries"); manual unmount timers (fragile with rapid open/close); `@starting-style` plus `display` transitions (Base UI already handles mount/unmount).
- **Sources**: [Base UI animation handbook](https://base-ui.com/react/handbook/animation), [Base UI Dialog](https://base-ui.com/react/components/dialog.md), [web.dev entry animations](https://web.dev/blog/baseline-entry-animations).

## R2. Login/register card swap without re-render

- **Decision**: Keep `/login` and `/register` as real routes (deep links, refresh, Back/Forward all work). Put a client `AuthStage` in a new `app/(auth)/layout.tsx`. The layout persists across soft navigations, so the logo and background never re-render. `AuthStage` renders **both** cards in a horizontal two-panel track and moves the track with `transform: translateX` according to `usePathname()`. The inactive panel is `inert` and `aria-hidden`. The login and register `page.tsx` files return `null` after doing their session redirect.
- **Rationale**: A pathname-driven transform gives the exact "slide left out, enter from right" motion, reverses automatically on Back, and survives rapid clicks (a transform just retargets). It avoids freezing router output, which is fragile. Initial load at `/register` renders the final position with no transition.
- **Details**: Transition 320 ms, `cubic-bezier(0.22, 1, 0.36, 1)`. After the swap, focus moves to the incoming panel's first field. A visually hidden live region announces "Sign in" / "Register". The login card reads the `error` and `registered` query values on the client (inside `Suspense`); form submission errors still redirect to `/login?error=...`, which keeps the same panel (no transition because the path is unchanged). Reduced motion: opacity cross-fade, no translate.
- **Alternatives rejected**: View Transitions API (inconsistent support, re-renders both pages); per-page exit animation with a frozen router tree (private API, fragile); one route with a tab state (breaks deep links and the existing `redirect()` flow).
- **Inspiration**: [21st.dev login card](https://21st.dev/@ruixen.ui/components/login-card), [shadcn.io login blocks](https://www.shadcn.io/blocks/login-gradient-accent), [CodingNepal sliding login/signup](https://dev.to/codingnepalweb/animated-login-signup-form-design-using-html-css-javascript-1en1). Take: centered brand mark, one card, soft gradient shapes behind it, slide track between forms. Leave: glassmorphism and particles (poor contrast, GPU cost), framer-motion.

## R3. Animated background

- **Decision**: Pure CSS: 3 blurred brand-colored blobs (`--token-brand`, `--token-brand-soft`, `--token-brand-dark` at low opacity) drifting with `transform` keyframes (20-30 s, `ease-in-out`, alternate), on a fixed `pointer-events-none` layer behind the stage. `will-change: transform` on the blobs only. Paused when `document.hidden` (via `animation-play-state` toggled by a tiny `visibilitychange` listener) and static under `prefers-reduced-motion`. Blur is baked into a radial-gradient (no `filter: blur`) to keep it cheap on phones.
- **Rationale**: Transform-only keyframes run on the compositor; three elements keep paint cost negligible.
- **Alternatives rejected**: canvas/WebGL (JS cost, battery), `filter: blur` on large layers (expensive on low-end mobile), SVG SMIL.

## R4. Dark mode

- **Decision**: Class strategy. `:root.dark` in `app/globals.css` redefines every `--token-*` and the shadcn aliases (`--muted: #f3f4f6` etc.); Tailwind v4 `@custom-variant dark (&:where(.dark, .dark *))` is added for the rare component that needs a `dark:` override. A small blocking inline script in `<head>` (hand-written, no library) reads `localStorage["rolnet-theme"]` (`light` | `dark`; absent = follow device), falls back to `matchMedia("(prefers-color-scheme: dark)")`, and sets `class="dark"` plus `color-scheme` on `<html>` before first paint. `<html>` gets `suppressHydrationWarning`.
- **Control** (clarified): a `ThemeToggle` client component (Light/Dark icon button) plus a "Match my device" item in a small dropdown menu (existing `dropdown-menu.tsx`), which removes the stored value and live-follows `matchMedia` changes. Placed in the public header, the signed-in header, and the mobile sheet header (reachable at 360 px).
- **Rationale**: Tokens are already centralized (no hex colors in components), so remapping the tokens re-themes everything including charts and status tags; a hand-rolled script avoids adding `next-themes` (no new dependency, one fewer hydration surface under Cache Components).
- **Dark palette**: derived from the brand (see data-model.md "Dark token map"); brand yellow stays the action/active accent, `--token-brand-dark` flips to a light ink for text-on-dark, surfaces become navy (`#0F1B2D` family). Every pair is verified at 4.5:1 text / 3:1 control border (DESIGN.md rules); verification is a unit test over the token map (contrast math), run in CI.
- **Print**: `@media print` forces light tokens (FR-012). Excel exports are untouched.
- **Alternatives rejected**: `next-themes` (extra dependency), media-query-only dark (no user override), per-component `dark:` classes (large diff, drift).
- **Sources**: [zero-flash dark mode, Tailwind v4 + Next.js](https://ulrik-matemu.is-a.dev/blog/zero-flash-dark-mode-tailwind-v4-nextjs), [Next.js dark mode without flash](https://dev.to/dev_encyclopedia/nextjs-dark-mode-without-the-flash-tailwind-v4-4io0).

## R5. Save and update feedback

- **Decision**: Three small pieces, all CSS-first:
  1. `SubmitButton` gains a spinner icon (lucide `Loader2`, `animate-spin`) while `pending` (already `disabled`/`aria-busy`).
  2. `useActionForm` outcomes may carry a `recordId`; a lightweight `SaveFeedbackProvider` (mounted in the root layout next to `ToastProvider`) exposes `markSaved(id)`. After the refresh settles, it finds `[data-record-id="<id>"]`, adds the `row-saved` class (a 900 ms background-tint keyframe, plus an ease-in for newly created rows), and removes it on `animationend`. No React re-render of lists.
  3. `FormStatusMessage` success text fades/slides in (150 ms).
- **Rationale**: Only the one changed element animates (FR-020), lists never re-render for animation, and failed saves never call `markSaved` (FR-021). Rows opt in by exposing `data-record-id`, so rollout is incremental per screen.
- **Alternatives rejected**: animating list diffs with a library (dependency, cost on long lists); per-row React state (re-renders).

## R6. Reduced motion and performance budget

- **Decision**: One block in `globals.css`: `@media (prefers-reduced-motion: reduce)` zeroes transform/looping animation (opacity-only 100 ms fades remain). Budget: enter ≤ 250 ms, exit ≤ 150 ms, swap ≤ 320 ms, only `opacity`/`transform`, at most one looping animation (background) on a page, none inside lists or tables.
- **Verification**: Playwright checks computed `transition-property` and durations on pop-ups and the auth track, a reduced-motion emulation run, rapid open/close x20 with no leftover backdrop, and a Chromium trace of the swap for long tasks.

## R7. Signed-out navigation

- **Decision**: Remove the `Ledger` entry from `components/navigation/public-nav.tsx`. The header logo link still goes to `/` (middleware/redirect sends signed-out visitors to `/login`, which is already how `/` behaves for them).
