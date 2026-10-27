import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { Input as ShadcnInput } from "@/components/ui/input";
import { Textarea as ShadcnTextarea } from "@/components/ui/textarea";

const controlClass = "touch-target w-full min-w-0 rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground";

export function FormField({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: ReactNode }) {
  return <label className="grid min-w-0 gap-2 text-sm font-medium text-ink"><span>{label}{required ? <span aria-hidden="true" className="ml-1 text-danger">*</span> : null}</span>{children}{hint ? <span className="text-xs font-normal text-muted">{hint}</span> : null}</label>;
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) { return <ShadcnInput {...props} className={`min-h-11 ${props.className ?? ""}`} />; }
export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) { return <select {...props} className={`${controlClass} ${props.className ?? ""}`} />; }
export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) { return <ShadcnTextarea {...props} className={`min-h-24 ${props.className ?? ""}`} />; }

export function ValidationSummary({ message }: { message?: string }) {
  if (!message) return null;
  return <p role="alert" className="border border-danger/30 bg-danger-soft p-3 text-body-sm text-danger">{message}</p>;
}
