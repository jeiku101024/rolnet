import { afterEach, describe, expect, it, vi } from "vitest";
import { THEME_STORAGE_KEY, themeScript } from "@/lib/theme/theme-script";

function run(options: { stored?: string | null; prefersDark?: boolean; storageThrows?: boolean }) {
  document.documentElement.className = "";
  document.documentElement.style.colorScheme = "";
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: Boolean(options.prefersDark) && query.includes("dark"), media: query }));
  const getItem = options.storageThrows
    ? () => { throw new Error("blocked"); }
    : (key: string) => (key === THEME_STORAGE_KEY ? options.stored ?? null : null);
  vi.stubGlobal("localStorage", { getItem });
  new Function(themeScript)();
  return document.documentElement.classList.contains("dark");
}

afterEach(() => vi.unstubAllGlobals());

describe("themeScript", () => {
  it("applies a stored dark choice", () => expect(run({ stored: "dark", prefersDark: false })).toBe(true));
  it("lets a stored light choice win on a dark device", () => expect(run({ stored: "light", prefersDark: true })).toBe(false));
  it("follows the device when nothing is stored", () => {
    expect(run({ stored: null, prefersDark: true })).toBe(true);
    expect(run({ stored: null, prefersDark: false })).toBe(false);
  });
  it("tolerates blocked storage and follows the device", () => {
    expect(run({ storageThrows: true, prefersDark: true })).toBe(true);
    expect(document.documentElement.style.colorScheme).toBe("dark");
  });
});
