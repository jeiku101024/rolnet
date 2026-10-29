const CENTAVOS_PER_PESO = 100;
// Largest peso amount accepted from a form (₱9,999,999.99): well inside Number.MAX_SAFE_INTEGER.
const MAX_CENTAVOS = 999_999_999;

export function parseCentavos(value: string | number) {
  const normalized = String(value).replace(/[₱,\s]/g, "").trim();
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) throw new Error("Enter a peso amount such as 180 or 180.50.");
  const [pesos, fraction = ""] = normalized.split(".");
  const centavos = Number.parseInt(pesos, 10) * CENTAVOS_PER_PESO + Number.parseInt(fraction.padEnd(2, "0") || "0", 10);
  if (centavos > MAX_CENTAVOS) throw new Error("This amount is too large. Check the number of digits.");
  return centavos;
}

/** Same as parseCentavos, but ₱0.00 is rejected (expenses and payments must be more than zero). */
export function parsePositiveCentavos(value: string | number) {
  const centavos = parseCentavos(value);
  if (centavos <= 0) throw new Error("Enter an amount greater than ₱0.00.");
  return centavos;
}

export function formatPesos(centavos: number | bigint) {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(Number(centavos) / CENTAVOS_PER_PESO);
}
