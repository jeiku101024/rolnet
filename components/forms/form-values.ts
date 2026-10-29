// Helpers that read FormData values into the shapes the Server Actions validate.

/** Trimmed text, or undefined when the field is empty or missing. */
export function text(data: FormData, name: string) {
  const value = data.get(name);
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

/** Whole number (for example kilometres), or undefined when empty. Throws a plain message when invalid. */
export function wholeNumber(data: FormData, name: string, label: string) {
  const value = text(data, name)?.replace(/[,\s]/g, "");
  if (value === undefined) return undefined;
  if (!/^\d+$/.test(value)) throw new Error(`Enter the ${label} as a whole number, for example 18250.`);
  return Number.parseInt(value, 10);
}

/** A chosen file, or null when no file was chosen. */
export function file(data: FormData, name: string) {
  const value = data.get(name);
  return value instanceof File && value.size > 0 ? value : null;
}
