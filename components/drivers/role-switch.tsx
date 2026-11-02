"use client";

import { useState, useTransition, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { setDriverRole, undoDriverRole } from "@/app/actions/drivers";
import { useToast } from "@/components/ui/toast";
import { clientErrorMessage } from "@/components/forms/use-action-form";
import { cn } from "@/lib/utils";
import type { DriverKind } from "@/types/database";

const options: { value: DriverKind; label: string }[] = [
  { value: "primary", label: "Primary" },
  { value: "backup", label: "Backup" },
];

/**
 * The profile's "Primary | Backup" switch (feature 012, FR-024–FR-027): a radio group that saves at
 * once and offers Undo for 5 seconds. The role is a label only; assignments don't change.
 */
export function RoleSwitch({ driver, disabled }: { driver: { id: string; name: string; role: DriverKind; updatedAt: string }; disabled?: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [shown, setShown] = useState<DriverKind>(driver.role);
  const [saved, setSaved] = useState(driver.role);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  // A refreshed page passes the saved role; show it instead of local state.
  if (saved !== driver.role) { setSaved(driver.role); setShown(driver.role); }

  function pick(next: DriverKind) {
    if (next === shown || pending || disabled) return;
    const previous = shown;
    setShown(next);
    setError("");
    startTransition(async () => {
      try {
        const result = await setDriverRole({ id: driver.id, role: next, expectedUpdatedAt: driver.updatedAt });
        if (!result.ok) { setShown(previous); setError(result.message); return; }
        const changeId = result.data.changeId;
        toast(`${driver.name} marked as ${next === "backup" ? "Backup" : "Primary"}`, changeId ? {
          timeout: 5000,
          action: {
            label: "Undo",
            onClick: () => {
              setShown(previous);
              void undoDriverRole({ changeId, driverId: driver.id }).then((undo) => {
                if (!undo.ok) { setShown(next); setError(undo.message); }
                router.refresh();
              });
            },
          },
        } : {});
        router.refresh();
      } catch (reason) {
        setShown(previous);
        setError(clientErrorMessage(reason));
      }
    });
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    const next = shown === "primary" ? "backup" : "primary";
    pick(next);
    (event.currentTarget.querySelector(`[data-value="${next}"]`) as HTMLElement | null)?.focus();
  }

  return <div className="relative inline-block">
    <div role="radiogroup" aria-label="Driver role" aria-disabled={disabled || undefined} onKeyDown={onKeyDown} className="inline-flex rounded-md border border-control-border bg-surface p-0.5">
      {options.map((option) => {
        const checked = shown === option.value;
        return <button key={option.value} type="button" role="radio" aria-checked={checked} data-value={option.value} tabIndex={checked ? 0 : -1} disabled={disabled}
          onClick={() => pick(option.value)}
          className={cn("touch-target inline-flex items-center justify-center rounded-sm px-4 text-body-sm font-semibold text-ink hover:bg-brand-soft disabled:opacity-60", checked && (option.value === "backup" ? "bg-brand-soft text-brand-dark" : "bg-info-soft text-info"))}>
          {option.label}
        </button>;
      })}
    </div>
    {error ? <p role="alert" className="absolute top-full right-0 z-10 mt-1 w-64 rounded-md border border-danger/30 bg-surface p-2 text-body-sm text-danger shadow-md">
      {error} <button type="button" className="font-semibold underline" onClick={() => setError("")}>Dismiss</button>
    </p> : null}
  </div>;
}
