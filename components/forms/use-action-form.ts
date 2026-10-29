"use client";

import { useRef, useState, type FormEvent } from "react";
import type { ActionFailure } from "@/lib/actions/result";

export type FormStatus = { kind: "success" | "error"; message: string } | null;
/** What a submit handler reports: a success message (the form is then reset) or a failure. */
export type FormOutcome = { ok: true; message: string; keepValues?: boolean } | ActionFailure | { ok: false; message: string };

type SubmitContext = {
  form: HTMLFormElement;
  data: FormData;
  /** Idempotency key for this form instance; the same key is reused on retry until a save succeeds. */
  key: (name?: string) => string;
};

/** Message for errors thrown in the browser (for example a dropped connection). */
export function clientErrorMessage(error: unknown) {
  if (error instanceof TypeError) return "Could not reach the server. Check your connection and try again.";
  if (error instanceof Error && error.message && !/^(NEXT_|An error occurred in the Server)/.test(error.message)) return error.message;
  return "Something went wrong. Try again.";
}

/**
 * Shared submit handling for client forms (T128, T129, T133):
 * - captures the form element before any await (React clears event.currentTarget afterwards);
 * - ignores a second submit while one is pending, and exposes `pending` to disable the button;
 * - keeps one idempotency key per form instance until a save succeeds, so a retry after a
 *   timeout returns the record that was already saved instead of creating a duplicate.
 */
export function useActionForm() {
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<FormStatus>(null);
  const busy = useRef(false);
  const keys = useRef<Record<string, string>>({});

  function key(name = "default") {
    keys.current[name] ??= crypto.randomUUID();
    return keys.current[name];
  }

  function submit(handler: (context: SubmitContext) => Promise<FormOutcome>) {
    return async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (busy.current) return;
      const form = event.currentTarget;
      const data = new FormData(form);
      busy.current = true;
      setPending(true);
      setStatus(null);
      try {
        const outcome = await handler({ form, data, key });
        if (outcome.ok) {
          keys.current = {};
          if (!outcome.keepValues) form.reset();
          setStatus({ kind: "success", message: outcome.message });
        } else {
          setStatus({ kind: "error", message: outcome.message });
        }
      } catch (error) {
        setStatus({ kind: "error", message: clientErrorMessage(error) });
      } finally {
        busy.current = false;
        setPending(false);
      }
    };
  }

  return { pending, status, setStatus, submit };
}
