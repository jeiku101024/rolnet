import type { ReactNode } from "react";
import { MobileNav } from "@/components/navigation/mobile-nav";

export function AppShell({ children }: { children: ReactNode }) {
  return <div className="flex min-h-screen flex-col bg-slate-50"><main className="flex flex-1 flex-col">{children}</main><MobileNav /></div>;
}
