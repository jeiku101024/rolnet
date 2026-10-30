"use client";

import type { ReactNode } from "react";
import { AlertDialog as AlertDialogPrimitive } from "@base-ui/react/alert-dialog";
import { cn } from "@/lib/utils";

const AlertDialog = AlertDialogPrimitive.Root;
const AlertDialogClose = AlertDialogPrimitive.Close;

function AlertDialogContent({ className, title, description, children, ...props }: Omit<AlertDialogPrimitive.Popup.Props, "title"> & { title: ReactNode; description?: ReactNode }) {
  return (
    <AlertDialogPrimitive.Portal>
      <AlertDialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-ink/20" />
      <AlertDialogPrimitive.Popup
        data-slot="alert-dialog-content"
        className={cn("fixed inset-x-4 top-1/2 z-50 mx-auto grid max-w-md -translate-y-1/2 gap-4 rounded-md border border-rule bg-surface p-5 text-ink outline-none", className)}
        {...props}
      >
        <AlertDialogPrimitive.Title className="text-section-title font-bold">{title}</AlertDialogPrimitive.Title>
        {description ? <AlertDialogPrimitive.Description className="text-body-sm text-muted">{description}</AlertDialogPrimitive.Description> : null}
        {children}
      </AlertDialogPrimitive.Popup>
    </AlertDialogPrimitive.Portal>
  );
}

function AlertDialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-wrap justify-end gap-2", className)} {...props} />;
}

export { AlertDialog, AlertDialogClose, AlertDialogContent, AlertDialogFooter };
