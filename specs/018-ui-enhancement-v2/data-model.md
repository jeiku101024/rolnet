# Data Model: UI Enhancement v2

No database, migration, RLS, or Storage change. No business entity is added or altered. The only persisted value is a per-device browser setting.

## Client-side state

| Name | Where | Values | Notes |
|------|-------|--------|-------|
| `rolnet-theme` | `localStorage` | `"light"` \| `"dark"` \| absent | Absent means follow the device. Wrapped in try/catch; storage failures fall back to following the device. Never sent to the server. |
| Resolved theme | `class="dark"` on `<html>` | present \| absent | Set by the inline head script before first paint and by `ThemeToggle`. |
| Auth panel | derived from `usePathname()` | `/login` \| `/register` | No stored state; the track position is a function of the path. |
| Last saved record | `SaveFeedbackProvider` (ref, not state) | record id | Set only by `markSaved(id)` after a successful save; cleared on `animationend`. |

## Dark token map (defined in `app/globals.css` under `:root.dark`)

Every light token gets a dark counterpart. Starting values (final values are fixed by the contrast test in tasks):

| Token | Light | Dark |
|-------|-------|------|
| `--token-canvas` | `#fffcf3` | `#0b1422` |
| `--token-surface` | `#ffffff` | `#142033` |
| `--token-ink` | `#0f1b2d` | `#f3efe3` |
| `--token-muted` | `#526174` | `#a9b6c6` |
| `--token-subtle` | `#6d7a89` | `#8e9cae` |
| `--token-rule` | `#d8dee7` | `#2b3a52` |
| `--token-control-border` | `#7d8996` | `#7f8da1` |
| `--token-brand` | `#ffc72c` | `#ffc72c` (unchanged; text on it stays `#0f1b2d`) |
| `--token-brand-dark` | `#1b2a41` | `#ffd666` (used as brand text and primary fill on dark) |
| `--token-brand-soft` | `#fff1bd` | `#33290d` |
| `--token-focus` | `#7a4b00` | `#ffd666` |
| status `ok/warn/danger/info` + `-soft` | light pairs | lighter text on dark soft tints, each pair >= 4.5:1 |
| `violet/orange/gold/silver/bronze` + `-soft` | light pairs | same rule |
| `--token-chart-*` | current | lightened to >= 3:1 on `--token-surface` dark; patterns and legends unchanged |
| shadcn aliases (`--muted`, `--primary`, `--primary-foreground`, ...) | current | remapped to the dark tokens |

## Motion tokens (new, in `app/globals.css`)

| Token | Value |
|-------|-------|
| `--motion-enter` | `180ms` |
| `--motion-exit` | `120ms` |
| `--motion-swap` | `320ms` |
| `--motion-highlight` | `900ms` |
| `--motion-ease-out` | `cubic-bezier(0.22, 1, 0.36, 1)` |
