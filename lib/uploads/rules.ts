// File rules shared by the browser (checked before any record is created, T134) and the server.

export const receiptMimeTypes = ["image/jpeg", "image/png", "image/webp"];
export const documentMimeTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
/** Receipts larger than this are still accepted, because they are compressed below 300 KB first. */
export const receiptMaxSourceBytes = 20 * 1024 * 1024;
export const documentMaxBytes = 5 * 1024 * 1024;

export function receiptExtension(mimeType: string) {
  return mimeType === "image/png" ? "png" : mimeType === "image/jpeg" ? "jpeg" : "webp";
}

export function documentExtension(mimeType: string) {
  return mimeType === "application/pdf" ? "pdf" : receiptExtension(mimeType);
}

/** Returns a plain-language problem with a chosen receipt photo, or null when it can be used. */
export function receiptFileProblem(file: { type: string; size: number }) {
  if (!receiptMimeTypes.includes(file.type)) return "The receipt must be a JPG, PNG or WebP photo. PDFs and other files are not accepted.";
  if (file.size > receiptMaxSourceBytes) return "This photo is larger than 20 MB. Take a smaller photo and try again.";
  return null;
}

/** Returns a plain-language problem with a chosen document file, or null when it can be used. */
export function documentFileProblem(file: { type: string; size: number }) {
  if (!documentMimeTypes.includes(file.type)) return "The document must be a JPG, PNG, WebP or PDF file.";
  if (file.size > documentMaxBytes) return "The document file must be 5 MB or smaller.";
  if (file.size === 0) return "The chosen file is empty. Choose the document file again.";
  return null;
}
