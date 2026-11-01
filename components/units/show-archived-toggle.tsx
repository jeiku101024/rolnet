"use client";

import { useRouter } from "next/navigation";
import { Checkbox } from "@/components/ui/checkbox";

/** "Show archived (N)" on the Units list (feature 010, FR-004). Archived units are hidden by default. */
export function ShowArchivedToggle({ checked, count, href }: { checked: boolean; count: number; href: string }) {
  const router = useRouter();
  return <label className="inline-flex items-center gap-2 text-body-sm font-semibold text-ink">
    <Checkbox checked={checked} onCheckedChange={() => router.push(href, { scroll: false })} />
    Show archived ({count})
  </label>;
}
