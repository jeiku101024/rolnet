"use client";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

/** A two-or-more option segmented control: exactly one option is pressed, and pressing another calls onChange. */
export function SegmentedToggle<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (value: T) => void }) {
  return <ToggleGroup aria-label={label} value={[value]} onValueChange={(next) => { const picked = next.find((item) => item !== value) as T | undefined; if (picked) onChange(picked); }}>
    {options.map((option) => <ToggleGroupItem key={option.value} value={option.value}>{option.label}</ToggleGroupItem>)}
  </ToggleGroup>;
}
