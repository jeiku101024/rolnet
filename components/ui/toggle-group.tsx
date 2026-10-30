"use client";

import { ToggleGroup as ToggleGroupPrimitive } from "@base-ui/react/toggle-group";
import { Toggle as TogglePrimitive } from "@base-ui/react/toggle";
import { cn } from "@/lib/utils";

function ToggleGroup({ className, ...props }: ToggleGroupPrimitive.Props) {
  return <ToggleGroupPrimitive data-slot="toggle-group" className={cn("inline-flex rounded-md border border-control-border bg-surface p-0.5", className)} {...props} />;
}

function ToggleGroupItem({ className, ...props }: TogglePrimitive.Props) {
  return <TogglePrimitive data-slot="toggle-group-item" className={cn("touch-target inline-flex items-center justify-center rounded-sm px-4 text-body-sm font-semibold text-ink hover:bg-brand-soft data-pressed:bg-brand-soft data-pressed:text-brand-dark", className)} {...props} />;
}

export { ToggleGroup, ToggleGroupItem };
