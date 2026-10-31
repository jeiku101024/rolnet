import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { SavedCard, UnrecordedCard } from "@/lib/remittances/daily-board";

const mocks = vi.hoisted(() => ({ save: vi.fn(), edit: vi.fn(), assign: vi.fn(), refresh: vi.fn(), push: vi.fn() }));
vi.mock("@/app/actions/remittances", () => ({ saveDailyRemittance: mocks.save, editDailyRemittance: mocks.edit }));
vi.mock("@/app/actions/assignments", () => ({ assignBackupDriver: mocks.assign }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh, push: mocks.push }) }));

import { DailyCard, type CardView } from "@/components/remittances/daily-card";

const date = "2026-10-30";
const unrecorded: UnrecordedCard = { key: `${date}:u1`, unitId: "u1", unitName: "ROLNET-1", bodyNumber: "T-001", kind: "unrecorded", assignmentId: "00000000-0000-4000-8000-000000000031", driver: { driverId: "d1", name: "Juan Dela Cruz", role: "primary", coveringFor: null } };
const saved: SavedCard = { ...unrecorded, kind: "saved", remittanceId: "00000000-0000-4000-8000-000000000051", updatedAt: "2026-10-30T08:00:00+00:00", disposition: "returned", dueCentavos: 18000, receivedCentavos: 10000, allowanceCentavos: 4000, depositCentavos: 6000, notes: "" };

function renderCard(card: CardView, options: { isOwner?: boolean; isToday?: boolean } = {}) {
  const onSaved = vi.fn();
  const onDirty = vi.fn();
  const onReload = vi.fn();
  render(<DailyCard card={card} date={date} isToday={options.isToday ?? true} isOwner={options.isOwner ?? false} freeDrivers={[]} onSaved={onSaved} onDirty={onDirty} onReload={onReload} />);
  return { onSaved, onDirty, onReload };
}

const payment = () => screen.getByLabelText("Payment received (₱)") as HTMLInputElement;
const disposition = () => screen.getByLabelText(/^Disposition/) as HTMLSelectElement;
const press = async (name: string) => { await act(async () => { fireEvent.click(screen.getByRole("button", { name })); }); };

beforeEach(() => { sessionStorage.clear(); for (const mock of Object.values(mocks)) mock.mockReset(); });
afterEach(cleanup);

