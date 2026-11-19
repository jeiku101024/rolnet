"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

/**
 * Both cards stay mounted in a two-panel track; the path decides which one is in view, so the
 * swap is a transform (login slides out left, register enters from the right, reversed on Back)
 * and the logo and background around it never re-render.
 */
export function AuthStage({ login, register }: { login: ReactNode; register: ReactNode }) {
  const pathname = usePathname();
  const active = pathname === "/register" ? "register" : "login";
  const loginRef = useRef<HTMLDivElement>(null);
  const registerRef = useRef<HTMLDivElement>(null);
  const previous = useRef(active);
  // A card is mounted the first time its route is visited and then kept, so its typed values survive a swap and back.
  const [visited, setVisited] = useState<ReadonlySet<string>>(() => new Set([active]));
  if (!visited.has(active)) setVisited(new Set([...visited, active]));
  const [ready, setReady] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if (previous.current === active) return;
    previous.current = active;
    setAnnouncement(active === "register" ? "Register" : "Sign in");
    const panel = active === "register" ? registerRef.current : loginRef.current;
    // Next moves focus after a navigation commits, so focus the first field a moment later.
    const timer = window.setTimeout(() => panel?.querySelector<HTMLElement>("input:not([type=hidden])")?.focus({ preventScroll: true }), 60);
    return () => window.clearTimeout(timer);
  }, [active]);

  return (
    <div className="auth-viewport">
      <div className="auth-track" data-active={active} data-ready={ready}>
        <div className="auth-panel" id="login-panel" ref={loginRef} inert={active !== "login"} aria-hidden={active !== "login"}>{visited.has("login") ? login : null}</div>
        <div className="auth-panel" id="register-panel" ref={registerRef} inert={active !== "register"} aria-hidden={active !== "register"}>{visited.has("register") ? register : null}</div>
      </div>
      <p className="sr-only" role="status">{announcement}</p>
    </div>
  );
}
