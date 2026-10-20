const CENTAVOS_PER_PESO = 100;

export function parseCentavos(value: string | number) {
  const normalized = String(value).replace(/[₱,\s]/g, "").trim();
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) throw new Error("Enter a valid non-negative peso amount");
  const [pesos, fraction = ""] = normalized.split(".");
  return Number.parseInt(pesos, 10) * CENTAVOS_PER_PESO + Number.parseInt(fraction.padEnd(2, "0") || "0", 10);
}

export function formatPesos(centavos: number | bigint) {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(Number(centavos) / CENTAVOS_PER_PESO);
}
