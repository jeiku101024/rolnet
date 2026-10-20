import type { ReactNode } from "react";
import Image from "next/image";
import { MobileNav } from "@/components/navigation/mobile-nav";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="border-b border-rule bg-surface">
        <div className="layout-shell flex h-16 items-center justify-between">
          <a href="/" aria-label="ROLNET home" className="touch-target inline-flex items-center">
            <Image className="logo-mark md:hidden" src="/brand/rolnet-mark.svg" alt="ROLNET" width={255} height={166} priority />
            <Image className="logo-full-header hidden md:block" src="/brand/rolnet-logo.svg" alt="ROLNET" width={300} height={225} priority />
          </a>
          <p className="hidden text-body-sm text-muted md:block">Fleet operations ledger</p>
        </div>
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
      <MobileNav />
    </div>
  );
}
