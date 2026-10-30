"use client";

import { Progress as ProgressPrimitive } from "@base-ui/react/progress";
import { cn } from "@/lib/utils";

function Progress({ className, value, ...props }: ProgressPrimitive.Root.Props) {
  return (
    <ProgressPrimitive.Root data-slot="progress" value={value} className={cn("w-full", className)} {...props}>
      <ProgressPrimitive.Track className="h-1 w-full overflow-hidden rounded-sm bg-rule">
        <ProgressPrimitive.Indicator className="h-full bg-brand-dark transition-[width]" />
      </ProgressPrimitive.Track>
    </ProgressPrimitive.Root>
  );
}

export { Progress };
