"use client";

import { useRouter } from "next/navigation";
import { SegmentedToggle } from "@/components/ui/segmented-toggle";
import { unitsDailyHref, unitsListHref, type UnitsView } from "@/lib/units/view-params";

/** "List view | Daily assignment view" (feature 010, FR-001). A soft navigation; Daily opens on today (FR-009). */
export function UnitsViewToggle({ view }: { view: UnitsView }) {
  const router = useRouter();
  return <SegmentedToggle label="Units view" value={view} options={[{ value: "list", label: "List view" }, { value: "daily", label: "Daily assignment view" }]}
    onChange={(next) => router.push(next === "list" ? unitsListHref() : unitsDailyHref(), { scroll: false })} />;
}
