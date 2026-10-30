import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MonthCalendar } from "@/components/ui/month-calendar";

afterEach(cleanup);

const day = (name: string) => screen.getByRole("button", { name });

describe("MonthCalendar (feature 008, FR-006, FR-007)", () => {
  it("shows the month as a labelled grid with the value selected", () => {
    render(<MonthCalendar value="2026-10-28" max="2026-10-30" onSelect={() => {}} />);
    expect(screen.getByRole("grid", { name: "October 2026" })).toBeInTheDocument();
    expect(day("Wednesday, October 28, 2026").closest("td")).toHaveAttribute("aria-selected", "true");
  });

  it("moves between months and blocks months after the max", () => {
    render(<MonthCalendar value="2026-10-28" max="2026-10-30" onSelect={() => {}} />);
    expect(screen.getByRole("button", { name: "Next month" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Previous month" }));
    expect(screen.getByRole("grid", { name: "September 2026" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next month" })).toBeEnabled();
  });

  it("can't pick a day after the max", () => {
    const onSelect = vi.fn();
    render(<MonthCalendar value="2026-10-28" max="2026-10-30" onSelect={onSelect} />);
    const future = day("Saturday, October 31, 2026");
    expect(future).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(future);
    expect(onSelect).not.toHaveBeenCalled();
    fireEvent.click(day("Tuesday, October 27, 2026"));
    expect(onSelect).toHaveBeenCalledWith("2026-10-27");
  });

  it("moves focus with the keyboard", async () => {
    render(<MonthCalendar value="2026-10-28" max="2026-10-30" onSelect={() => {}} />);
    const start = day("Wednesday, October 28, 2026");
    expect(start).toHaveAttribute("tabindex", "0");
    start.focus();
    await act(async () => { fireEvent.keyDown(start, { key: "ArrowLeft" }); });
    expect(document.activeElement).toBe(day("Tuesday, October 27, 2026"));
    await act(async () => { fireEvent.keyDown(document.activeElement!, { key: "ArrowUp" }); });
    expect(document.activeElement).toBe(day("Tuesday, October 20, 2026"));
    await act(async () => { fireEvent.keyDown(document.activeElement!, { key: "Home" }); });
    expect(document.activeElement).toBe(day("Sunday, October 18, 2026"));
    await act(async () => { fireEvent.keyDown(document.activeElement!, { key: "PageUp" }); });
    expect(screen.getByRole("grid", { name: "September 2026" })).toBeInTheDocument();
    expect(document.activeElement).toBe(day("Friday, September 18, 2026"));
  });
});
