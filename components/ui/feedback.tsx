import { CircleCheck, CircleX, Info, TriangleAlert } from "lucide-react";

type FeedbackTone = "status" | "error" | "success" | "warning" | "danger" | "muted";

const toneStyles: Record<FeedbackTone, { className: string; icon: typeof Info }> = {
  status: { className: "bg-brand-soft text-brand-dark", icon: Info },
  muted: { className: "bg-canvas text-muted", icon: Info },
  success: { className: "bg-ok-soft text-ok", icon: CircleCheck },
  warning: { className: "bg-warn-soft text-warn", icon: TriangleAlert },
  error: { className: "bg-danger-soft text-danger", icon: CircleX },
  danger: { className: "bg-danger-soft text-danger", icon: CircleX },
};

export function Feedback({ message, type = "status" }: { message: string; type?: FeedbackTone }) {
  const tone = toneStyles[type];
  const Icon = tone.icon;
  return <p role={type === "error" || type === "danger" ? "alert" : "status"} className={`flex items-start gap-2 border border-current/15 p-3 text-body-sm ${tone.className}`}><Icon aria-hidden="true" size={16} className="mt-0.5 shrink-0" />{message}</p>;
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return <div className="border-y border-rule px-4 py-10 text-center"><p className="font-semibold text-ink">{title}</p>{description ? <p className="mx-auto mt-2 max-w-lg text-body-sm text-muted">{description}</p> : null}{action ? <div className="mt-5">{action}</div> : null}</div>;
}

export function StatusBadge({ label, tone = "muted" }: { label: string; tone?: "success" | "warning" | "danger" | "muted" }) {
  const Icon = tone === "success" ? CircleCheck : tone === "warning" ? TriangleAlert : tone === "danger" ? CircleX : Info;
  const styles = tone === "success" ? "bg-ok-soft text-ok" : tone === "warning" ? "bg-warn-soft text-warn" : tone === "danger" ? "bg-danger-soft text-danger" : "bg-canvas text-muted";
  return <span className={`status-badge ${styles}`}><Icon aria-hidden="true" size={14} />{label}</span>;
}
