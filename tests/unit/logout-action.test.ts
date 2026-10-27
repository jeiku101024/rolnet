import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assertSameOrigin: vi.fn(),
  redirect: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/auth/same-origin", () => ({ assertSameOrigin: mocks.assertSameOrigin }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({ auth: { signOut: mocks.signOut } })),
}));
vi.mock("@/lib/demo/mode", () => ({
  demoMode: false,
  demoMasterEmail: "owner@demo.local",
  demoMasterPassword: "demo1234",
}));

import { signOut } from "@/app/actions/auth";

describe("signOut", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.assertSameOrigin.mockResolvedValue(undefined);
    mocks.redirect.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });
  });

  it("redirects only after the provider confirms sign out", async () => {
    mocks.signOut.mockResolvedValue({ error: null });
    await expect(signOut()).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.redirect).toHaveBeenCalledWith("/login");
  });

  it("treats an already-expired session as signed out", async () => {
    mocks.signOut.mockResolvedValue({ error: { code: "session_not_found", message: "Auth session missing!" } });
    await expect(signOut()).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.redirect).toHaveBeenCalledWith("/login");
  });

  it("returns a truthful retryable failure for provider errors", async () => {
    mocks.signOut.mockResolvedValue({ error: { code: "network_error", message: "Network unavailable" } });
    await expect(signOut()).resolves.toEqual({
      ok: false,
      code: "SIGN_OUT_FAILED",
      message: "We could not log you out. Your session may still be active. Try again.",
    });
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("enforces same-origin protection before contacting the provider", async () => {
    mocks.assertSameOrigin.mockRejectedValue(new Error("Cross-origin mutation rejected"));
    await expect(signOut()).resolves.toMatchObject({ ok: false, code: "SIGN_OUT_FAILED" });
    expect(mocks.signOut).not.toHaveBeenCalled();
  });
});
