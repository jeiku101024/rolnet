// Feature 013 (FR-047, research R10): delete the stored files of reverted uploads whose 30 days have
// passed, then record when. Only files are deleted; every record stays (constitution III).

export const purgeBatchSize = 100;

/** The parts of a Supabase client the purge uses, so tests can pass a fake. */
export interface PurgeClient {
  from(table: "documents"): {
    select(columns: string): {
      eq(column: string, value: string): {
        is(column: string, value: null): {
          lte(column: string, value: string): {
            order(column: string, options: { ascending: boolean }): { limit(count: number): PromiseLike<{ data: { id: string; object_path: string }[] | null; error: unknown }> };
          };
        };
      };
    };
  };
  storage: { from(bucket: string): { remove(paths: string[]): PromiseLike<{ data: { name: string }[] | null; error: unknown }> } };
  rpc(name: "mark_document_files_deleted", args: { p_ids: string[] }): PromiseLike<{ data: number | null; error: unknown }>;
}

export async function purgeRevertedDocumentFiles(client: PurgeClient, now = new Date()) {
  const { data: due, error } = await client.from("documents").select("id, object_path").eq("lifecycle_status", "reverted").is("file_deleted_at", null)
    .lte("purge_after", now.toISOString()).order("purge_after", { ascending: true }).limit(purgeBatchSize);
  if (error) throw error;
  const rows = due ?? [];
  if (!rows.length) return { purged: 0, failed: 0 };
  // Storage reports the objects it removed; a missing object counts as removed, so only an error
  // keeps a row for the next run.
  const removed: string[] = [];
  let failed = 0;
  for (const row of rows) {
    const result = await client.storage.from("documents").remove([row.object_path]);
    if (result.error) failed += 1;
    else removed.push(row.id);
  }
  if (!removed.length) return { purged: 0, failed };
  const marked = await client.rpc("mark_document_files_deleted", { p_ids: removed });
  if (marked.error) throw marked.error;
  return { purged: marked.data ?? 0, failed };
}
