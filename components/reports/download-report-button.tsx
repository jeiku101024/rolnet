"use client";

import { useState, type ReactNode } from "react";
import { FileSpreadsheet } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * Feature 019 (contracts/download-overlay.md): the workbook icon button that sits at the end of a page's toolbar and
 * opens a modal overlay holding that page's download card. The card is mounted only while the overlay is open, so every
 * open starts from its defaults and a stale error is gone. The dialog supplies Escape, the Close button, outside
 * click, the focus trap and focus return to this button.
 */
export function DownloadReportButton({ label = "Download report", title = "Download report", className, children }: { label?: string; title?: string; className?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return <TooltipProvider>
    <Tooltip>
      <TooltipTrigger render={<button type="button" aria-label={label} aria-haspopup="dialog" onClick={() => setOpen(true)}
        className={cn("touch-target inline-flex w-11 shrink-0 items-center justify-center rounded-md border border-rule bg-surface text-ink hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-offset-2", className)} />}>
        <FileSpreadsheet aria-hidden="true" size={20} />
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent title={title}>{open ? children : null}</DialogContent>
    </Dialog>
  </TooltipProvider>;
}