describe("DailyCard: recording (feature 008, User Story 1)", () => {
  it("updates the due as soon as the disposition changes (FR-019)", () => {
    renderCard(unrecorded);
    expect(screen.getByText("₱180.00")).toBeInTheDocument();
    fireEvent.change(disposition(), { target: { value: "overnight_overtime" } });
    expect(screen.getByText("₱300.00")).toBeInTheDocument();
  });

  it("saves the card with the payment in centavos and reports the saved record (FR-020)", async () => {
    mocks.save.mockResolvedValue({ ok: true, data: { id: saved.remittanceId, updatedAt: saved.updatedAt, receivedCentavos: 25000, depositCentavos: 21000, partial: null } });
    const { onSaved } = renderCard(unrecorded);
    fireEvent.change(disposition(), { target: { value: "overnight_overtime" } });
    fireEvent.change(payment(), { target: { value: "250" } });
    await press("Save remittance");
    expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ assignmentId: unrecorded.assignmentId, serviceDate: date, disposition: "overnight_overtime", paymentCentavos: 25000 }));
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ kind: "saved", dueCentavos: 30000, receivedCentavos: 25000, allowanceCentavos: 4000, depositCentavos: 21000 }));
  });

  it("shows a saved card locked, with its badge, the Saved label and the menu (FR-021, FR-023)", () => {
    renderCard(saved);
    expect(disposition()).toBeDisabled();
    expect(payment()).toBeDisabled();
    expect(screen.getByLabelText("Notes")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Save remittance" })).not.toBeInTheDocument();
    expect(screen.getByText("Owes ₱80.00")).toBeInTheDocument();
    expect(screen.getByText("Saved")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Card options" })).toBeInTheDocument();
    expect(screen.getByRole("article")).toHaveClass("bg-muted");
  });

  it("has no menu before saving", () => {
    renderCard(unrecorded);
    expect(screen.queryByRole("button", { name: "Card options" })).not.toBeInTheDocument();
  });

  it("keeps the entries and shows the message when a save fails (FR-029)", async () => {
    mocks.save.mockResolvedValue({ ok: false, code: "UNEXPECTED", message: "Could not save the remittance. Reload the page and try again." });
    renderCard(unrecorded);
    fireEvent.change(payment(), { target: { value: "100" } });
    await press("Save remittance");
    expect(screen.getByRole("alert")).toHaveTextContent("Could not save the remittance.");
    expect(payment().value).toBe("100");
    expect(screen.getByRole("button", { name: "Save remittance" })).toBeEnabled();
  });

  it("offers a reload when the unit was already recorded by someone else", async () => {
    mocks.save.mockResolvedValue({ ok: false, code: "DUPLICATE_REMITTANCE", message: "This unit already has a remittance for this date. Reload to see it." });
    const { onReload } = renderCard(unrecorded);
    await press("Save remittance");
    await press("Reload");
    expect(onReload).toHaveBeenCalledWith(unrecorded.key);
  });

  it("rejects an invalid amount without calling the server", async () => {
    renderCard(unrecorded);
    fireEvent.change(payment(), { target: { value: "abc" } });
    await press("Save remittance");
    expect(screen.getByRole("alert")).toHaveTextContent("Enter an amount like 180 or 180.50.");
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it("reuses the same idempotency keys when a failed save is retried (FR-028)", async () => {
    mocks.save.mockResolvedValue({ ok: false, code: "UNEXPECTED", message: "Try again." });
    renderCard(unrecorded);
    await press("Save remittance");
    await press("Save remittance");
    const [first, second] = mocks.save.mock.calls.map(([input]) => input);
    expect(second.remittanceKey).toBe(first.remittanceKey);
    expect(second.paymentKey).toBe(first.paymentKey);
  });

  it("marks a day off with no backup as not operating, with the picker for owners only (FR-014)", () => {
    const card: CardView = { key: `${date}:u2`, unitId: "u2", unitName: "ROLNET-2", bodyNumber: "T-002", kind: "no-driver", dayOffId: "00000000-0000-4000-8000-000000000099", primaryDriverName: "Maria Reyes" };
    renderCard(card);
    expect(screen.getByText("Not operating")).toBeInTheDocument();
    expect(screen.getByText("Ask the owner to assign a backup driver.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save remittance" })).not.toBeInTheDocument();
    cleanup();
    renderCard(card, { isOwner: true });
    expect(screen.getByRole("button", { name: "Assign driver" })).toBeInTheDocument();
  });

  it("shows a unit in repair with no fields (FR-014a)", () => {
    renderCard({ key: `${date}:u3`, unitId: "u3", unitName: "ROLNET-3", bodyNumber: "T-003", kind: "in-repair" });
    expect(screen.getByText("Not operating (in repair)")).toBeInTheDocument();
    expect(screen.queryByLabelText("Payment received (₱)")).not.toBeInTheDocument();
  });
});

async function openEdit() {
  await press("Card options");
  await act(async () => { fireEvent.click(await screen.findByRole("menuitem", { name: "Edit remittance" })); });
}

describe("DailyCard: correcting (feature 008, User Story 2)", () => {
  it("offers record details to owners only", async () => {
    renderCard(saved, { isOwner: true });
    await press("Card options");
    expect(await screen.findByRole("menuitem", { name: "View record details" })).toHaveAttribute("href", `/remittances/${saved.remittanceId}`);
    cleanup();
    renderCard(saved);
    await press("Card options");
    await screen.findByRole("menuitem", { name: "Edit remittance" });
    expect(screen.queryByRole("menuitem", { name: "View record details" })).not.toBeInTheDocument();
  });

  it("unlocks payment and notes but keeps the disposition locked (FR-026)", async () => {
    renderCard(saved, { isOwner: true });
    await openEdit();
    expect(payment()).toBeEnabled();
    expect(payment().value).toBe("100.00");
    expect(disposition()).toBeDisabled();
    expect(screen.getByText(/Disposition can't be changed after saving\. Reverse it on the record's details page/)).toBeInTheDocument();
  });

  it("restores the saved values on Cancel", async () => {
    renderCard(saved);
    await openEdit();
    fireEvent.change(payment(), { target: { value: "150" } });
    await press("Cancel");
    expect(payment().value).toBe("100.00");
    expect(payment()).toBeDisabled();
  });

  it("adds a payment when the total goes up (FR-027)", async () => {
    mocks.edit.mockResolvedValue({ ok: true, data: { updatedAt: saved.updatedAt, receivedCentavos: 18000, depositCentavos: 14000 } });
    const { onSaved } = renderCard(saved);
    await openEdit();
    fireEvent.change(payment(), { target: { value: "180" } });
    await press("Save remittance");
    expect(mocks.edit).toHaveBeenCalledWith(expect.objectContaining({ remittanceId: saved.remittanceId, targetPaymentCentavos: 18000, reason: undefined }));
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ receivedCentavos: 18000, depositCentavos: 14000 }));
  });

  it("blocks staff from lowering a recorded payment", async () => {
    renderCard(saved);
    await openEdit();
    fireEvent.change(payment(), { target: { value: "50" } });
    await press("Save remittance");
    expect(screen.getByRole("alert")).toHaveTextContent("Only the owner can lower a recorded payment.");
    expect(mocks.edit).not.toHaveBeenCalled();
  });

  it("asks the owner for a reason before lowering a payment", async () => {
    mocks.edit.mockResolvedValue({ ok: true, data: { updatedAt: saved.updatedAt, receivedCentavos: 5000, depositCentavos: 1000 } });
    renderCard(saved, { isOwner: true });
    await openEdit();
    fireEvent.change(payment(), { target: { value: "50" } });
    await press("Save remittance");
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("Lower the payment from ₱100.00 to ₱50.00?");
    expect(within(dialog).getByRole("button", { name: "Lower payment" })).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText(/Reason/), { target: { value: "Counted twice" } });
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Lower payment" })); });
    expect(mocks.edit).toHaveBeenCalledWith(expect.objectContaining({ targetPaymentCentavos: 5000, reason: "Counted twice" }));
  });

  it("confirms the first past-date edit in a session only (FR-025)", async () => {
    renderCard(saved, { isToday: false });
    await openEdit();
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("You're editing a record from Oct 30. Continue?");
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Continue" })); });
    expect(payment()).toBeEnabled();
    cleanup();
    renderCard(saved, { isToday: false });
    await openEdit();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(payment()).toBeEnabled();
  });
});

