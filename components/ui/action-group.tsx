import type { ReactNode } from "react";

export function ActionGroup({ children, align = "start" }: { children: ReactNode; align?: "start" | "end" }) {
  return <div className={`flex flex-wrap gap-2 ${align === "end" ? "justify-end" : ""}`}>{children}</div>;
}
