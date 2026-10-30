"use client";

import { useRouter } from "next/navigation";
import { SegmentedToggle } from "@/components/ui/segmented-toggle";
import { useUnsavedGuard } from "@/components/remittances/unsaved-guard";
import { dailyHref, listViewHref, type RemittancesView } from "@/lib/remittances/view-params";

/** "List view | Daily view" (feature 008, FR-001). Switching is a soft navigation; Daily view opens on today (FR-004). */
export function ViewToggle({ view }: { view: RemittancesView }) {
  const router = useRouter();
  const { guarded } = useUnsavedGuard();
  return <SegmentedToggle label="Remittances view" value={view} options={[{ value: "list", label: "List view" }, { value: "daily", label: "Daily view" }]}
    onChange={(next) => guarded(() => router.push(next === "list" ? listViewHref() : dailyHref(), { scroll: false }))} />;
}
