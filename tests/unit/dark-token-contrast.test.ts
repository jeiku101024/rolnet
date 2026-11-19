import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8").replace(/\r\n/g, "\n");

function tokens(block: string) {
  const map: Record<string, string> = {};
  for (const match of block.matchAll(/(--[a-z0-9-]+):\s*(#[0-9a-fA-F]{6});/g)) map[match[1]] = match[2].toLowerCase();
  return map;
}

const light = tokens(css.slice(css.indexOf(":root {"), css.indexOf("@media screen")));
const dark = tokens(css.slice(css.indexOf(":root.dark {"), css.indexOf("@custom-variant dark")));

function luminance(hex: string) {
  const channel = (i: number) => {
    const value = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
}

function ratio(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const get = (name: string) => dark[`--token-${name}`] ?? dark[`--${name}`];

describe("dark theme tokens", () => {
  it("defines a dark value for every colored light token", () => {
    const missing = Object.keys(light).filter((name) => name.startsWith("--token-") && !(name in dark) && !["--token-brand"].includes(name));
    expect(missing).toEqual([]);
  });

  it("keeps text at 4.5:1 or better on its surface", () => {
    const pairs: Array<[string, string]> = [
      ["ink", "canvas"], ["ink", "surface"], ["muted", "surface"], ["muted", "canvas"], ["subtle", "surface"],
      ["brand-dark", "surface"], ["brand-dark", "canvas"], ["focus", "surface"], ["ink", "brand-soft"], ["brand-dark", "brand-soft"],
      ["ok", "ok-soft"], ["warn", "warn-soft"], ["danger", "danger-soft"], ["info", "info-soft"],
      ["violet", "violet-soft"], ["orange", "orange-soft"], ["gold", "gold-soft"], ["silver", "silver-soft"], ["bronze", "bronze-soft"],
    ];
    for (const [fg, bg] of pairs) expect(ratio(get(fg), get(bg)), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps the brand fill readable with dark ink and the primary button readable", () => {
    expect(ratio("#0f1b2d", get("brand"))).toBeGreaterThanOrEqual(4.5);
    expect(ratio(get("surface"), get("brand-dark"))).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps control borders and chart colors at 3:1 on the surface", () => {
    for (const name of ["control-border", "chart-deposit", "chart-loan", "chart-payment"]) {
      expect(ratio(get(name), get("surface")), name).toBeGreaterThanOrEqual(3);
    }
  });
});
