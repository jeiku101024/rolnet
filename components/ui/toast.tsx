"use client";

import type { ReactNode } from "react";
import { CircleCheck } from "lucide-react";
import { Toast as ToastPrimitive } from "@base-ui/react/toast";

/**
 * Short confirmations ("Unit added", "Unit archived") on Base UI's Toast (research R14): a polite live
 * region, bottom-center on phones and bottom-right from 768 px, dismissed after 4 s. A toast can carry
 * one action, such as "Undo" (feature 012, research R10), and its own timeout.
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
    <ToastPrimitive.Title className="min-w-0 flex-1" />
    {toast.actionProps ? <ToastPrimitive.Action className="touch-target -my-2 shrink-0 rounded-sm px-2 text-body-sm font-bold text-surface underline underline-offset-2 hover:bg-surface/10" /> : null}
  </ToastPrimitive.Root>);
}

export interface ToastOptions {
  /** One button on the toast, e.g. `{ label: "Undo", onClick }`. Clicking it also closes the toast. */
  action?: { label: string; onClick: () => void };
  /** Milliseconds before the toast closes; defaults to the provider's 4000. */
  timeout?: number;
}

/** `toast("Unit added")` or `toast("Pedro marked as Backup", { action: { label: "Undo", onClick }, timeout: 5000 })`. */
export function useToast() {
  const manager = ToastPrimitive.useToastManager();
  return (message: string, options: ToastOptions = {}) => {
    const id = manager.add({
      title: message,
      priority: "low",
      ...(options.timeout ? { timeout: options.timeout } : {}),
      ...(options.action ? { actionProps: { children: options.action.label, onClick: () => { options.action?.onClick(); manager.close(id); } } } : {}),
    });
  };
}
