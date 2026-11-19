import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StandingsDownloadForm } from "@/components/reports/standings-download-form";
import { ExpensesDownloadForm } from "@/components/reports/expenses-download-form";
import { ReportExportForm } from "@/components/forms/report-export-form";
import { defaultPeriods } from "@/lib/reports/periods";

// Feature 019 (contracts/download-overlay.md): every card shows a pending label, an error with Retry, and keeps its
// selections. A 401 or 403 (access revoked after the page loaded) shows its plain-language message.

const now = defaultPeriods();
const years = [now.year, now.year - 1];
const cards = {
  standings: { name: "standings", element: <StandingsDownloadForm years={years} />, url: /\/api\/sinking-fund\/standings\?month=/ },
  expenses: { name: "expenses", element: <ExpensesDownloadForm years={years} />, url: /\/api\/expenses\/month\?month=/ },
  remittances: { name: "remittances", element: <ReportExportForm years={years} />, url: /\/api\/reports\/monthly\?/ },
};

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

beforeEach(() => {
  vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: () => "blob:test", revokeObjectURL: () => undefined }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe.each(Object.values(cards))("download card: $name (feature 019)", ({ element, url }) => {
  it("shows a pending label, blocks a second click, and keeps the selection", async () => {
    let release: (response: Response) => void = () => undefined;
    const fetchMock = vi.fn((input: RequestInfo | URL) => (url.test(String(input)) ? new Promise<Response>((resolve) => { release = resolve; }) : Promise.resolve(json(200, { units: [] }))));
    vi.stubGlobal("fetch", fetchMock);
    render(element);
    fireEvent.change(screen.getAllByRole("combobox").find((select) => (select as HTMLSelectElement).value === String(now.year))!, { target: { value: String(now.year - 1) } });
    const button = screen.getByRole("button", { name: "Download .xlsx" });
    fireEvent.click(button);
    await waitFor(() => expect(screen.getByRole("button", { name: /Creating report/ })).toBeTruthy());
    expect((screen.getByRole("button", { name: /Creating report/ }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /Creating report/ }));
    expect(fetchMock.mock.calls.filter(([input]) => url.test(String(input)))).toHaveLength(1);
    release(json(500, { error: { code: "UNEXPECTED", message: "The file could not be created. Try again." } }));
    await screen.findByText("The file could not be created. Try again.");
    expect(screen.getAllByRole("combobox").some((select) => (select as HTMLSelectElement).value === String(now.year - 1))).toBe(true);
  });

  it("shows the error with a Retry button that asks again with the same choices", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(500, { error: { code: "UNEXPECTED", message: "The file could not be created. Try again." } }));
    vi.stubGlobal("fetch", fetchMock);
    render(element);
    fireEvent.click(screen.getByRole("button", { name: "Download .xlsx" }));
    await screen.findByRole("button", { name: "Retry" });
    const before = fetchMock.mock.calls.filter(([input]) => url.test(String(input))).length;
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(fetchMock.mock.calls.filter(([input]) => url.test(String(input))).length).toBe(before + 1));
  });

  it("explains an ended session and a refused request in plain language", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(json(401, { error: { code: "UNAUTHENTICATED", message: "Sign in" } })).mockResolvedValue(json(403, { error: { code: "FORBIDDEN", message: "Only the owner can download this." } })));
    render(element);
    fireEvent.click(screen.getByRole("button", { name: "Download .xlsx" }));
    await screen.findByText("Your session has ended. Sign in again, then download the report.");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await screen.findByText(/Only the owner can download/);
  });
});
