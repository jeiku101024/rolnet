import Link from "next/link";

export function MobileNav() {
  return <nav aria-label="Primary navigation" className="grid grid-cols-3 gap-2 border-t bg-white p-3 text-center text-xs shadow-sm"><Link className="min-h-11 rounded-md p-3 hover:bg-slate-100" href="/">Home</Link><Link className="min-h-11 rounded-md p-3 hover:bg-slate-100" href="/login">Sign in</Link><Link className="min-h-11 rounded-md p-3 hover:bg-slate-100" href="/register">Register</Link></nav>;
}
