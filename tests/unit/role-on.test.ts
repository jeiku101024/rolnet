import { describe, expect, it } from "vitest";
import { roleOn, type RoleChange } from "@/lib/drivers/role-on";

const change = (id: string, from_role: "primary" | "backup", to_role: "primary" | "backup", changed_at: string): RoleChange =>
  ({ id, driver_id: "d1", from_role, to_role, changed_by: "u1", changed_at });

describe("roleOn (feature 012, FR-028)", () => {
  it("uses the current role when no change was logged", () => {
    expect(roleOn([], "backup", "2026-01-01")).toBe("backup");
  });

  it("uses the latest change on or before the date", () => {
    const changes = [change("c1", "primary", "backup", "2026-10-10T02:00:00Z"), change("c2", "backup", "primary", "2026-10-20T02:00:00Z")];
    expect(roleOn(changes, "primary", "2026-10-15")).toBe("backup");
    expect(roleOn(changes, "primary", "2026-10-20")).toBe("primary");
    expect(roleOn(changes, "primary", "2026-11-01")).toBe("primary");
  });

  it("uses the first change's previous role before any change", () => {
    expect(roleOn([change("c1", "primary", "backup", "2026-10-10T02:00:00Z")], "backup", "2026-10-09")).toBe("primary");
  });

  it("decides the day in the fleet time zone", () => {
    // 17:00 UTC on Oct 9 is 01:00 on Oct 10 in Manila.
    expect(roleOn([change("c1", "primary", "backup", "2026-10-09T17:00:00Z")], "backup", "2026-10-09")).toBe("primary");
    expect(roleOn([change("c1", "primary", "backup", "2026-10-09T17:00:00Z")], "backup", "2026-10-10")).toBe("backup");
  });

  it("doesn't depend on the order changes are passed in", () => {
    const changes = [change("c2", "backup", "primary", "2026-10-20T02:00:00Z"), change("c1", "primary", "backup", "2026-10-10T02:00:00Z")];
    expect(roleOn(changes, "primary", "2026-10-01")).toBe("primary");
    expect(roleOn(changes, "primary", "2026-10-12")).toBe("backup");
  });
});
