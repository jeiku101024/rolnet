// Feature 013 (research R9): the file name shown for a version. Rows saved before file names were
// stored get "[Type] [holder] [upload date].[ext]". document_shown_name() in
// 20261102000400_document_versions.sql builds the same text for Activity summaries.

const typeNames: Record<string, string> = { or_cr: "OR-CR", mtop_franchise: "MTOP franchise", insurance: "Insurance", driver_license: "Driver's license" };
const extensions: Record<string, string> = { "application/pdf": "pdf", "image/png": "png", "image/jpeg": "jpeg", "image/webp": "webp" };

function manilaDate(timestamp: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(timestamp));
}

export function shownFileName(input: { fileName?: string | null; documentType: string; holderName: string; createdAt: string; mimeType?: string | null }) {
  const stored = input.fileName?.trim();
  if (stored) return stored;
  return `${typeNames[input.documentType] ?? input.documentType} ${input.holderName} ${manilaDate(input.createdAt)}.${extensions[input.mimeType ?? ""] ?? "webp"}`;
}

/** True for PDFs, so rows can show a PDF icon instead of an image icon. */
export function isPdf(mimeType?: string | null) {
  return mimeType === "application/pdf";
}
