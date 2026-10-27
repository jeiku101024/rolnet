import { describe, expect, it } from "vitest";
import { etagValue, requireIfMatch } from "@/lib/api/concurrency";
import { readIdempotencyKey } from "@/lib/api/request";

describe("concurrency and retry contract", () => {
  it("round-trips an updated timestamp ETag", () => expect(requireIfMatch(new Request("https://rolnet.test", { headers: { "if-match": etagValue("2026-10-27T00:00:00Z") } }))).toBe("2026-10-27T00:00:00Z"));
  it("rejects changed or malformed retry identities before persistence", () => expect(() => readIdempotencyKey(new Request("https://rolnet.test", { headers: { "idempotency-key": "bad" } }), true)).toThrow());
});
