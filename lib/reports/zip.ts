// Feature 014 (research R2, R3): zip assembly for the report workbook. Each part is compressed on its own so
// a workbook of about 100 sheets never holds all of its XML at once. Compression uses the platform
// CompressionStream("gzip"): a gzip stream is a 10-byte header, the raw deflate data, then the CRC-32 and
// size, so the deflate bytes and the CRC come from native code. Without CompressionStream the part is
// stored uncompressed and the CRC is worked out here.

export interface ZipEntry {
  name: Uint8Array;
  /** 0 = stored, 8 = deflated. */
  method: 0 | 8;
  crc: number;
  size: number;
  data: Uint8Array;
}

const encoder = new TextEncoder();

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (let index = 0; index < bytes.length; index++) crc = crcTable[(crc ^ bytes[index]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

async function gzip(data: Uint8Array): Promise<Uint8Array> {
  const stream = new CompressionStream("gzip");
  const writer = stream.writable.getWriter();
  const reader = stream.readable.getReader();
  const chunks: Uint8Array[] = [];
  const writing = writer.write(data as Uint8Array<ArrayBuffer>).then(() => writer.close());
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  await writing;
  const out = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0));
  let at = 0;
  for (const chunk of chunks) { out.set(chunk, at); at += chunk.length; }
  return out;
}

/** One zip entry for a part, deflated when the platform can. */
export async function zipEntry(name: string, content: string | Uint8Array): Promise<ZipEntry> {
  const data = typeof content === "string" ? encoder.encode(content) : content;
  const nameBytes = encoder.encode(name);
  if (typeof CompressionStream !== "undefined") {
    const packed = await gzip(data);
    // Header is 10 bytes when no optional fields are flagged; the trailer is CRC-32 then size.
    if (packed.length >= 18 && packed[3] === 0) {
      const trailer = new DataView(packed.buffer, packed.byteOffset + packed.length - 8, 8);
      return { name: nameBytes, method: 8, crc: trailer.getUint32(0, true), size: trailer.getUint32(4, true), data: packed.subarray(10, packed.length - 8) };
    }
  }
  return { name: nameBytes, method: 0, crc: crc32(data), size: data.length, data };
}

/** The finished zip. Times are fixed at 1980-01-01 so the output is repeatable. */
export function buildZip(entries: ZipEntry[]): Uint8Array {
  const dosDate = (0 << 9) | (1 << 5) | 1;
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  for (const entry of entries) {
    const local = new Uint8Array(30 + entry.name.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true); lv.setUint16(4, 20, true); lv.setUint16(6, 0x0800, true); lv.setUint16(8, entry.method, true);
    lv.setUint16(10, 0, true); lv.setUint16(12, dosDate, true); lv.setUint32(14, entry.crc, true);
    lv.setUint32(18, entry.data.length, true); lv.setUint32(22, entry.size, true); lv.setUint16(26, entry.name.length, true); lv.setUint16(28, 0, true);
    local.set(entry.name, 30);
    const central = new Uint8Array(46 + entry.name.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint16(8, 0x0800, true); cv.setUint16(10, entry.method, true);
    cv.setUint16(12, 0, true); cv.setUint16(14, dosDate, true); cv.setUint32(16, entry.crc, true); cv.setUint32(20, entry.data.length, true); cv.setUint32(24, entry.size, true);
    cv.setUint16(28, entry.name.length, true); cv.setUint32(42, offset, true);
    central.set(entry.name, 46);
    locals.push(local, entry.data);
    centrals.push(central);
    offset += local.length + entry.data.length;
  }
  const centralSize = centrals.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, entries.length, true); ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true); ev.setUint32(16, offset, true);
  const out = new Uint8Array(offset + centralSize + end.length);
  let at = 0;
  for (const part of [...locals, ...centrals, end]) { out.set(part, at); at += part.length; }
  return out;
}
