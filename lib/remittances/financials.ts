import { formatPesos } from "@/lib/money/centavos";

/** The fixed allowance kept per remittance (₱40). The database stores it at save. */
export const ALLOWANCE_CENTAVOS = 4000;

/** Deposit = paid − allowance. It may be negative. */
export function depositFor(paidCentavos: number, allowanceCentavos = ALLOWANCE_CENTAVOS) {
  return paidCentavos - allowanceCentavos;
}

export function exceedsRental(paidCentavos: number, rentalCentavos: number) {
  return paidCentavos > rentalCentavos;
}

export function overRentalMessage(rentalCentavos: number) {
  return `Payment can't exceed the rental of ${formatPesos(rentalCentavos)}`;
}
