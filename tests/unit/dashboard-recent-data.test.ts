import { describe, expect, it } from "vitest";
import { getGlimpseConfig, glimpseKinds } from "@/components/dashboard/recent-data-glimpse";

describe("dashboard recent data glimpses", () => {
  it("maps each recent-activity panel to its full list (feature 006: no units or drivers panels)", () => {
    expect(glimpseKinds).toEqual(["remittances", "expenses", "maintenance", "documents"]);
    for (const kind of glimpseKinds) {
      expect(getGlimpseConfig(kind).href).toMatch(/^\//);
      expect(getGlimpseConfig(kind).title).toBeTruthy();
    }
  });
});
