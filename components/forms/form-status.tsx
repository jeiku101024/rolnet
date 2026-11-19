import type { ComponentProps } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ValidationSummary } from "@/components/ui/form-field";
import type { FormStatus } from "@/components/forms/use-action-form";

export function FormStatusMessage({ status }: { status: FormStatus }) {
  if (!status) return null;
  if (status.kind === "error") return <ValidationSummary message={status.message} />;
  return <p role="status" className="status-in text-body-sm text-ok">{status.message}</p>;
}

/** "Saving…" with a small spinner, for buttons that manage their own pending state. */
export function SavingLabel({ label = "Saving…" }: { label?: string }) {
  return <><Loader2 aria-hidden="true" className="size-4 animate-spin" />{label}</>;
}

/** Submit button that is disabled while the form is saving, so a double tap sends one request. */
export function SubmitButton({ pending, pendingLabel = "Saving…", children, ...props }: ComponentProps<typeof Button> & { pending: boolean; pendingLabel?: string }) {
  return <Button type="submit" disabled={pending} aria-busy={pending || undefined} {...props}>{pending ? <SavingLabel label={pendingLabel} /> : children}</Button>;
}

/** Footer row used by every form: the submit button followed by the save result. */
export function FormFooter({ pending, status, label, pendingLabel }: { pending: boolean; status: FormStatus; label: string; pendingLabel?: string }) {
  return <div className="flex flex-wrap items-center gap-3"><SubmitButton pending={pending} pendingLabel={pendingLabel}>{label}</SubmitButton><FormStatusMessage status={status} /></div>;
}
