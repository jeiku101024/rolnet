import { describe, expect, it } from "vitest";
import { documentStatus, documentStatusLabels } from "@/lib/documents/status";

describe("document status (feature 013, FR-010)", () => {
  const today = "2026-11-02";
  it("is Expired before today, Due from today through 7 days ahead, and Valid after", () => {
    expect(documentStatus("2026-11-01", today)).toBe("expired");
    expect(documentStatus("2026-11-02", today)).toBe("due");
    expect(documentStatus("2026-11-09", today)).toBe("due");
    expect(documentStatus("2026-11-10", today)).toBe("valid");
  });
  it("labels the three tiers", () => {
    expect(Object.values(documentStatusLabels)).toEqual(["Expired", "Due within 7 days", "Valid"]);
  });
});
