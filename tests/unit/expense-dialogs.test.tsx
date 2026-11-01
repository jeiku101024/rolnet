import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";

const mocks = vi.hoisted(() => ({
  createExpense: vi.fn(), updateExpense: vi.fn(), deleteExpense: vi.fn(), getReceiptUrl: vi.fn(), prepareReceiptUpload: vi.fn(), finalizeReceiptUpload: vi.fn(),
  refresh: vi.fn(), push: vi.fn(),
}));
vi.mock("@/app/actions/expenses", () => ({
  createExpense: mocks.createExpense, updateExpense: mocks.updateExpense, deleteExpense: mocks.deleteExpense, getReceiptUrl: mocks.getReceiptUrl,
  prepareReceiptUpload: mocks.prepareReceiptUpload, finalizeReceiptUpload: mocks.finalizeReceiptUpload,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh, push: mocks.push }) }));

import { ToastProvider } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AddExpenseDialog, type EditableExpense } from "@/components/expenses/expense-dialog";
import { ExpenseRowMenu } from "@/components/expenses/expense-row-menu";
import { DeleteExpenseDialog } from "@/components/expenses/delete-expense-dialog";

const units = [
  { id: "00000000-0000-4000-8000-000000000001", body_number: "T-001", plate_number: "ABC-1234" },
  { id: "00000000-0000-4000-8000-000000000002", body_number: "T-002", plate_number: "ABC-1235" },
];
const chain: EditableExpense = {
  id: "00000000-0000-4000-8000-000000000041", unit_id: units[0].id, category: "chain", custom_category: null, expense_date: "2026-10-30", replaced_date: "2026-10-29",
  amount_centavos: 35000, notes: "Shop on the highway", updated_at: "2026-10-30T08:00:00+00:00", receipt_object_path: null, units: { body_number: "T-001", plate_number: "ABC-1234" },
};

