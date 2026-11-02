import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

const mocks = vi.hoisted(() => ({ previewAbsence: vi.fn(), saveAbsence: vi.fn(), refresh: vi.fn() }));
vi.mock("@/app/actions/driver-absences", () => ({ previewAbsence: mocks.previewAbsence, saveAbsence: mocks.saveAbsence }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));

import { ToastProvider } from "@/components/ui/toast";
import { AbsenceDialog } from "@/components/drivers/absence-dialog";

const driver = { id: "00000000-0000-4000-8000-000000000011", name: "RA SHAA" };
const noImpact = { ok: true, data: { conflict: null, past: { assignments: 0, remittances: 0 }, release: [] } };
const press = async (name: string) => { await act(async () => { fireEvent.click(screen.getByRole("button", { name })); }); };
const open = (props: Partial<Parameters<typeof AbsenceDialog>[0]> = {}) => render(<ToastProvider><AbsenceDialog open onOpenChange={() => {}} driver={driver} {...props} /></ToastProvider>);
const fill = (label: RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

// jsdom has no PointerEvent; Base UI's checkbox dispatches one on click.
if (typeof window.PointerEvent === "undefined") (window as unknown as { PointerEvent: typeof MouseEvent }).PointerEvent = MouseEvent;

beforeEach(() => { for (const mock of Object.values(mocks)) mock.mockReset(); });
afterEach(cleanup);

describe("AbsenceDialog (feature 012, FR-037–FR-042)", () => {
  it("is titled with the driver and requires a date and a reason", async () => {
    open();
    expect(screen.getByRole("dialog", { name: "Add absence · RA SHAA" })).toBeInTheDocument();
    await press("Save absence");
    expect(screen.getByText("Choose the date.")).toBeInTheDocument();
    expect(screen.getByText("Choose a reason.")).toBeInTheDocument();
    expect(mocks.previewAbsence).not.toHaveBeenCalled();
  });

  it("needs a To date on or after From unless the leave is open-ended", async () => {
    open({ initialType: "on_leave" });
    fill(/^From/, "2026-11-10");
    fill(/^To/, "2026-11-05");
    fill(/^Reason/, "vacation");
    await press("Save absence");
    expect(screen.getByText("The To date must be on or after the From date.")).toBeInTheDocument();
    await act(async () => { fireEvent.click(screen.getByRole("checkbox")); });
    expect(screen.getByLabelText(/^To/)).toBeDisabled();
    expect(screen.getByLabelText(/^To/)).toHaveValue("");
    mocks.previewAbsence.mockResolvedValue(noImpact);
    mocks.saveAbsence.mockResolvedValue({ ok: true, data: { toast: "RA SHAA is on leave from Nov 10 (no end date)" } });
    await press("Save absence");
    expect(mocks.saveAbsence).toHaveBeenCalledWith(expect.objectContaining({ type: "on_leave", startDate: "2026-11-10", endDate: null, openEnded: true, reason: "vacation", releaseIds: [] }));
    expect(await screen.findByText("RA SHAA is on leave from Nov 10 (no end date)")).toBeInTheDocument();
  });

  it("names an overlapping absence inline and doesn't save", async () => {
    mocks.previewAbsence.mockResolvedValue({ ok: true, data: { conflict: "RA SHAA is already on leave Nov 5 to Nov 9.", past: { assignments: 0, remittances: 0 }, release: [] } });
    open();
    fill(/^Date/, "2026-11-06");
    fill(/^Reason/, "sick");
    await press("Save absence");
    expect(screen.getByText("RA SHAA is already on leave Nov 5 to Nov 9.")).toBeInTheDocument();
    expect(mocks.saveAbsence).not.toHaveBeenCalled();
  });

  it("warns about past records and asks to Save anyway", async () => {
    mocks.previewAbsence.mockResolvedValue({ ok: true, data: { conflict: null, past: { assignments: 3, remittances: 3 }, release: [] } });
    mocks.saveAbsence.mockResolvedValue({ ok: true, data: { toast: "RA SHAA is on day-off Oct 20" } });
    open();
    fill(/^Date/, "2026-10-20");
    fill(/^Reason/, "personal");
    await press("Save absence");
    expect(screen.getByText("Past dates selected. 3 assignments and 3 remittances already exist in this range. They will not be changed.")).toBeInTheDocument();
    expect(mocks.saveAbsence).not.toHaveBeenCalled();
    await press("Save anyway");
    expect(mocks.saveAbsence).toHaveBeenCalledTimes(1);
  });

  it("lists assignments to release, goes Back to the form, and saves with the confirmed list", async () => {
    mocks.previewAbsence.mockResolvedValue({ ok: true, data: { conflict: null, past: { assignments: 0, remittances: 0 }, release: [{ id: "a1", date: "2026-11-05", unitName: "Unit 3" }] } });
    mocks.saveAbsence.mockResolvedValue({ ok: true, data: { toast: "RA SHAA is on day-off Nov 5" } });
    open();
    fill(/^Date/, "2026-11-05");
    fill(/^Reason/, "sick");
    await press("Save absence");
    expect(screen.getByRole("dialog", { name: "Release assignments?" })).toBeInTheDocument();
    expect(screen.getByText("These units will be unassigned on these dates. Past records are not affected.")).toBeInTheDocument();
    expect(screen.getByText("Unit 3")).toBeInTheDocument();
    await press("Back");
    expect(screen.getByLabelText(/^Date/)).toHaveValue("2026-11-05");
    await press("Save absence");
    await press("Release and save");
    expect(mocks.saveAbsence).toHaveBeenCalledWith(expect.objectContaining({ releaseIds: ["a1"] }));
  });

  it("opens Set end date with open-ended unticked and To empty", () => {
    open({ absence: { id: "00000000-0000-4000-8000-0000000000a1", driver_id: driver.id, absence_type: "on_leave", start_date: "2026-10-15", end_date: null, reason: "personal", note: null, cancelled_at: null, ended_early_on: null, snoozed_until: null, updated_at: "2026-11-01T00:00:00Z" }, focusEnd: true });
    expect(screen.getByRole("dialog", { name: "Edit absence" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox")).not.toBeChecked();
    expect(screen.getByLabelText(/^To/)).toBeEnabled();
    expect(screen.getByLabelText(/^To/)).toHaveValue("");
  });
});
