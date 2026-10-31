import { formatPesos } from "@/lib/money/centavos";

/** A peso amount; negatives get a leading minus sign and the danger colour (FR-013, FR-015). */
export function MoneyText({ centavos }: { centavos: number }) {
  if (centavos < 0) return <span className="text-danger">−{formatPesos(Math.abs(centavos))}</span>;
  return <span>{formatPesos(centavos)}</span>;
}
