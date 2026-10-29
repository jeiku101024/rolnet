import imageCompression from "browser-image-compression";

export async function compressReceiptImage(file: File) {
  if (!file.type.startsWith("image/")) throw new Error("The receipt must be a JPG, PNG or WebP photo.");
  let compressed: File;
  try {
    compressed = await imageCompression(file, {
      maxSizeMB: 0.3,
      maxWidthOrHeight: 2000,
      useWebWorker: true,
      fileType: "image/webp",
    });
  } catch {
    throw new Error("This photo could not be read. Take the photo again or choose another file.");
  }
  if (compressed.size > 307200) throw new Error("The receipt could not be made smaller than 300 KB. Take a closer, simpler photo and try again.");
  return compressed;
}
