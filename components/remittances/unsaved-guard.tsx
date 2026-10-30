"use client";

import { createContext, useContext, useMemo, useRef, type ReactNode } from "react";

// Feature 008 (FR-031): lets controls outside Daily view (the view toggle in the page header) ask
// Daily view before leaving, so unsaved card entries are never dropped without a warning.

type Guard = (go: () => void) => void;
const GuardContext = createContext<{ setGuard: (guard: Guard | null) => void; guarded: (go: () => void) => void }>({ setGuard: () => {}, guarded: (go) => go() });

export function UnsavedGuardProvider({ children }: { children: ReactNode }) {
  const guard = useRef<Guard | null>(null);
  const value = useMemo(() => ({
    setGuard: (next: Guard | null) => { guard.current = next; },
    guarded: (go: () => void) => (guard.current ? guard.current(go) : go()),
  }), []);
  return <GuardContext.Provider value={value}>{children}</GuardContext.Provider>;
}

export function useUnsavedGuard() {
  return useContext(GuardContext);
}
