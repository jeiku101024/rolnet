"use client";

import { useId, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronsUpDown, X } from "lucide-react";
import type { ActionResult } from "@/lib/actions/result";
import { clientErrorMessage } from "@/components/forms/use-action-form";
import { useToast } from "@/components/ui/toast";
import { Input } from "@/components/ui/form-field";
import { parseCentavos } from "@/lib/money/centavos";

/** Shared pieces of the Sinking fund dialogs: submit handling, amount fields, and a searchable select. */

/** The form field a server message belongs to, so it can be shown beside that field. */
export function fieldForMessage(message: string): string | undefined {
  if (/^A participant named/i.test(message)) return "name";
  if (/Loans must be in steps|Loan cannot be higher|Payment cannot be higher|Withdrawal cannot be higher|amount greater than/i.test(message)) return "amount";
  if (/Interest part must be/i.test(message)) return "interest";
  if (/Payment date cannot|date cannot be in the future|Choose a date/i.test(message)) return "date";
  if (/only had/i.test(message)) return "amount";
  return undefined;
}

export type FieldErrors = Record<string, string | undefined>;

/**
 * One save at a time with a single idempotency key per opening (a retry after a dropped connection returns
 * the record already saved). Success closes the dialog, shows the toast, and refreshes the page data.
 */
export function useSfSubmit(onDone: () => void) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string | undefined>();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [key] = useState(() => crypto.randomUUID());

  async function submit<T>(action: () => Promise<ActionResult<T>>, message: (data: T) => string) {
    if (pending) return;
    setPending(true);
    setFailure(undefined);
    setFieldErrors({});
    try {
      const result = await action();
      if (!result.ok) {
        const field = fieldForMessage(result.message);
        if (field) setFieldErrors({ [field]: result.message });
        else setFailure(result.message);
        return;
      }
      onDone();
      toast(message(result.data));
      router.refresh();
    } catch (reason) {
      setFailure(clientErrorMessage(reason));
    } finally {
      setPending(false);
    }
  }

  return { pending, failure, setFailure, fieldErrors, setFieldErrors, key, submit, reload: () => { router.refresh(); onDone(); } };
}

/** Parses a typed peso amount into centavos, or says why not. An empty box is "empty" so required errors can be shown on submit. */
export function readAmount(text: string): { centavos: number | null; error?: string } {
  if (!text.trim()) return { centavos: null };
  try { return { centavos: parseCentavos(text) }; } catch (reason) { return { centavos: null, error: reason instanceof Error ? reason.message : "Enter a peso amount." }; }
}

export function FieldError({ id, message }: { id?: string; message?: string }) {
  if (!message) return null;
  return <p id={id} role="alert" className="text-body-sm text-danger">{message}</p>;
}

/** A labelled field with its error and hint, wired for screen readers (the shared FormField wraps only a bare label). */
export function Field({ label, required, hint, error, htmlFor, children }: { label: string; required?: boolean; hint?: ReactNode; error?: string; htmlFor: string; children: ReactNode }) {
  return <div className="grid min-w-0 gap-2 text-sm font-medium text-ink">
    <label htmlFor={htmlFor}>{label}{required ? <span aria-hidden="true" className="ml-1 text-danger">*</span> : null}</label>
    {children}
    {hint ? <div className="text-xs font-normal text-muted">{hint}</div> : null}
    <FieldError id={`${htmlFor}-error`} message={error} />
  </div>;
}

export function AmountInput({ id, value, onChange, step, invalid, describedBy }: { id: string; value: string; onChange: (value: string) => void; step?: number; invalid?: boolean; describedBy?: string }) {
  return <Input
    id={id}
    value={value}
    onChange={(event) => onChange(event.target.value)}
    inputMode="decimal"
    autoComplete="off"
    placeholder="0.00"
    aria-invalid={invalid || undefined}
    aria-describedby={describedBy}
    onKeyDown={step ? (event) => {
      // Loans move in ₱100 steps with the arrow keys.
      if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
      event.preventDefault();
      const current = readAmount(value).centavos ?? 0;
      const next = Math.max(0, current + (event.key === "ArrowUp" ? step : -step));
      onChange(next === 0 ? "" : String(next / 100));
    } : undefined}
  />;
}

export type SelectOption = { id: string; label: string; hint?: string };

/**
 * A searchable single choice: type to narrow the list, pick with the mouse or keyboard (Arrow keys and Enter).
 * Built on the app's Input so it looks like the other fields; no new component library.
 */
export function SearchableSelect({ id, label, options, value, onChange, placeholder = "Search…", disabled, error, clearLabel }: {
  id: string; label: string; options: SelectOption[]; value: string | null; onChange: (value: string | null) => void;
  placeholder?: string; disabled?: boolean; error?: string; clearLabel?: string;
}) {
  const listId = useId();
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const selected = options.find((option) => option.id === value);
  const matches = useMemo(() => {
    const needle = text.trim().toLowerCase();
    return options.filter((option) => !needle || `${option.label} ${option.hint ?? ""}`.toLowerCase().includes(needle)).slice(0, 50);
  }, [options, text]);

  function pick(option: SelectOption) {
    onChange(option.id);
    setText("");
    setOpen(false);
  }

  return <div className="relative grid gap-1">
    <div className="relative">
      <Input
        id={id}
        role="combobox"
        aria-label={label}
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        autoComplete="off"
        disabled={disabled}
        placeholder={selected ? selected.label : placeholder}
        className={selected && !open && !text ? "placeholder:text-ink" : undefined}
        value={text}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onChange={(event) => { setText(event.target.value); setActive(0); setOpen(true); }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") { event.preventDefault(); setOpen(true); setActive((index) => Math.min(index + 1, matches.length - 1)); }
          else if (event.key === "ArrowUp") { event.preventDefault(); setActive((index) => Math.max(index - 1, 0)); }
          else if (event.key === "Enter" && open && matches[active]) { event.preventDefault(); pick(matches[active]); }
          else if (event.key === "Escape" && open) { event.stopPropagation(); setOpen(false); }
        }}
      />
      <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted">{selected && clearLabel ? null : <ChevronsUpDown aria-hidden="true" size={16} />}</span>
    </div>
    {selected && clearLabel ? <button type="button" className="touch-target inline-flex w-fit items-center gap-1 text-body-sm font-semibold text-muted underline hover:text-ink" onClick={() => { onChange(null); setText(""); }}><X aria-hidden="true" size={14} />{clearLabel}</button> : null}
    {open && !disabled ? <ul id={listId} role="listbox" aria-label={label} className="absolute top-full left-0 z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-rule bg-surface p-1 text-body-sm shadow-sm">
      {matches.length ? matches.map((option, index) => <li key={option.id} role="option" aria-selected={option.id === value}
        className={`touch-target flex cursor-default items-center justify-between gap-2 rounded-sm px-3 ${index === active ? "bg-brand-soft" : ""}`}
        onMouseDown={(event) => { event.preventDefault(); pick(option); }} onMouseEnter={() => setActive(index)}>
        <span className="min-w-0 truncate">{option.label}{option.hint ? <span className="ml-2 text-muted">{option.hint}</span> : null}</span>
        {option.id === value ? <Check aria-hidden="true" size={14} /> : null}
      </li>) : <li className="px-3 py-2 text-muted" role="presentation">No matches</li>}
    </ul> : null}
  </div>;
}
