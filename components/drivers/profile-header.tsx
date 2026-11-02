import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/**
 * The driver profile header (feature 012, FR-015): back link, eyebrow, name, contact and licence, and
 * the role switch and Status dropdown at the top right (they wrap under the name on phones).
 */
export function ProfileHeader({ name, phone, licenseNumber, controls }: { name: string; phone: string; licenseNumber: string; controls: ReactNode }) {
  return <header className="grid gap-3">
    <Link href="/drivers" className="muted-link inline-flex w-fit items-center gap-1 text-body-sm font-semibold"><ArrowLeft aria-hidden="true" size={16} />Back to drivers</Link>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-label font-bold text-brand-dark">Driver profile</p>
        <h1 className="mt-1 text-page-title font-bold leading-tight text-ink">{name}</h1>
        <p className="mt-1 text-body-sm text-muted"><span className="font-data">{phone}</span> · Licence <span className="font-data">{licenseNumber}</span></p>
      </div>
      <div className="flex flex-wrap items-center gap-2">{controls}</div>
    </div>
  </header>;
}
