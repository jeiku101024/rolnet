"use client";

import { useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { SearchParams } from "@/lib/pagination/list-page";
import type { SfView } from "@/lib/sinking-fund/types";
import { viewHref } from "@/lib/sinking-fund/url-state";

const options: { value: SfView; label: string }[] = [
  { value: "transactions", label: "Transactions" },
  { value: "top", label: "Top participants" },
  { value: "participants", label: "Participants" },
];

/** "Transactions | Top participants | Participants". A soft navigation, so the page does not reload and links stay shareable. */
export function ViewToggle({ view, searchParams }: { view: SfView; searchParams: SearchParams }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  return <div aria-busy={pending}>
    <ToggleGroup aria-label="Sinking fund views" className="flex w-full sm:inline-flex sm:w-auto" value={[view]}
      onValueChange={(next) => { const picked = next.find((item) => item !== view) as SfView | undefined; if (picked) startTransition(() => router.replace(viewHref(pathname, searchParams, picked), { scroll: false })); }}>
      {options.map((option) => <ToggleGroupItem key={option.value} value={option.value} className="flex-1 px-2 text-center leading-tight sm:flex-none sm:px-4">{option.label}</ToggleGroupItem>)}
    </ToggleGroup>
  </div>;
}