const wrap = (node: ReactNode) => render(<ToastProvider><TooltipProvider>{node}</TooltipProvider></ToastProvider>);
const press = async (name: string) => { await act(async () => { fireEvent.click(screen.getByRole("button", { name })); }); };
const field = (label: RegExp) => screen.getByLabelText(label) as HTMLInputElement;
const type = (label: RegExp, value: string) => fireEvent.change(field(label), { target: { value } });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-01T04:00:00Z")); // 12:00 in Manila
  for (const mock of Object.values(mocks)) mock.mockReset();
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("AddExpenseDialog (feature 011, US1)", () => {
  it("opens a modal titled Add expense, with today as the expense date", async () => {
    wrap(<AddExpenseDialog units={units} />);
    await press("Add expense");
    expect(screen.getByRole("dialog", { name: "Add expense" })).toBeInTheDocument();
    expect(field(/^Expense date/).value).toBe("2026-11-01");
    const options = within(field(/^Unit/) as unknown as HTMLElement).getAllByRole("option").map((option) => option.textContent);
    expect(options).toEqual(["Choose a unit", "Body T-001 · ABC-1234", "Body T-002 · ABC-1235"]);
  });

  it("shows inline errors on save and keeps the modal open", async () => {
    wrap(<AddExpenseDialog units={units} />);
    await press("Add expense");
    await press("Save expense");
    expect(screen.getByText("Choose a unit.")).toBeInTheDocument();
    expect(screen.getByText("Choose a category.")).toBeInTheDocument();
    expect(screen.getByText("Enter a peso amount such as 180 or 180.50.")).toBeInTheDocument();
    expect(mocks.createExpense).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Add expense" })).toBeInTheDocument();
  });

  it("swaps Date replaced and Category name in place, keeping the other values (FR-020)", async () => {
    wrap(<AddExpenseDialog units={units} />);
    await press("Add expense");
    type(/^Category(?! name)/, "chain");
    expect(field(/^Date replaced/).value).toBe("2026-11-01");
    type(/^Expense date/, "2026-10-28");
    expect(field(/^Date replaced/).value).toBe("2026-10-28");
    type(/^Amount/, "350");
    type(/^Notes/, "Shop on the highway");
    type(/^Category(?! name)/, "others");
    expect(screen.queryByLabelText(/^Date replaced/)).not.toBeInTheDocument();
    expect(field(/^Category name/)).toBeInTheDocument();
    type(/^Category(?! name)/, "battery");
    expect(screen.queryByLabelText(/^Category name/)).not.toBeInTheDocument();
    expect(field(/^Amount/).value).toBe("350");
    expect(field(/^Notes/).value).toBe("Shop on the highway");
  });

  it("hints when an Others name looks like a main category", async () => {
    wrap(<AddExpenseDialog units={units} />);
    await press("Add expense");
    type(/^Category$|^Category\*/, "others");
    type(/^Category name/, "oil change");
    expect(screen.getByText("This looks like Change Oil. Choose it from Category to track Last Replaced.")).toBeInTheDocument();
  });

  it("saves, closes and shows Expense added", async () => {
    mocks.createExpense.mockResolvedValue({ ok: true, data: { id: "e1", updatedAt: "2026-11-01T04:00:00Z" } });
    wrap(<AddExpenseDialog units={units} />);
    await press("Add expense");
    type(/^Unit/, units[0].id);
    type(/^Category(?! name)/, "chain");
    type(/^Amount/, "350");
    await press("Save expense");
    expect(mocks.createExpense).toHaveBeenCalledWith(expect.objectContaining({ unitId: units[0].id, category: "chain", replacedDate: "2026-11-01", expenseDate: "2026-11-01", amountCentavos: 35000, customCategory: undefined }));
    expect(await screen.findByText("Expense added")).toBeInTheDocument();
    expect(mocks.refresh).toHaveBeenCalled();
    expect(screen.queryByRole("dialog", { name: "Add expense" })).not.toBeInTheDocument();
  });

  it("reuses one idempotency key for a retry after a failed save (FR-026)", async () => {
    mocks.createExpense.mockResolvedValueOnce({ ok: false, code: "UNEXPECTED", message: "Network trouble." }).mockResolvedValueOnce({ ok: true, data: { id: "e1", updatedAt: "x" } });
    wrap(<AddExpenseDialog units={units} />);
    await press("Add expense");
    type(/^Unit/, units[0].id);
    type(/^Category(?! name)/, "battery");
    type(/^Amount/, "1200");
    await press("Save expense");
    expect(await screen.findByText("Network trouble.")).toBeInTheDocument();
    await press("Save expense");
    expect(mocks.createExpense).toHaveBeenCalledTimes(2);
    expect(mocks.createExpense.mock.calls[0][0].idempotencyKey).toBe(mocks.createExpense.mock.calls[1][0].idempotencyKey);
  });
});

