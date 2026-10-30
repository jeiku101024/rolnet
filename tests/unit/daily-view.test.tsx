import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { DailyBoard } from "@/lib/remittances/daily-board";

const mocks = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("@/app/actions/remittances", () => ({ saveDailyRemittance: vi.fn(), editDailyRemittance: vi.fn() }));
vi.mock("@/app/actions/assignments", () => ({ assignBackupDriver: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => mocks }));

import { DailyView } from "@/components/remittances/daily-view";

const today = "2026-10-30";
const board: DailyBoard = {
  date: today, today, isToday: true, recorded: 0, countable: 1, receivedCentavos: 0, freeDrivers: [],
  cards: [{ key: `${today}:u1`, unitId: "u1", unitName: "ROLNET-1", bodyNumber: "T-001", kind: "unrecorded", assignmentId: "00000000-0000-4000-8000-000000000031", driver: { driverId: "d1", name: "Juan", role: "primary", coveringFor: null } }],
};

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date("2026-10-30T15:00:00Z")); // 23:00 in Manila
  mocks.push.mockReset();
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("DailyView (feature 008)", () => {
  it("shows the header count, received total and empty state", () => {
    render(<DailyView board={{ ...board, cards: [], countable: 0 }} isOwner={false} />);
    expect(screen.getByText("No units scheduled for this date.")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("0 of 0 recorded");
    expect(screen.getByRole("status")).toHaveTextContent("₱0.00 received");
  });

  it("keeps the date after midnight and offers to switch, asking first about unsaved entries (FR-030, FR-031)", async () => {
    render(<DailyView board={board} isOwner={false} />);
    fireEvent.change(screen.getByLabelText("Payment received (₱)"), { target: { value: "100" } });
    vi.setSystemTime(new Date("2026-10-30T16:01:00Z")); // 00:01 on Oct 31 in Manila
    await act(async () => { vi.advanceTimersByTime(30_000); });
    expect(screen.getByText("It's now a new day. Switch to today?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Choose date, Friday, October 30, 2026/ })).toBeInTheDocument();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Switch to today" })); });
    expect(await screen.findByRole("alertdialog")).toHaveTextContent("You have unsaved changes on 1 card. Leave without saving?");
    expect(mocks.push).not.toHaveBeenCalled();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Leave" })); });
    expect(mocks.push).toHaveBeenCalledWith("/remittances?date=2026-10-31", { scroll: false });
  });

  it("navigates straight away when nothing is unsaved", async () => {
    render(<DailyView board={board} isOwner={false} />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Previous day" })); });
    expect(mocks.push).toHaveBeenCalledWith("/remittances?date=2026-10-29", { scroll: false });
  });

  it("disables Next day on today (FR-006)", () => {
    render(<DailyView board={board} isOwner={false} />);
    expect(screen.getByRole("button", { name: "Next day" })).toBeDisabled();
  });
});
