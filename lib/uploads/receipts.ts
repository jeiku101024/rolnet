import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { compressReceiptImage } from "@/lib/uploads/compress-image";
import { sha256File } from "@/lib/uploads/hash-file";

export async function uploadReceipt(file: File, objectPath: string) {
  const compressed = await compressReceiptImage(file);
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.storage.from("receipts").upload(objectPath, compressed, { contentType: compressed.type, upsert: false });
  if (error) throw new Error("Receipt upload failed. Check the image and try again.");
  return { sizeBytes: compressed.size, mimeType: compressed.type, sha256: await sha256File(compressed) };
}
