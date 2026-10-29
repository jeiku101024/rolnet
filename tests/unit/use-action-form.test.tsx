import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useActionForm, type FormOutcome } from "@/components/forms/use-action-form";
import { FormFooter } from "@/components/forms/form-status";

afterEach(cleanup);

function TestForm({ handler }: { handler: (key: string) => Promise<FormOutcome> }) {
  const { pending, status, submit } = useActionForm();
  return <form aria-label="test" onSubmit={submit(async ({ key }) => handler(key("record")))}>
    <input aria-label="name" name="name" defaultValue="" />
    <FormFooter pending={pending} status={status} label="Save" />
  </form>;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

describe("useActionForm", () => {
  it("shows success and resets the form after an awaited save (T129)", async () => {
    render(<TestForm handler={async () => ({ ok: true, message: "Saved." })} />);
    const input = screen.getByLabelText("name") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "T-01" } });
    await act(async () => { fireEvent.submit(screen.getByRole("form", { name: "test" })); });
    expect(screen.getByRole("status").textContent).toBe("Saved.");
    expect(input.value).toBe("");
  });

  it("ignores a second submit while saving and disables the button (T133)", async () => {
    const pending = deferred<FormOutcome>();
    const handler = vi.fn(() => pending.promise);
    render(<TestForm handler={handler} />);
    const form = screen.getByRole("form", { name: "test" });
    await act(async () => { fireEvent.submit(form); fireEvent.submit(form); });
    expect(handler).toHaveBeenCalledTimes(1);
    expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(true);
    await act(async () => { pending.resolve({ ok: true, message: "Saved." }); });
    expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(false);
  });

  it("reuses the idempotency key after a failure and renews it after success", async () => {
    const keys: string[] = [];
    const outcomes: FormOutcome[] = [{ ok: false, message: "Network trouble." }, { ok: true, message: "Saved." }, { ok: true, message: "Saved." }];
    render(<TestForm handler={async (key) => { keys.push(key); return outcomes.shift()!; }} />);
    const form = screen.getByRole("form", { name: "test" });
    await act(async () => { fireEvent.submit(form); });
    expect(screen.getByRole("alert").textContent).toBe("Network trouble.");
    await act(async () => { fireEvent.submit(form); });
    await act(async () => { fireEvent.submit(form); });
    expect(keys[0]).toBe(keys[1]);
    expect(keys[2]).not.toBe(keys[1]);
  });

  it("shows thrown client errors in plain language", async () => {
    render(<TestForm handler={async () => { throw new TypeError("Failed to fetch"); }} />);
    await act(async () => { fireEvent.submit(screen.getByRole("form", { name: "test" })); });
    expect(screen.getByRole("alert").textContent).toMatch(/Check your connection/);
  });
});
