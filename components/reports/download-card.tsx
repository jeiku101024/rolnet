"use client";

import { useRef, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { FormPanel } from "@/components/ui/form-panel";
import { FormFooter } from "@/components/forms/form-status";
import { useActionForm, type FormOutcome } from "@/components/forms/use-action-form";

/**
 * Feature 019 (contracts/download-overlay.md): the card inside a download overlay. It shows the fields it is given,
 * a "Download .xlsx" button with a pending label, the result or error message, and a Retry button after an error.
 * `onDownload` does the work and reports the outcome; selections are kept either way.
 */
export function DownloadCard({ children, onDownload }: { children: ReactNode; onDownload: () => Promise<FormOutcome> }) {
  const formRef = useRef<HTMLFormElement>(null);
  const { pending, status, submit } = useActionForm();
  return <FormPanel ref={formRef} className="space-y-5" onSubmit={submit(onDownload)}>
    {children}
    <FormFooter pending={pending} status={status} label="Download .xlsx" pendingLabel="Creating report…" />
    {status?.kind === "error" && !pending ? <Button type="button" variant="outline" onClick={() => formRef.current?.requestSubmit()}>Retry</Button> : null}
  </FormPanel>;
}
