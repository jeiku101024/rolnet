"use client";

import Link from "next/link";
import { BookOpenText, LogIn, UserPlus } from "lucide-react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const publicItems = [
  { href: "/", label: "Ledger", icon: BookOpenText },
  { href: "/login", label: "Sign in", icon: LogIn },
  { href: "/register", label: "Register", icon: UserPlus },
] as const;

export function PublicNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Public navigation" className="flex min-w-0 flex-wrap items-center justify-end gap-1 sm:gap-2">
      {publicItems.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href;
        return (
          <Link
            aria-current={active ? "page" : undefined}
            className={cn(
              "touch-target inline-flex items-center gap-1.5 rounded-md px-2 text-label font-bold text-muted hover:bg-brand-soft hover:text-ink sm:px-3",
              active && "bg-brand-soft text-brand-dark",
            )}
            href={item.href}
            key={item.href}
          >
            <Icon aria-hidden="true" className="size-4 shrink-0" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
