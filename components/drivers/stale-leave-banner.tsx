"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { TriangleAlert, X } from "lucide-react";

const storageKey = "rolnet:stale-banner-dismissed";
const changeEvent = "rolnet:stale-banner";

function subscribe(onChange: () => void) {
  window.addEventListener(changeEvent, onChange);
  return () => window.removeEventListener(changeEvent, onChange);
}
const readDismissed = () => sessionStorage.getItem(storageKey) === "1";
// Hidden during server rendering, so a dismissed banner doesn't flash on load.
const serverDismissed = () => true;

/**
 * "N drivers have been on open-ended leave for 14 days or more." (feature 012, FR-053). "Show them"
 * filters the list; the X hides the banner for this browser session only.
 */
export function StaleLeaveBanner({ text, tone, showHref }: { text: string; tone: "warning" | "danger"; showHref: string }) {
  const dismissed = useSyncExternalStore(subscribe, readDismissed, serverDismissed);
  if (dismissed) return null;
  const toneClass = tone === "danger" ? "bg-danger-soft text-danger" : "bg-warn-soft text-warn";
  return <div role="status" className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-current/15 px-3 py-2 text-body-sm ${toneClass}`}>
    <TriangleAlert aria-hidden="true" size={16} className="shrink-0" />
    <p className="min-w-0 flex-1 font-semibold">{text}</p>
    <Link href={showHref} className="touch-target inline-flex items-center rounded-sm px-2 font-bold underline underline-offset-2">Show them</Link>
    <button type="button" aria-label="Dismiss" className="touch-target inline-flex w-11 items-center justify-center rounded-sm hover:bg-surface/60" onClick={() => { sessionStorage.setItem(storageKey, "1"); window.dispatchEvent(new Event(changeEvent)); }}>
      <X aria-hidden="true" size={16} />
    </button>
  </div>;
}
