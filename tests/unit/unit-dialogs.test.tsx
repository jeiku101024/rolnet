import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";

const mocks = vi.hoisted(() => ({
  createUnit: vi.fn(), archiveUnit: vi.fn(), archiveSummary: vi.fn(), updateUnit: vi.fn(), setUnitStatus: vi.fn(), setDriverStatus: vi.fn(), upcoming: vi.fn(),
  refresh: vi.fn(), push: vi.fn(),
}));
vi.mock("@/app/actions/units", () => ({ createUnit: mocks.createUnit, archiveUnit: mocks.archiveUnit, archiveSummary: mocks.archiveSummary, updateUnit: mocks.updateUnit, setUnitStatus: mocks.setUnitStatus }));
vi.mock("@/app/actions/drivers", () => ({ setDriverStatus: mocks.setDriverStatus }));
vi.mock("@/app/actions/unit-assignments", () => ({ upcomingAssignmentCount: mocks.upcoming }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh, push: mocks.push }) }));

import { ToastProvider } from "@/components/ui/toast";
import { AddUnitDialog } from "@/components/units/add-unit-dialog";
import { ArchiveUnitDialog } from "@/components/units/archive-unit-dialog";
import { UnitDetailsSection } from "@/components/units/unit-details-section";
import { StatusSelect } from "@/components/forms/status-select";

const unitId = "00000000-0000-4000-8000-000000000001";
const withToasts = (node: ReactNode) => render(<ToastProvider>{node}</ToastProvider>);
const press = async (name: string) => { await act(async () => { fireEvent.click(screen.getByRole("button", { name })); }); };

beforeEach(() => { for (const mock of Object.values(mocks)) mock.mockReset(); });
afterEach(cleanup);

describe("AddUnitDialog (feature 010, FR-006)", () => {
  it("shows an inline error on each empty required field, without saving", async () => {
    withToasts(<AddUnitDialog />);
    await press("Add a unit");
    await press("Save unit");
    for (const text of ["Enter the unit name.", "Enter the body number.", "Enter the plate number.", "Enter the motorcycle."]) expect(screen.getByText(text)).toBeInTheDocument();
    expect(mocks.createUnit).not.toHaveBeenCalled();
  });

  it("saves, closes and shows the Unit added toast", async () => {
    mocks.createUnit.mockResolvedValue({ ok: true, data: { id: unitId } });
    withToasts(<AddUnitDialog />);
    await press("Add a unit");
    fireEvent.change(screen.getByLabelText(/^Unit name/), { target: { value: "ROLNET-13" } });
    fireEvent.change(screen.getByLabelText(/^Body number/), { target: { value: "T-013" } });
    fireEvent.change(screen.getByLabelText(/^Plate number/), { target: { value: "abc-9999" } });
    fireEvent.change(screen.getByLabelText(/^Motorcycle/), { target: { value: "Honda TMX" } });
    await press("Save unit");
    expect(mocks.createUnit).toHaveBeenCalledWith({ name: "ROLNET-13", bodyNumber: "T-013", plateNumber: "ABC-9999", makeModel: "Honda TMX", status: "active" });
    expect(await screen.findByText("Unit added")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save unit" })).not.toBeInTheDocument();
  });
});

describe("ArchiveUnitDialog (feature 010, FR-033 to FR-035)", () => {
  const unit = { id: unitId, name: "ROLNET-1", updatedAt: "2026-11-01T07:00:00+00:00" };

  it("lists what is tied to the unit, with Cancel focused", async () => {
    mocks.archiveSummary.mockResolvedValue({ ok: true, data: { todayDriver: { driverId: "d1", driverName: "Ana", role: "backup" }, assignments: 8, remittances: 30, expenses: 4, documents: 2, auditEntries: 15 } });
    withToasts(<ArchiveUnitDialog unit={unit} open onOpenChange={() => {}} />);
    expect(await screen.findByText("Ana (Backup)")).toBeInTheDocument();
    expect(screen.getByText("Archive ROLNET-1?")).toBeInTheDocument();
    expect(screen.getByText(/No records are deleted\. Reports keep its data, and you can restore it anytime\./)).toBeInTheDocument();
    for (const label of ["Assignment records", "Remittances", "Expenses", "Documents", "Audit history entries"]) expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.getByText("30")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus());
  });

  it("archives with the shown version and shows the Unit archived toast", async () => {
    mocks.archiveSummary.mockResolvedValue({ ok: true, data: { todayDriver: null, assignments: 0, remittances: 0, expenses: 0, documents: 0, auditEntries: 1 } });
    mocks.archiveUnit.mockResolvedValue({ ok: true, data: { id: unitId } });
    const onOpenChange = vi.fn();
    withToasts(<ArchiveUnitDialog unit={unit} open onOpenChange={onOpenChange} />);
    expect(await screen.findByText("None")).toBeInTheDocument();
    await press("Archive unit");
    expect(mocks.archiveUnit).toHaveBeenCalledWith({ id: unitId, expectedUpdatedAt: unit.updatedAt });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(await screen.findByText("Unit archived")).toBeInTheDocument();
  });
});

