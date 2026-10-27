import { describe, expect, it } from "vitest";
import { parsePage } from "@/lib/api/pagination";
import { assertSameOrigin, readIdempotencyKey } from "@/lib/api/request";
import { requireIfMatch } from "@/lib/api/concurrency";

describe("API foundation", () => {
  it("enforces deterministic pagination bounds", () => {
    expect(parsePage(new URL("https://rolnet.test/api/v1/units?page=2&pageSize=25"), ["id"]).from).toBe(25);
    expect(() => parsePage(new URL("https://rolnet.test/api/v1/units?pageSize=101"), ["id"])).toThrow();
  });
  it("requires same-origin unsafe requests", () => {
    expect(() => assertSameOrigin(new Request("https://rolnet.test/api/v1/units", { method: "POST" }))).toThrow();
  });
  it("validates retry and concurrency headers", () => {
    expect(readIdempotencyKey(new Request("https://rolnet.test", { headers: { "idempotency-key": "00000000-0000-4000-8000-000000000001" } }), true)).toBeTruthy();
    expect(() => requireIfMatch(new Request("https://rolnet.test"))).toThrow();
  });
});
