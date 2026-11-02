import { describe, expect, it } from "vitest";
import { shownFileName } from "@/lib/documents/file-label";

describe("shown file name (feature 013, research R9)", () => {
  it("uses the stored name", () => {
    expect(shownFileName({ fileName: " or-2026.pdf ", documentType: "or_cr", holderName: "ROLNET-1", createdAt: "2026-10-01T08:00:00Z" })).toBe("or-2026.pdf");
  });
  it("builds a name for rows saved before names were stored, on the Manila date", () => {
    expect(shownFileName({ fileName: null, documentType: "or_cr", holderName: "ROLNET-1", createdAt: "2026-09-30T20:00:00Z", mimeType: "application/pdf" })).toBe("OR-CR ROLNET-1 2026-10-01.pdf");
    expect(shownFileName({ documentType: "driver_license", holderName: "Juan Dela Cruz", createdAt: "2026-10-01T08:00:00Z", mimeType: "image/jpeg" })).toBe("Driver's license Juan Dela Cruz 2026-10-01.jpeg");
  });
});