const breakdown = (term: "Allowance" | "Deposit") => screen.getByText(term, { selector: "dt" }).nextElementSibling as HTMLElement;

describe("DailyCard: Rental, Allowance and Deposit (feature 009, User Story 1)", () => {
  it("labels the figure Rental, never Due", () => {
    renderCard(unrecorded);
    expect(screen.getByText("Rental")).toBeInTheDocument();
    expect(screen.queryByText("Due")).not.toBeInTheDocument();
  });

  it("shows the allowance and a live deposit while typing (FR-010, FR-011)", () => {
    renderCard(unrecorded);
    expect(breakdown("Allowance")).toHaveTextContent("₱40.00");
    expect(breakdown("Deposit")).toHaveTextContent("−₱40.00");
    expect(breakdown("Deposit").querySelector(".text-danger")).not.toBeNull();
    for (const [typed, deposit] of [["180", "₱140.00"], ["100", "₱60.00"], ["0", "−₱40.00"]]) {
      fireEvent.change(payment(), { target: { value: typed } });
      expect(breakdown("Deposit")).toHaveTextContent(deposit);
    }
    fireEvent.change(payment(), { target: { value: "abc" } });
    expect(breakdown("Deposit")).toHaveTextContent("—");
  });

  it("follows the disposition and blocks amounts above the rental (FR-007)", async () => {
    renderCard(unrecorded);
    fireEvent.change(disposition(), { target: { value: "overnight_overtime" } });
    fireEvent.change(payment(), { target: { value: "250" } });
    expect(breakdown("Deposit")).toHaveTextContent("₱210.00");
    fireEvent.change(disposition(), { target: { value: "returned" } });
    expect(screen.getByRole("alert")).toHaveTextContent("Payment can't exceed the rental of ₱180.00");
    expect(breakdown("Deposit")).toHaveTextContent("—");
    await press("Save remittance");
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it("shows the saved figures on a locked card, and a live deposit once editing", async () => {
    renderCard({ ...saved, depositCentavos: 6000 });
    expect(breakdown("Allowance")).toHaveTextContent("₱40.00");
    expect(breakdown("Deposit")).toHaveTextContent("₱60.00");
    await openEdit();
    fireEvent.change(payment(), { target: { value: "180" } });
    expect(breakdown("Deposit")).toHaveTextContent("₱140.00");
  });

  it("never shows a Credit badge", () => {
    renderCard({ ...saved, receivedCentavos: 20000, depositCentavos: 16000 });
    expect(screen.getByText("Paid")).toBeInTheDocument();
    expect(screen.queryByText(/Credit/)).not.toBeInTheDocument();
  });

  it("lets a legacy overpaid record keep its amount while notes are edited", async () => {
    mocks.edit.mockResolvedValue({ ok: true, data: { updatedAt: saved.updatedAt, receivedCentavos: 20000, depositCentavos: 16000 } });
    renderCard({ ...saved, receivedCentavos: 20000, depositCentavos: 16000 });
    await openEdit();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Notes"), { target: { value: "checked" } });
    await press("Save remittance");
    expect(mocks.edit).toHaveBeenCalledWith(expect.objectContaining({ targetPaymentCentavos: 20000, notes: "checked" }));
  });
});
