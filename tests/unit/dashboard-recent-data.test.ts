import { describe, expect, it } from "vitest";
import { getGlimpseConfig, glimpseKinds } from "@/components/dashboard/recent-data-glimpse";

describe("dashboard recent data glimpses", () => {
  it("keeps all fleet areas mapped to a full view", () => {
    expect(glimpseKinds).toHaveLength(6);
    for (const kind of glimpseKinds) {
      expect(getGlimpseConfig(kind).href).toMatch(/^\//);
      expect(getGlimpseConfig(kind).title).toBeTruthy();
    }
  });
});