describe("ExpenseRowMenu (feature 011, US3)", () => {
  async function openMenu() {
    await press("Expense options");
  }

  it("offers Edit and Delete to the owner", async () => {
    wrap(<ExpenseRowMenu expense={chain} units={units} isOwner />);
    await openMenu();
    expect(await screen.findByRole("menuitem", { name: "Edit" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Delete" })).not.toHaveAttribute("aria-disabled", "true");
  });

  it("shows Delete disabled for staff", async () => {
    wrap(<ExpenseRowMenu expense={chain} units={units} isOwner={false} />);
    await openMenu();
    const item = await screen.findByRole("menuitem", { name: "Delete (owner only)" });
    expect(item).toHaveAttribute("aria-disabled", "true");
    expect(item).toHaveAttribute("title", "Only the owner can delete expenses");
  });

  it("opens Edit expense pre-filled and saves with the expected timestamp", async () => {
    mocks.updateExpense.mockResolvedValue({ ok: true, data: { id: chain.id, updatedAt: "y" } });
    wrap(<ExpenseRowMenu expense={chain} units={units} isOwner />);
    await openMenu();
    await act(async () => { fireEvent.click(await screen.findByRole("menuitem", { name: "Edit" })); });
    expect(screen.getByRole("dialog", { name: "Edit expense" })).toBeInTheDocument();
    expect((screen.getByLabelText(/^Category(?! name)/) as HTMLSelectElement).value).toBe("chain");
    expect(field(/^Date replaced/).value).toBe("2026-10-29");
    expect(field(/^Amount/).value).toBe("350.00");
    type(/^Amount/, "400");
    await press("Save changes");
    expect(mocks.updateExpense).toHaveBeenCalledWith(chain.id, expect.objectContaining({ amountCentavos: 40000, expectedUpdatedAt: chain.updated_at, replacedDate: "2026-10-29" }));
    expect(await screen.findByText("Expense updated")).toBeInTheDocument();
  });

  it("asks before a main category becomes Others (FR-024)", async () => {
    wrap(<ExpenseRowMenu expense={chain} units={units} isOwner />);
    await openMenu();
    await act(async () => { fireEvent.click(await screen.findByRole("menuitem", { name: "Edit" })); });
    await act(async () => { type(/^Category(?! name)/, "others"); });
    expect(await screen.findByText("Remove Last Replaced date?")).toBeInTheDocument();
    expect(screen.getByText("This removes the Last Replaced date.")).toBeInTheDocument();
    await press("Cancel");
    expect((screen.getByLabelText(/^Category(?! name)/) as HTMLSelectElement).value).toBe("chain");
    await act(async () => { type(/^Category(?! name)/, "others"); });
    await press("Continue");
    expect((screen.getByLabelText(/^Category(?! name)/) as HTMLSelectElement).value).toBe("others");
    expect(screen.queryByLabelText(/^Date replaced/)).not.toBeInTheDocument();
  });

  it("shows the stale message with a Reload button", async () => {
    mocks.updateExpense.mockResolvedValue({ ok: false, code: "STALE_RECORD", message: "This expense was changed or deleted by someone else. Reload to see the latest." });
    wrap(<ExpenseRowMenu expense={chain} units={units} isOwner />);
    await openMenu();
    await act(async () => { fireEvent.click(await screen.findByRole("menuitem", { name: "Edit" })); });
    await press("Save changes");
    expect(await screen.findByText("This expense was changed or deleted by someone else. Reload to see the latest.")).toBeInTheDocument();
    await press("Reload");
    expect(mocks.refresh).toHaveBeenCalled();
  });
});

describe("DeleteExpenseDialog (feature 011, FR-029 to FR-031)", () => {
  it("shows the expense, focuses Cancel, and deletes with the expected timestamp", async () => {
    mocks.deleteExpense.mockResolvedValue({ ok: true, data: null });
    const onOpenChange = vi.fn();
    wrap(<DeleteExpenseDialog expense={chain} open onOpenChange={onOpenChange} />);
    expect(screen.getByText("Delete this expense?")).toBeInTheDocument();
    expect(screen.getByText("This permanently removes the expense and changes report totals for that period.")).toBeInTheDocument();
    for (const text of ["Body T-001", "Chain", "₱350.00"]) expect(screen.getByText(text)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus());
    await press("Delete expense");
    expect(mocks.deleteExpense).toHaveBeenCalledWith(chain.id, chain.updated_at);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(await screen.findByText("Expense deleted")).toBeInTheDocument();
  });

  it("keeps the dialog open with the reason when the delete fails", async () => {
    mocks.deleteExpense.mockResolvedValue({ ok: false, code: "STALE_RECORD", message: "This expense was changed or deleted by someone else. Reload to see the latest." });
    wrap(<DeleteExpenseDialog expense={chain} open onOpenChange={() => {}} />);
    await press("Delete expense");
    expect(await screen.findByRole("alert")).toHaveTextContent("changed or deleted by someone else");
  });
});
