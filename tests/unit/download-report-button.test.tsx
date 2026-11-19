import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DownloadReportButton } from "@/components/reports/download-report-button";

afterEach(cleanup);

function Card() {
  return <input aria-label="Card field" defaultValue="fresh" />;
}

describe("DownloadReportButton (feature 019)", () => {
  it("has an accessible name and keeps the card out of the page until opened", () => {
    render(<DownloadReportButton><Card /></DownloadReportButton>);
    const button = screen.getByRole("button", { name: "Download report" });
    expect(button).toBeTruthy();
    expect(screen.queryByLabelText("Card field")).toBeNull();
  });

  it("uses a custom label", () => {
    render(<DownloadReportButton label="Download monthly standings" title="Monthly standings"><Card /></DownloadReportButton>);
    expect(screen.getByRole("button", { name: "Download monthly standings" })).toBeTruthy();
  });

  it("opens a dialog with the card and closes it with the Close button", async () => {
    render(<DownloadReportButton title="Download report"><Card /></DownloadReportButton>);
    fireEvent.click(screen.getByRole("button", { name: "Download report" }));
    expect(await screen.findByRole("dialog")).toBeTruthy();
    expect(screen.getByLabelText("Card field")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("closes on Escape and starts from fresh content on the next open", async () => {
    render(<DownloadReportButton><Card /></DownloadReportButton>);
    fireEvent.click(screen.getByRole("button", { name: "Download report" }));
    const field = await screen.findByLabelText("Card field") as HTMLInputElement;
    fireEvent.change(field, { target: { value: "changed" } });
    fireEvent.keyDown(field, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "Download report" }));
    expect(((await screen.findByLabelText("Card field")) as HTMLInputElement).value).toBe("fresh");
  });
});
