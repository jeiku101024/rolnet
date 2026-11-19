"use client";

import { useEffect, useRef } from "react";

/** Decorative drifting shapes behind the auth forms. Transform-only; paused while the tab is hidden. */
export function AuthBackground() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const sync = () => { node.dataset.paused = document.hidden ? "true" : "false"; };
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);
  return (
    <div ref={ref} aria-hidden="true" className="auth-background pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-canvas">
      <span className="auth-blob auth-blob-a" />
      <span className="auth-blob auth-blob-b" />
      <span className="auth-blob auth-blob-c" />
    </div>
  );
}
