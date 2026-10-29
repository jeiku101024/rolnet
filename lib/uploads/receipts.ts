import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { compressReceiptImage } from "@/lib/uploads/compress-image";
import { sha256File } from "@/lib/uploads/hash-file";

/** Compresses a receipt photo to WebP (<= 300 KB) before any record is saved. */
export async function prepareReceiptFile(file: File) {
  const compressed = await compressReceiptImage(file);
  return { file: compressed, mimeType: compressed.type || "image/webp", sizeBytes: compressed.size, sha256: await sha256File(compressed) };
}

export async function uploadReceipt(file: Blob, objectPath: string, mimeType: string) {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.storage.from("receipts").upload(objectPath, file, { contentType: mimeType, upsert: false });
  if (error) throw new Error("The receipt photo could not be uploaded. Check your connection and try again.");
}

/**
 * Best-effort removal of a receipt object whose metadata could not be saved. Storage policy only
 * lets the owner delete receipts, so for staff the object stays (it is unreachable without an
 * expense pointing at it).
 */
export async function removeReceiptObject(objectPath: string) {
  try {
    await createSupabaseBrowserClient().storage.from("receipts").remove([objectPath]);
  } catch {
    // Ignored: the user already sees the save failure.
  }
}
