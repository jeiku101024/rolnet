# Quickstart: Validating the Sinking Fund

Validation guide only; implementation lives in the tasks.

## Prerequisites

- Corepack pnpm installed; `.env.local` set for the live dev server, or `NEXT_PUBLIC_DEMO_MODE=true` for
  the demo-mode checks.
- The three new migrations applied to `rolnet-dev` (ask the owner first; there is no local Supabase).
- Two accounts: the owner, and an approved staff user.

## Automated checks

```bash
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm test:e2e
corepack pnpm check
corepack pnpm build:vinext
```

pgTAP (through the project's rollback wrapper against `rolnet-dev`, after the owner agrees): files
`410_sinking_fund_tables.sql`, `420_sinking_fund_rules.sql`, `430_sinking_fund_reads.sql`, and
`rls/100_sinking_fund_rls.sql`, then the full existing suite to confirm nothing regressed.

## Scenario 1: Worked example A (owner or staff)

1. Add participant "Ana". Deposit ₱10,000 → savings 10,000.00.
2. Loan ₱2,000 dated today → preview "5% interest (₱100) · To pay: ₱2,100 · Due [today + 1 month]";
   savings 8,000.00; toast "Loan recorded. To pay ₱2,100 by [date]".
3. As staff, payment ₱500 → ₱100 to the Interest fund, ₱400 to savings; savings 8,400.00; balance 1,600.00.
4. Payment ₱1,600 → loan Paid; savings 10,000.00; fund 100.00.

Expected: matches [spec.md](spec.md) worked example A; Vitest and pgTAP assert the same numbers.

## Scenario 2: Worked example B and interest control (owner)

1. Same loan. Payment ₱500 with interest part 0 → savings 8,500.00, balance 1,600.00, fund 0.
2. Payment ₱1,000 with interest part 100 → savings 9,400.00, balance 600.00, fund 100.00.
3. Payment ₱600 → Paid; savings 10,000.00.
4. "Change interest part" on step 1 to ₱100 → allowed range check; effects shown; audit shows old and new.
5. Out-of-range value (for example ₱150) is blocked with "Interest part must be between ₱X and ₱Y...".

## Scenario 3: Rules and back-dating

- Loan ₱150 → "Loans must be in steps of ₱100..."; loan above savings → "Loan cannot be higher than total
  savings (₱X)."
- Ana has ₱1,000 on Nov 1 and a ₱5,000 deposit on Nov 10: a ₱3,000 loan dated Nov 5 is blocked with a
  message naming Nov 5 and ₱1,000.00; ₱800 on Nov 5 saves.
- Voiding the Nov 10 deposit while a later entry depends on it is blocked.
- Two browser tabs submit payments that together exceed the balance: only one succeeds.

## Scenario 4: Withdrawal, savings withdrawal, archive

- A loan past its due date with a partial payment shows a red "Overdue" tag and the card pill; owner marks
  it as withdrawal → savings unchanged, loan Withdrawn, text "Paid ₱500 of ₱2,100. ₱1,600 closed as
  withdrawal on [date]."; staff sees the action disabled with "Owner only".
- Savings withdrawal above savings is blocked; withdraw to ₱0, then archive succeeds; archive with
  savings or open loans is refused.

## Scenario 5: Distribution

- With ₱100.00 in the fund and three active participants: modal shows "Each participant gets ₱33.33" and
  "₱0.01 stays in the fund."; confirm → three Interest shares, fund 0.01, toast text per spec; voiding the
  distribution is blocked if a participant's savings would go negative.

## Scenario 6: Views and layout

- `/sinking-fund`, `?view=top`, `?view=participants` each open directly; switching does not reload.
- Top view: ties share rank and trophy; Monthly and Weekly arrows work; zero rows are last.
- Participants view: both charts have "View as table"; cards show 4, 2, 1 per row at desktop, tablet, 360 px.
- At 360 px every view and dialog has no horizontal scroll; dialogs close on Escape and trap focus.

## Cleanup

Playwright and pgTAP data live in rolled-back transactions or demo mode; manual test data on `rolnet-dev`
should be voided by the owner or removed with the project's test-data cleanup.
