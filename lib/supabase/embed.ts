/**
 * PostgREST returns a many-to-one embed (for example `units(body_number)` on a remittance) as a
 * single object, and a one-to-many embed as an array. Demo data and older code used arrays for
 * both, so this reads either shape (T130).
 */
export function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}
