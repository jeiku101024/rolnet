import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

const controlClass = "touch-target w-full border border-rule bg-surface px-3 text-body text-ink placeholder:text-subtle";

export function FormField({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: ReactNode }) {
  return <label className="grid gap-2 text-body-sm font-bold text-ink"><span>{label}{required ? <span aria-hidden="true" className="ml-1 text-danger">*</span> : null}</span>{children}{hint ? <span className="text-label font-normal text-muted">{hint}</span> : null}</label>;
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) { return <input {...props} className={`${controlClass} ${props.className ?? ""}`} />; }
export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) { return <select {...props} className={`${controlClass} ${props.className ?? ""}`} />; }
export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) { return <textarea {...props} className={`${controlClass} min-h-24 py-3 ${props.className ?? ""}`} />; }

export function ValidationSummary({ message }: { message?: string }) {
  if (!message) return null;
  return <p role="alert" className="border border-danger/30 bg-danger-soft p-3 text-body-sm text-danger">{message}</p>;
}
