# UI Contracts: UI Enhancement v2

No HTTP, server action, or database contract changes. These are the component and behavior contracts the implementation and tests rely on.

## C1. Theme

- `<html>` carries `class="dark"` when dark is active and `suppressHydrationWarning`.
- Inline head script (before first paint): stored `rolnet-theme` wins; otherwise `prefers-color-scheme`. Sets class and `style.colorScheme`.
- `ThemeToggle`: button with `aria-label` "Switch to dark theme" / "Switch to light theme" (reflects the next state), 44 px touch target; adjacent menu item "Match my device" removes the stored value and re-syncs. While following the device, a `matchMedia` change updates the class live.
- Present in: public header, signed-in header, mobile sheet. Never required to sign in.

## C2. Auth stage (`app/(auth)/layout.tsx` + `AuthStage`)

- Structure: background layer, centered logo (`rolnet-logo.svg`, `logo-full-auth`), a clipped viewport containing a two-panel track (`#login-panel`, `#register-panel`).
- Active panel follows the pathname; the other is `inert` and `aria-hidden="true"`.
- Switch link: normal `<Link>` (soft navigation, updates the address). Direction: `/login -> /register` moves the track left; reverse moves it right.
- After a swap: focus the first input of the incoming panel; live region `role="status"` announces the form name; `document.title` follows the route metadata.
- Error/success messages (`?error=`, `?registered=1`) render inside the login panel; they never trigger a swap.
- `prefers-reduced-motion`: no translate, 100 ms cross-fade; background static.

## C3. Pop-up motion

- Applies to `DialogContent`, `AlertDialog` content, `SheetContent`, `PopoverContent`, dropdown menu popup, tooltip popup, and their backdrops.
- Contract: element exposes `data-starting-style` on mount and `data-ending-style` on close; CSS transitions `opacity` and `transform` only. Enter <= 250 ms, exit <= 150 ms. After the exit transition the node is removed from the DOM and scroll lock is released.
- Dialog origin: scale 0.96 + 6 px rise from center. Popover/menu: same scale, transform-origin at the trigger side (`--transform-origin`). Sheet: existing slide, aligned to the shared timing.

## C4. Save feedback

- `SubmitButton`: when `pending`, shows a spinner and the pending label, `disabled`, `aria-busy="true"`.
- Rows/cards that can be saved expose `data-record-id="<uuid>"`.
- `useActionForm` handlers may return `{ ok: true, message, recordId? }`; on success with a `recordId`, `markSaved(recordId)` is called after the view refresh. On `ok: false`, it is never called.
- `markSaved` adds class `row-saved` (and `row-new` when the node was not present before the save) to the matching element only; the class is removed on `animationend`.
- Success message: fades in over 150 ms.
