import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export async function uploadDocument(file: File, path: string) {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.storage.from("documents").upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error("The document file could not be uploaded. Check your connection and try again.");
  return { sizeBytes: file.size };
}

/** Removes an uploaded document file whose record could not be saved (owner-only bucket). */
export async function removeDocumentObject(path: string) {
  try {
    await createSupabaseBrowserClient().storage.from("documents").remove([path]);
  } catch {
    // Ignored: the user already sees the save failure.
  }
}
