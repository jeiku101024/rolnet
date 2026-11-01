"use client";

import type { ReactNode } from "react";
import { CircleCheck } from "lucide-react";
import { Toast as ToastPrimitive } from "@base-ui/react/toast";

/**
 * Short confirmations ("Unit added", "Unit archived") on Base UI's Toast (research R14): a polite live
 * region, bottom-center on phones and bottom-right from 768 px, dismissed after 4 s.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  return <ToastPrimitive.Provider timeout={4000}>
    {children}
    <ToastPrimitive.Portal>
      <ToastPrimitive.Viewport className="fixed inset-x-4 bottom-4 z-50 mx-auto grid max-w-sm gap-2 md:right-4 md:left-auto md:mx-0">
        <ToastList />
      </ToastPrimitive.Viewport>
    </ToastPrimitive.Portal>
  </ToastPrimitive.Provider>;
}

function ToastList() {
  const { toasts } = ToastPrimitive.useToastManager();
  return toasts.map((toast) => <ToastPrimitive.Root key={toast.id} toast={toast} className="flex items-center gap-2 rounded-md border border-rule bg-brand-dark px-4 py-3 text-body-sm font-semibold text-surface">
    <CircleCheck aria-hidden="true" size={16} className="shrink-0" />
    <ToastPrimitive.Title />
  </ToastPrimitive.Root>);
}

/** `toast("Unit added")` from any client component under ToastProvider. */
export function useToast() {
  const manager = ToastPrimitive.useToastManager();
  return (message: string) => { manager.add({ title: message, priority: "low" }); };
}
