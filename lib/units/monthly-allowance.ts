// Feature 010 (FR-041): a unit's "Monthly expenses vs allowance" blocks. Only months within the
// 12 calendar months ending with the current one that have remittances or expenses, newest first.
// Allowance is the stored allowance on the unit's active remittances (feature 009); expenses are
// the unit's active expenses. Bar widths are a share of the larger amount in the block.

export interface MonthlyAllowanceBlock {
  month: string;
  allowanceCentavos: number;
  expensesCentavos: number;
  netCentavos: number;
  allowanceWidth: number;
  expensesWidth: number;
}

function monthOf(date: string) {
  return date.slice(0, 7);
}

/** The first month of the 12-month window ending with `today`'s month, as YYYY-MM. */
export function windowStart(today: string) {
  const [year, month] = today.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1 - 11, 1));
  return `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function monthlyAllowanceBlocks(
  remittances: { service_date: string; allowance_centavos: number }[],
  expenses: { expense_date: string; amount_centavos: number }[],
  today: string,
): MonthlyAllowanceBlock[] {
  const first = windowStart(today);
  const last = monthOf(today);
  const totals = new Map<string, { allowance: number; expenses: number }>();
  const add = (month: string, key: "allowance" | "expenses", centavos: number) => {
    if (month < first || month > last) return;
    const entry = totals.get(month) ?? { allowance: 0, expenses: 0 };
    entry[key] += Number(centavos);
    totals.set(month, entry);
  };
  for (const row of remittances) add(monthOf(row.service_date), "allowance", row.allowance_centavos);
  for (const row of expenses) add(monthOf(row.expense_date), "expenses", row.amount_centavos);
  return [...totals.entries()].sort(([a], [b]) => b.localeCompare(a)).map(([month, { allowance, expenses: spent }]) => {
    const largest = Math.max(allowance, spent);
    return {
      month,
      allowanceCentavos: allowance,
      expensesCentavos: spent,
      netCentavos: allowance - spent,
      allowanceWidth: largest ? Math.round((allowance / largest) * 100) : 0,
      expensesWidth: largest ? Math.round((spent / largest) * 100) : 0,
    };
  });
}

/** "November 2026" for a YYYY-MM month. */
export function formatMonth(month: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "long", year: "numeric" }).format(new Date(`${month}-01T00:00:00Z`));
}
