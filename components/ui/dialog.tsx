"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogClose = DialogPrimitive.Close;

/** A modal panel (base-nova dialog on Base UI): focus is trapped, Escape and the close button dismiss it. */
function DialogContent({ className, title, description, children, ...props }: Omit<DialogPrimitive.Popup.Props, "title"> & { title: ReactNode; description?: ReactNode }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-ink/20" />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        className={cn("fixed inset-x-4 top-1/2 z-50 mx-auto grid max-h-svh max-w-lg -translate-y-1/2 gap-4 overflow-y-auto rounded-md border border-rule bg-surface p-5 text-ink outline-none", className)}
        {...props}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="grid gap-1">
            <DialogPrimitive.Title className="text-section-title font-bold">{title}</DialogPrimitive.Title>
            {description ? <DialogPrimitive.Description className="text-body-sm text-muted">{description}</DialogPrimitive.Description> : null}
          </div>
          <DialogPrimitive.Close className="touch-target inline-flex w-11 shrink-0 items-center justify-center rounded-md text-muted hover:bg-brand-soft" aria-label="Close"><X aria-hidden="true" size={18} /></DialogPrimitive.Close>
        </div>
        {children}
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  );
}

export { Dialog, DialogTrigger, DialogClose, DialogContent };
