import type { ComponentProps } from "react";
import { Card, CardContent } from "@/components/ui/card";

export function FormPanel({ children, className, ...props }: ComponentProps<"form">) {
  return <Card className="min-w-0"><CardContent><form {...props} className={className}>{children}</form></CardContent></Card>;
}
