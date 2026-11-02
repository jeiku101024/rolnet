"use client";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DocumentForm, type UploadPreset, type UploadSaved, type UploadScope } from "@/components/forms/document-form";
import type { PageDriver, PageUnit } from "@/lib/documents/page-query";

/** "Upload document" in a modal, opened by either pane, an empty folder, or Renew (feature 013, FR-030). */
export function UploadDocumentDialog({ open, scope, preset, units, drivers, currentByKey, onClose, onSaved }: {
  open: boolean;
  scope: UploadScope;
  preset?: UploadPreset;
  units: PageUnit[];
  drivers: PageDriver[];
  currentByKey: Record<string, string>;
  onClose: () => void;
  onSaved: (saved: UploadSaved) => void;
}) {
  return <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
    <DialogContent title="Upload document">
      {open ? <DocumentForm key={`${scope}:${preset?.documentType ?? ""}:${preset?.unitId ?? preset?.driverId ?? ""}`} scope={scope} preset={preset} units={units} drivers={drivers}
        currentByKey={currentByKey} onCancel={onClose} onSaved={onSaved} /> : null}
    </DialogContent>
  </Dialog>;
}
