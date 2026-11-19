"use client";

import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";

type MarkSaved = (recordId: string, options?: { created?: boolean }) => void;

const SaveFeedbackContext = createContext<MarkSaved>(() => {});

/** How long to keep watching for the refreshed view; a save plus the page refresh can take a few seconds. */
const WATCH_MS = 10_000;
/** The form's own state changes (closing the editor, clearing the button) land in this window; they are not the refresh. */
const LOCAL_MS = 250;
/** Fallback for an edit whose refreshed row looks identical to the old one. */
const SETTLE_MS = 3_000;
/** Length of the glow, in ms, so a replaced element can carry on from where the old one was. */
const GLOW_MS = 1_000;

function nextFrames(count: number, run: () => void) {
  if (count <= 0) return run();
  requestAnimationFrame(() => nextFrames(count - 1, run));
}

/**
 * Highlights the one row or card that was just created or changed, exactly once. The refreshed view
 * arrives a moment after the save, so the element is looked up by its `data-record-id` as the page
 * changes. Changes made by the form itself right after the click are ignored (they would flash the
 * old version); if the refresh then swaps the element, the glow moves to the new one and carries on
 * from the same point instead of starting again.
 */
export function SaveFeedbackProvider({ children }: { children: ReactNode }) {
  const markSaved = useCallback<MarkSaved>((recordId, options) => {
    const startedAt = performance.now();
    let applied: HTMLElement | null = null;
    let appliedAt = 0;
    let finished = false;
    const find = () => Array.from(document.querySelectorAll<HTMLElement>("[data-record-id]")).find((element) => element.dataset.recordId === recordId) ?? null;

    const clear = (node: HTMLElement) => {
      node.classList.remove("row-saved", "row-new");
      node.style.animationDelay = "";
    };

    const apply = (node: HTMLElement) => {
      const now = performance.now();
      const carried = applied ? Math.min(now - appliedAt, GLOW_MS - 50) : 0;
      if (applied) clear(applied);
      const created = Boolean(options?.created);
      node.classList.remove("row-saved", "row-new");
      void node.offsetWidth;
      if (carried) node.style.animationDelay = `-${Math.round(carried)}ms`;
      node.classList.add(created ? "row-new" : "row-saved");
      if (created && !applied) {
        const reduced = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        node.scrollIntoView?.({ block: "nearest", behavior: reduced ? "auto" : "smooth" });
      }
      if (!applied) appliedAt = now;
      applied = node;
      node.addEventListener("animationend", function done(event) {
        // The entrance ends first; the glow ("row-saved") is the last animation, so clean up then.
        const name = (event as AnimationEvent).animationName;
        if (event.target !== node || (name && name !== "row-saved")) return;
        clear(node);
        node.removeEventListener("animationend", done);
      });
    };

    // An edit finds the pre-refresh element straight away. Its content changes as the form closes, so
    // compare against the content after that local change, and highlight only when the refresh lands.
    const before = find();
    let settledText = before?.textContent ?? null;
    window.setTimeout(() => { settledText = find()?.textContent ?? settledText; }, LOCAL_MS);

    const check = () => {
      if (finished) return;
      const node = find();
      if (!node) return;
      if (applied) {
        // The refresh replaced the element we already lit: hand the glow over, once per replacement.
        if (node !== applied && performance.now() - appliedAt < GLOW_MS) apply(node);
        return;
      }
      // A different element is the refreshed one, so light it straight away. Only the same element needs
      // the wait, because the form's own state changes land on it first.
      if (before && node === before) {
        if (performance.now() - startedAt < LOCAL_MS) return;
        if (node.textContent === settledText) return;
      }
      apply(node);
    };

    const observer = typeof MutationObserver === "function" ? new MutationObserver(() => nextFrames(1, check)) : null;
    observer?.observe(document.body, { childList: true, subtree: true, characterData: true });
    window.setTimeout(() => { finished = true; observer?.disconnect(); }, WATCH_MS);
    // If the save changed nothing visible, still confirm it once the refresh has had time to land.
    window.setTimeout(() => { const node = find(); if (node && !applied && !finished) apply(node); }, SETTLE_MS);
    nextFrames(2, check);
  }, []);
  const value = useMemo(() => markSaved, [markSaved]);
  return <SaveFeedbackContext.Provider value={value}>{children}</SaveFeedbackContext.Provider>;
}

export function useSaveFeedback() {
  return useContext(SaveFeedbackContext);
}
