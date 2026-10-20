import Link from "next/link";

export function MobileNav() {
  return <nav aria-label="Primary navigation" className="grid grid-cols-3 border-t border-rule bg-surface text-center text-label md:hidden"><Link className="touch-target inline-flex items-center justify-center text-brand-dark hover:bg-brand-soft" href="/">Ledger</Link><Link className="touch-target inline-flex items-center justify-center text-muted hover:bg-brand-soft" href="/login">Sign in</Link><Link className="touch-target inline-flex items-center justify-center text-muted hover:bg-brand-soft" href="/register">Register</Link></nav>;
}
