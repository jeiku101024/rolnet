import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { AssignmentCard as Card } from "@/lib/units/assignment-board";

const mocks = vi.hoisted(() => ({ save: vi.fn(), refresh: vi.fn(), push: vi.fn() }));
vi.mock("@/app/actions/unit-assignments", () => ({ saveUnitAssignment: mocks.save }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh, push: mocks.push }) }));

import { AssignmentCard } from "@/components/units/assignment-card";
import { TooltipProvider } from "@/components/ui/tooltip";

const today = "2026-11-01";
const options = [{ id: "00000000-0000-4000-8000-000000000011", label: "Ana (Primary)" }, { id: "00000000-0000-4000-8000-000000000012", label: "Ben (Backup)" }];
const base = { key: `${today}:u1`, unitId: "00000000-0000-4000-8000-000000000001", unitName: "ROLNET-1", subheader: "T-001 · ABC-1234 · Honda TMX", options };
const open: Card = { ...base, kind: "open", prefillDriverId: null };
const saved: Card = { ...base, kind: "saved", assignmentId: "a1", driverId: options[0].id, driverLabel: "Ana (Primary)", notes: "early", updatedAt: "2026-11-01T07:00:00+00:00" };

function renderCard(card: Card, { date = today, isOwner = true } = {}) {
  render(<TooltipProvider><AssignmentCard card={card} date={date} today={today} isOwner={isOwner} /></TooltipProvider>);
}
const driverSelect = () => screen.getByLabelText(/^Assign driver/) as HTMLSelectElement;
const press = async (name: string) => { await act(async () => { fireEvent.click(screen.getByRole("button", { name })); }); };
async function openEdit() {
  await press("Card options");
  await act(async () => { fireEvent.click(await screen.findByRole("menuitem", { name: "Edit assignment" })); });
}

beforeEach(() => { sessionStorage.clear(); for (const mock of Object.values(mocks)) mock.mockReset(); });
afterEach(cleanup);

describe("AssignmentCard (feature 010, User Story 1)", () => {
  it("shows the unit name, the subheader, the driver options with roles, notes and Save", () => {
    renderCard(open);
    expect(screen.getByText("ROLNET-1")).toBeInTheDocument();
    expect(screen.getByText("T-001 · ABC-1234 · Honda TMX")).toBeInTheDocument();
    expect([...driverSelect().options].map((option) => option.text)).toEqual(["Choose a driver", "Ana (Primary)", "Ben (Backup)"]);
    expect(screen.getByLabelText("Notes")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save assignment" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Card options" })).not.toBeInTheDocument();
  });

  it("asks for a driver before saving, without calling the server (FR-017)", async () => {
    renderCard(open);
    await press("Save assignment");
    expect(screen.getByRole("alert")).toHaveTextContent("Choose a driver first");
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it("saves the driver and notes for the date, then refreshes (FR-018)", async () => {
    mocks.save.mockResolvedValue({ ok: true, data: { id: "a1", driverId: options[1].id, notes: "spare", updatedAt: "2026-11-01T08:00:00Z" } });
    renderCard(open);
    fireEvent.change(driverSelect(), { target: { value: options[1].id } });
    fireEvent.change(screen.getByLabelText("Notes"), { target: { value: "spare" } });
    await press("Save assignment");
    expect(mocks.save).toHaveBeenCalledWith({ unitId: base.unitId, serviceDate: today, driverId: options[1].id, notes: "spare", expectedUpdatedAt: undefined });
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("resets the selection when the driver was just taken (FR-016)", async () => {
    mocks.save.mockResolvedValue({ ok: false, code: "DRIVER_TAKEN", message: "Driver already assigned today" });
    renderCard(open);
    fireEvent.change(driverSelect(), { target: { value: options[0].id } });
    await press("Save assignment");
    expect(screen.getByRole("alert")).toHaveTextContent("Driver already assigned today");
    expect(driverSelect().value).toBe("");
  });

  it("locks a saved card with the Assigned badge, Saved label and a Card options menu (FR-019)", async () => {
    renderCard(saved);
    expect(driverSelect()).toBeDisabled();
    expect(screen.getByLabelText("Notes")).toBeDisabled();
    expect(screen.getByText("Assigned")).toBeInTheDocument();
    expect(screen.getByText("Saved")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save assignment" })).not.toBeInTheDocument();
    await openEdit();
    expect(driverSelect()).toBeEnabled();
    mocks.save.mockResolvedValue({ ok: true, data: { id: "a1", driverId: options[1].id, notes: "early", updatedAt: "2026-11-01T09:00:00Z" } });
    fireEvent.change(driverSelect(), { target: { value: options[1].id } });
    await press("Save assignment");
    expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ driverId: options[1].id, expectedUpdatedAt: saved.updatedAt }));
  });

  it("confirms editing a past date once per session (FR-020)", async () => {
    renderCard({ ...saved }, { date: "2026-10-30" });
    await openEdit();
    expect(await screen.findByText("You are editing an assignment from Oct 30. Continue?")).toBeInTheDocument();
    await press("Continue");
    expect(driverSelect()).toBeEnabled();
    cleanup();
    renderCard({ ...saved }, { date: "2026-10-29" });
    await openEdit();
    expect(screen.queryByText(/You are editing an assignment/)).not.toBeInTheDocument();
    expect(driverSelect()).toBeEnabled();
  });

  it("keeps a card with a remittance locked, with no menu (FR-019a)", () => {
    renderCard({ ...saved, kind: "locked" } as Card);
    expect(screen.getByText("A remittance is already recorded for this day.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Card options" })).not.toBeInTheDocument();
  });

  it("shows the pre-fill hint until the selection changes (FR-021, FR-022)", () => {
    renderCard({ ...open, prefillDriverId: options[1].id } as Card, { date: "2026-11-02" });
    expect(driverSelect().value).toBe(options[1].id);
    expect(screen.getByText("Pre-filled from previous day")).toBeInTheDocument();
    fireEvent.change(driverSelect(), { target: { value: options[0].id } });
    expect(screen.queryByText("Pre-filled from previous day")).not.toBeInTheDocument();
  });

  it("disables Save when no driver is available", () => {
    renderCard({ ...open, options: [] } as Card);
    expect(driverSelect()).toHaveTextContent("No available drivers");
    expect(screen.getByRole("button", { name: "Save assignment" })).toBeDisabled();
  });
});

describe("AssignmentCard: blocked (feature 010, User Story 4)", () => {
  const blocked: Card = { ...base, options: [], kind: "blocked", status: "in_repair" };

  it("grays out the card with the status, the message and an Open unit link for the owner (FR-026)", () => {
    renderCard(blocked);
    expect(screen.getByText("In repair")).toBeInTheDocument();
    expect(screen.getByText("Unit is in repair. Change its status on the unit page to assign a driver.")).toBeInTheDocument();
    expect(driverSelect()).toBeDisabled();
    expect(screen.getByRole("button", { name: "Save assignment" })).toBeDisabled();
    expect(screen.getByRole("link", { name: "Open unit" })).toHaveAttribute("href", `/units/${base.unitId}`);
  });

  it("has no Open unit link for staff, and words Retired units", () => {
    renderCard({ ...blocked, status: "retired" } as Card, { isOwner: false });
    expect(screen.getByText("Unit is retired. Change its status on the unit page to assign a driver.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Open unit" })).not.toBeInTheDocument();
  });
});
