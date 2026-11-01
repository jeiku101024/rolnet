"use client";

import { Check } from "lucide-react";
import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";
import { cn } from "@/lib/utils";

/** A checkbox (base-nova on Base UI). Wrap it in a <label> with its text so the whole row toggles it. */
function Checkbox({ className, ...props }: CheckboxPrimitive.Root.Props) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn("inline-flex size-5 shrink-0 items-center justify-center rounded-sm border border-control-border bg-surface text-surface outline-none focus-visible:ring-2 focus-visible:ring-brand data-checked:border-brand-dark data-checked:bg-brand-dark", className)}
      {...props}
    >
      <CheckboxPrimitive.Indicator><Check aria-hidden="true" size={14} /></CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
