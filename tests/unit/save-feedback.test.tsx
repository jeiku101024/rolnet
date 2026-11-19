import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SaveFeedbackProvider, useSaveFeedback } from "@/components/ui/save-feedback";

function Capture() {
  const mark = useSaveFeedback();
  return <>
    <button data-testid="mark-a" onClick={() => mark("a")}>a</button>
    <button data-testid="mark-b-new" onClick={() => mark("b", { created: true })}>b</button>
    <button data-testid="mark-new" onClick={() => mark("new", { created: true })}>n</button>
    <button data-testid="mark-zzz" onClick={() => mark("zzz")}>z</button>
  </>;
}

beforeEach(() => {
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { callback(0); return 0; });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function setup() {
  return render(
    <SaveFeedbackProvider>
      <Capture />
      <ul>
        <li data-testid="a" data-record-id="a">A</li>
        <li data-testid="b" data-record-id="b">B</li>
      </ul>
    </SaveFeedbackProvider>,
  );
}

describe("SaveFeedbackProvider", () => {
  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  it("ignores the form's own change right after the click, then glows once when the refresh lands", async () => {
    const { getByTestId, container } = setup();
    fireEvent.click(getByTestId("mark-a"));
    await act(async () => { getByTestId("a").textContent = "A (editor closed)"; });
    await act(async () => { await wait(120); });
    expect(getByTestId("a").classList.contains("row-saved")).toBe(false);
    await act(async () => { await wait(250); getByTestId("a").textContent = "A updated by the server"; });
    await waitFor(() => expect(getByTestId("a").classList.contains("row-saved")).toBe(true));
    expect(getByTestId("b").className).toBe("");
    expect(container.querySelectorAll(".row-saved")).toHaveLength(1);
    getByTestId("a").dispatchEvent(new Event("animationend"));
    expect(getByTestId("a").classList.contains("row-saved")).toBe(false);
  });

  it("hands the glow to a replacement element and carries on from the same point", async () => {
    const { getByTestId, container } = setup();
    fireEvent.click(getByTestId("mark-a"));
    const old = getByTestId("a");
    const first = document.createElement("li");
    first.dataset.recordId = "a";
    first.textContent = "A new";
    await act(async () => { await wait(300); old.replaceWith(first); });
    await waitFor(() => expect(first.classList.contains("row-saved")).toBe(true));
    const second = document.createElement("li");
    second.dataset.recordId = "a";
    second.textContent = "A newer";
    await act(async () => { await wait(100); first.replaceWith(second); });
    await waitFor(() => expect(second.classList.contains("row-saved")).toBe(true));
    expect(first.classList.contains("row-saved")).toBe(false);
    expect(second.style.animationDelay).toMatch(/^-\d+ms$/);
    expect(container.querySelectorAll(".row-saved")).toHaveLength(1);
  });

  it("eases in a newly created row once it appears", async () => {
    const { getByTestId, container } = setup();
    fireEvent.click(getByTestId("mark-new"));
    const created = document.createElement("li");
    created.dataset.recordId = "new";
    await act(async () => { container.querySelector("ul")!.prepend(created); });
    await waitFor(() => expect(created.classList.contains("row-new")).toBe(true));
  });

  it("does nothing for an unknown id", () => {
    const { container, getByTestId } = setup();
    fireEvent.click(getByTestId("mark-zzz"));
    expect(container.querySelector(".row-saved, .row-new")).toBeNull();
  });

  it("waits for a row that arrives after the page refresh", async () => {
    const { getByTestId, container } = setup();
    fireEvent.click(getByTestId("mark-zzz"));
    const late = document.createElement("li");
    late.dataset.recordId = "zzz";
    setTimeout(() => container.querySelector("ul")!.prepend(late), 50);
    await waitFor(() => expect(late.classList.contains("row-saved")).toBe(true));
  });
});
