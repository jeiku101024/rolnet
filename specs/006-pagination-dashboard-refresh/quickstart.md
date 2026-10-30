# Quickstart: Validate Paginated Lists and Dashboard Refresh

Setup, commands, and business rules: [docs/DEVELOPMENT.md](../../docs/DEVELOPMENT.md).
Contracts: [list-paging.md](contracts/list-paging.md), [dashboard.md](contracts/dashboard.md).
View models: [data-model.md](data-model.md).

## Prerequisites

```bash
corepack pnpm install
corepack pnpm exec supabase start
corepack pnpm exec supabase db reset
corepack pnpm dev
```

Seed enough rows to get several pages (e.g. 25+ remittances, 12+ drivers, 3 backup drivers with
one assigned today, 2 units set to "In repair", documents expiring in −3, 2, 10, 25 days, and
6+ due maintenance items). Demo mode (`NEXT_PUBLIC_DEMO_MODE=true`) ships enough demo rows for
the e2e checks below.

## Automated gates

```bash
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm test:e2e
corepack pnpm check
```

No migration in this feature, so `supabase test db` must still pass unchanged.

## Manual scenarios (run at 360 px and at desktop width)

| # | Steps | Expected |
|---|---|---|
| 1 | Open `/remittances` | 10 rows, "1–10 of N records", First/Previous disabled |
| 2 | Click Last, then refresh, then open a row and press Back | Same last page each time |
| 3 | Visit `/remittances?page=0`, `?page=abc`, `?page=999` | Page 1, page 1, last page |
| 4 | Search a driver name that only appears on a later page | Match shown; label shows filtered count; URL has `q=` and no `page=` |
| 5 | Search `zzzz` | "No records match" message with Clear search |
| 6 | Inspect any list's search field | Search icon, Clear button when typed, visible gap between field and table header rule |
| 7 | On `/drivers`, change a driver's status on page 2 | Dropdown works; stays on page 2 |
| 8 | On `/units/[id]`, page the assignment history | Only `assignments_page` changes; documents list stays put |
| 9 | Open `/dashboard` on a phone | First section is "Needs attention"; expired document first; ≤ 5 rows per panel; "View all N" when more |
| 10 | Check Extradors and Units in repair | All active backups, assigned first with "Body X today"; only in-repair units, longest first |
| 11 | Compare tiles with `/reports` for this month | Collected, expenses, net equal to the centavo |
| 12 | Check charts with an empty month (fresh reset) | ₱0.00 tiles; chart empty-state messages; no blank boxes |
| 13 | Confirm "Recent units", "Recent drivers", monthly summary table are gone | Not present |
| 14 | Any page at 360 px | No horizontal page scrolling; paging controls tappable |
| 15 | Log in as staff | Dashboard still forbidden; staff lists page normally |
