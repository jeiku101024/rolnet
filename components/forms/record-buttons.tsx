"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/actions/result";
import { clientErrorMessage } from "@/components/forms/use-action-form";

/**
 * Opens a private file through a short-lived signed URL. The window is opened before the request
 * so mobile browsers do not treat it as an unrequested pop-up.
 */
export function SignedFileButton({ load, label = "View file" }: { load: () => Promise<ActionResult<{ url: string }>>; label?: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return <span className="inline-flex flex-col gap-1">
    <Button type="button" variant="outline" disabled={pending} onClick={async () => {
      setPending(true); setError("");
      const opened = window.open("", "_blank");
      try {
        const result = await load();
        if (!result.ok) { opened?.close(); setError(result.message); return; }
        if (opened) { opened.opener = null; opened.location.href = result.data.url; } else window.location.assign(result.data.url);
      } catch (reason) { opened?.close(); setError(clientErrorMessage(reason)); }
      finally { setPending(false); }
    }}>{pending ? "Opening…" : label}</Button>
    {error ? <span role="alert" className="text-body-sm text-danger">{error}</span> : null}
  </span>;
}

/** Owner-only archive (soft delete) with a confirmation step. */
export function ArchiveButton({ action, label = "Archive", confirmText, redirectTo }: { action: () => Promise<ActionResult<unknown>>; label?: string; confirmText: string; redirectTo?: string }) {
  const router = useRouter();
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return <span className="inline-flex flex-col gap-1">
    <Button type="button" variant="destructive" disabled={pending} onClick={async () => {
      if (busy.current || !window.confirm(confirmText)) return;
      busy.current = true; setPending(true); setError("");
      try {
        const result = await action();
        if (!result.ok) { setError(result.message); return; }
        if (redirectTo) router.push(redirectTo); else router.refresh();
      } catch (reason) { setError(clientErrorMessage(reason)); }
      finally { busy.current = false; setPending(false); }
    }}>{pending ? "Archiving…" : label}</Button>
    {error ? <span role="alert" className="text-body-sm text-danger">{error}</span> : null}
  </span>;
}
