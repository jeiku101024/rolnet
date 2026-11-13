"use client";

import { useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { SegmentedToggle } from "@/components/ui/segmented-toggle";
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
  return <div className="overflow-x-auto" aria-busy={pending}>
    <SegmentedToggle label="Sinking fund views" value={view} options={options} onChange={(next) => startTransition(() => router.replace(viewHref(pathname, searchParams, next), { scroll: false }))} />
  </div>;
}
