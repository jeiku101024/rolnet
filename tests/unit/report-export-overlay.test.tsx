import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DownloadReportButton } from "@/components/reports/download-report-button";
import { ReportExportForm } from "@/components/forms/report-export-form";
import { defaultPeriods } from "@/lib/reports/periods";

afterEach(cleanup);

describe("Remittances download overlay (feature 019)", () => {
  it("opens on Monthly, the current month and year, and All units", async () => {
    const now = defaultPeriods();
    render(<DownloadReportButton title="Download report"><ReportExportForm years={[now.year, now.year - 1]} /></DownloadReportButton>);
    fireEvent.click(screen.getByRole("button", { name: "Download report" }));
    await screen.findByRole("dialog");
    expect((screen.getByLabelText(/Month/) as HTMLSelectElement).value).toBe(now.month.slice(5, 7));
    expect((screen.getByLabelText(/Year/) as HTMLSelectElement).value).toBe(String(now.year));
    expect((screen.getByLabelText("Scope") as HTMLSelectElement).value).toBe("all");
    expect(screen.getByRole("button", { name: "Download .xlsx" })).toBeTruthy();
  });
});
