// Feature 009: reads the stored (uncompressed) zips written by lib/reports/xlsx.ts, for the unit and
// e2e tests. Returns each entry's name, bytes and the CRC-32 recorded for it.

export interface ZipEntry { name: string; data: Uint8Array; crc: number }

export function readStoredZip(bytes: Uint8Array): ZipEntry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const decoder = new TextDecoder();
  const entries: ZipEntry[] = [];
  for (let at = 0; view.getUint32(at, true) === 0x04034b50;) {
    if (view.getUint16(at + 8, true) !== 0) throw new Error("Only stored entries are expected");
    const crc = view.getUint32(at + 14, true);
    const size = view.getUint32(at + 18, true);
    const nameLength = view.getUint16(at + 26, true);
    const extraLength = view.getUint16(at + 28, true);
    const name = decoder.decode(bytes.subarray(at + 30, at + 30 + nameLength));
    const start = at + 30 + nameLength + extraLength;
    entries.push({ name, data: bytes.subarray(start, start + size), crc });
    at = start + size;
  }
  return entries;
}

export function zipText(bytes: Uint8Array, name: string) {
  const entry = readStoredZip(bytes).find((item) => item.name === name);
  if (!entry) throw new Error(`Missing ${name}`);
  return new TextDecoder().decode(entry.data);
}