describe("StatusSelect release confirmation (feature 010, FR-030, FR-029b)", () => {
  const select = () => screen.getByLabelText("Status for ROLNET-1") as HTMLSelectElement;

  it("asks before releasing assignments, and Cancel keeps the status", async () => {
    mocks.upcoming.mockResolvedValue({ ok: true, data: { count: 2 } });
    render(<StatusSelect kind="unit" id={unitId} value="active" label="Status for ROLNET-1" releaseName="ROLNET-1" />);
    await act(async () => { fireEvent.change(select(), { target: { value: "in_repair" } }); });
    expect(await screen.findByText("ROLNET-1 has driver assignments from today onward. Changing the status will release them. Continue?")).toBeInTheDocument();
    await press("Cancel");
    expect(select().value).toBe("active");
    expect(mocks.setUnitStatus).not.toHaveBeenCalled();
  });

  it("changes the status after Continue", async () => {
    mocks.upcoming.mockResolvedValue({ ok: true, data: { count: 1 } });
    mocks.setUnitStatus.mockResolvedValue({ ok: true, data: { id: unitId, status: "retired", updatedAt: "x" } });
    render(<StatusSelect kind="unit" id={unitId} value="active" label="Status for ROLNET-1" releaseName="ROLNET-1" />);
    await act(async () => { fireEvent.change(select(), { target: { value: "retired" } }); });
    await screen.findByRole("button", { name: "Continue" });
    await press("Continue");
    expect(mocks.setUnitStatus).toHaveBeenCalledWith({ id: unitId, status: "retired", expectedStatus: "active" });
  });

  it("doesn't ask when nothing would be released, or when going back to Active", async () => {
    mocks.upcoming.mockResolvedValue({ ok: true, data: { count: 0 } });
    mocks.setUnitStatus.mockResolvedValue({ ok: true, data: { id: unitId, status: "in_repair", updatedAt: "x" } });
    render(<StatusSelect kind="unit" id={unitId} value="active" label="Status for ROLNET-1" releaseName="ROLNET-1" />);
    await act(async () => { fireEvent.change(select(), { target: { value: "in_repair" } }); });
    expect(mocks.setUnitStatus).toHaveBeenCalledWith({ id: unitId, status: "in_repair", expectedStatus: "active" });
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("words the driver confirmation", async () => {
    mocks.upcoming.mockResolvedValue({ ok: true, data: { count: 3 } });
    render(<StatusSelect kind="driver" id={unitId} value="active" label="Status for Ana" releaseName="Ana" />);
    await act(async () => { fireEvent.change(screen.getByLabelText("Status for Ana"), { target: { value: "inactive" } }); });
    expect(await screen.findByText("Ana is assigned from today onward. Deactivating will release those units. Continue?")).toBeInTheDocument();
    expect(mocks.upcoming).toHaveBeenCalledWith({ driverId: unitId });
  });
});

describe("UnitDetailsSection (feature 010, FR-039, FR-040)", () => {
  const unit = { id: unitId, name: "ROLNET-1", body_number: "T-001", plate_number: "ABC-1234", make_model: "Honda TMX", current_mileage: 18240, updated_at: "2026-11-01T07:00:00+00:00" };

  it("shows the six details, with mileage as a normal field", () => {
    render(<UnitDetailsSection unit={unit} currentDriver="Ana (Primary)" canEdit />);
    for (const text of ["ROLNET-1", "T-001", "ABC-1234", "Honda TMX", "18,240 km", "Ana (Primary)"]) expect(screen.getByText(text)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Expenses" })).toHaveAttribute("href", `/expenses?unit=${unitId}`);
  });

  it("edits only the four fields inline, and Cancel reverts", async () => {
    render(<UnitDetailsSection unit={unit} currentDriver="No driver assigned today" canEdit />);
    await press("Edit details");
    expect(screen.getAllByRole("textbox")).toHaveLength(4);
    expect(screen.getByText("18,240 km")).toBeInTheDocument();
    await press("Cancel");
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
  });

  it("saves with the shown version, and shows a refusal inline", async () => {
    mocks.updateUnit.mockResolvedValue({ ok: false, code: "RULE_VIOLATION", message: "This unit is In repair. Set the unit to Active before editing its details." });
    render(<UnitDetailsSection unit={unit} currentDriver="No driver assigned today" canEdit />);
    await press("Edit details");
    fireEvent.change(screen.getByLabelText(/^Plate number/), { target: { value: "xyz-1" } });
    await press("Save details");
    expect(mocks.updateUnit).toHaveBeenCalledWith(unitId, { name: "ROLNET-1", bodyNumber: "T-001", plateNumber: "XYZ-1", makeModel: "Honda TMX", expectedUpdatedAt: unit.updated_at });
    expect(screen.getByRole("alert")).toHaveTextContent("Set the unit to Active before editing its details.");
  });
});
