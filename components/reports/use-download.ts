import { xlsxContentType } from "@/lib/reports/xlsx";

// Feature 019: what every download card shares for handing a file to the browser and explaining a failed request.

/** Saves bytes as a file through a temporary link. */
export function saveFile(bytes: Uint8Array | Blob, fileName: string) {
  const blob = bytes instanceof Blob ? bytes : new Blob([bytes as BlobPart], { type: xlsxContentType });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

/** The file name in a `content-disposition: attachment; filename="..."` header, or the fallback. */
export function fileNameFrom(response: Response, fallback: string) {
  const match = /filename="?([^";]+)"?/i.exec(response.headers.get("content-disposition") ?? "");
  return match?.[1] ?? fallback;
}

/** A plain-language message for a failed download request. */
export async function failureMessage(response: Response, fallback = "The report could not be created. Try again.") {
  if (response.status === 401) return "Your session has ended. Sign in again, then download the report.";
  const body = await response.json().catch(() => null) as { error?: { message?: string } } | null;
  return body?.error?.message ?? fallback;
}
