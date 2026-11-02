import { afterEach, describe, expect, it, vi } from "vitest";
import { purgeRevertedDocumentFiles, type PurgeClient } from "@/lib/documents/purge";

// Feature 013 (FR-047): the daily purge deletes only due files, marks only the ones removed, and
// the route refuses calls without the secret.

function fakeClient(rows: { id: string; object_path: string }[], failingPaths: string[] = []) {
  const calls = { query: [] as string[], removed: [] as string[], marked: [] as string[][] };
  const chain = {
    select: () => chain,
    eq: (column: string, value: string) => { calls.query.push(`${column}=${value}`); return chain; },
    is: (column: string) => { calls.query.push(`${column} is null`); return chain; },
    lte: (column: string) => { calls.query.push(`${column}<=now`); return chain; },
    order: () => chain,
    limit: (count: number) => { calls.query.push(`limit ${count}`); return Promise.resolve({ data: rows, error: null }); },
  };
  const client = {
    from: () => chain,
    storage: { from: () => ({ remove: (paths: string[]) => {
      calls.removed.push(...paths);
      return Promise.resolve(failingPaths.includes(paths[0]) ? { data: null, error: new Error("storage down") } : { data: [], error: null });
    } }) },
    rpc: (_name: string, args: { p_ids: string[] }) => { calls.marked.push(args.p_ids); return Promise.resolve({ data: args.p_ids.length, error: null }); },
  } as unknown as PurgeClient;
  return { client, calls };
}

describe("purge of reverted document files", () => {
  it("asks only for reverted rows past their date, in batches of 100", async () => {
    const { client, calls } = fakeClient([]);
    expect(await purgeRevertedDocumentFiles(client)).toEqual({ purged: 0, failed: 0 });
    expect(calls.query).toEqual(["lifecycle_status=reverted", "file_deleted_at is null", "purge_after<=now", "limit 100"]);
    expect(calls.marked).toEqual([]);
  });

  it("marks the files removed, counts a missing object as removed, and leaves failures for the next run", async () => {
    const { client, calls } = fakeClient([{ id: "a", object_path: "documents/a.pdf" }, { id: "b", object_path: "documents/b.pdf" }, { id: "c", object_path: "documents/missing.pdf" }], ["documents/b.pdf"]);
    expect(await purgeRevertedDocumentFiles(client)).toEqual({ purged: 2, failed: 1 });
    expect(calls.removed).toEqual(["documents/a.pdf", "documents/b.pdf", "documents/missing.pdf"]);
    expect(calls.marked).toEqual([["a", "c"]]);
  });
});

describe("purge route", () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

  it("is closed until CRON_SECRET is set, and refuses a wrong token", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const { POST } = await import("@/app/api/cron/purge-document-files/route");
    expect((await POST(new Request("http://x/api/cron/purge-document-files", { method: "POST" }))).status).toBe(503);
    vi.stubEnv("CRON_SECRET", "right-secret");
    expect((await POST(new Request("http://x", { method: "POST", headers: { authorization: "Bearer wrong" } }))).status).toBe(401);
    expect((await POST(new Request("http://x", { method: "POST" }))).status).toBe(401);
  });
});
