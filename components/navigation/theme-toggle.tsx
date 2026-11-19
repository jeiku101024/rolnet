"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { ChevronDown, Moon, MonitorSmartphone, Sun } from "lucide-react";
import { THEME_STORAGE_KEY } from "@/lib/theme/theme-script";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

type Mode = "light" | "dark" | "device";

function readStored(): Mode {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return value === "light" || value === "dark" ? value : "device";
  } catch {
    return "device";
  }
}

function apply(dark: boolean) {
  const root = document.documentElement;
  root.classList.toggle("dark", dark);
  root.style.colorScheme = dark ? "dark" : "light";
  listeners.forEach((listener) => listener());
}

const deviceQuery = "(prefers-color-scheme: dark)";
const listeners = new Set<() => void>();
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
const subscribeNever = () => () => {};

/** Light/Dark switch plus a "Match my device" menu item that clears the saved choice. */
export function ThemeToggle() {
  const mounted = useSyncExternalStore(subscribeNever, () => true, () => false);
  const mode = useSyncExternalStore<Mode>(subscribe, readStored, () => "device");
  const dark = useSyncExternalStore(subscribe, () => document.documentElement.classList.contains("dark"), () => false);

  // While following the device, a change of the OS setting updates the page live.
  useEffect(() => {
    if (mode !== "device") return;
    const query = window.matchMedia(deviceQuery);
    const sync = () => apply(query.matches);
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, [mode]);

  const choose = useCallback((next: "light" | "dark") => {
    try { localStorage.setItem(THEME_STORAGE_KEY, next); } catch { /* storage unavailable: the choice lasts for this visit */ }
    apply(next === "dark");
  }, []);

  const followDevice = useCallback(() => {
    try { localStorage.removeItem(THEME_STORAGE_KEY); } catch { /* nothing stored */ }
    apply(window.matchMedia(deviceQuery).matches);
  }, []);

  const Icon = mounted && dark ? Sun : Moon;
  const label = mounted && dark ? "Switch to light theme" : "Switch to dark theme";

  return (
    <div className="inline-flex items-center" data-theme-mode={mounted ? mode : undefined}>
      <button
        aria-label={label}
        className="touch-target inline-flex w-11 items-center justify-center rounded-md text-muted hover:bg-brand-soft hover:text-ink"
        onClick={() => choose(dark ? "light" : "dark")}
        type="button"
      >
        <Icon aria-hidden="true" className="size-4" />
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Theme options"
          className="touch-target inline-flex w-6 items-center justify-center rounded-md text-muted hover:bg-brand-soft hover:text-ink"
        >
          <ChevronDown aria-hidden="true" className="size-3" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={followDevice}>
            <MonitorSmartphone aria-hidden="true" className="size-4" />
            <span>Match my device</span>
            {mounted && mode === "device" ? <span className="ml-auto text-label text-muted">On</span> : null}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
