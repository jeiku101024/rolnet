import imageCompression from "browser-image-compression";

export async function compressReceiptImage(file: File) {
  if (!file.type.startsWith("image/")) throw new Error("Receipt must be an image file");
  const compressed = await imageCompression(file, {
    maxSizeMB: 0.3,
    maxWidthOrHeight: 2000,
    useWebWorker: true,
    fileType: "image/webp",
  });
  if (compressed.size > 307200) throw new Error("Receipt could not be compressed below 300 KB");
  return compressed;
}
