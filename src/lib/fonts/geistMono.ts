import type { jsPDF } from "jspdf";
import woff400Url from "@fontsource/geist-mono/files/geist-mono-latin-400-normal.woff?url";
import woff700Url from "@fontsource/geist-mono/files/geist-mono-latin-700-normal.woff?url";

interface WoffTableEntry {
  tag: number;
  offset: number;
  compLength: number;
  origLength: number;
  origChecksum: number;
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

async function zlibInflate(compressed: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([compressed.buffer.slice(
    compressed.byteOffset,
    compressed.byteOffset + compressed.byteLength,
  ) as ArrayBuffer])
    .stream()
    .pipeThrough(new DecompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function decompressWoffTable(
  woff: Uint8Array,
  entry: WoffTableEntry,
): Promise<Uint8Array> {
  const compressed = woff.subarray(entry.offset, entry.offset + entry.compLength);
  if (entry.compLength === entry.origLength) {
    return compressed;
  }
  return zlibInflate(compressed);
}

async function woffToTtf(woff: Uint8Array): Promise<Uint8Array> {
  const view = new DataView(woff.buffer, woff.byteOffset, woff.byteLength);
  const signature = String.fromCharCode(...woff.subarray(0, 4));
  if (signature !== "wOFF") {
    throw new Error("Expected WOFF font data from @fontsource/geist-mono");
  }

  const flavor = view.getUint32(4);
  const numTables = view.getUint16(12);
  const entries: WoffTableEntry[] = [];

  let dirOffset = 44;
  for (let i = 0; i < numTables; i++) {
    entries.push({
      tag: view.getUint32(dirOffset),
      offset: view.getUint32(dirOffset + 4),
      compLength: view.getUint32(dirOffset + 8),
      origLength: view.getUint32(dirOffset + 12),
      origChecksum: view.getUint32(dirOffset + 16),
    });
    dirOffset += 20;
  }

  const tables = await Promise.all(
    entries.map(async (entry) => ({
      ...entry,
      data: await decompressWoffTable(woff, entry),
    })),
  );

  tables.sort((a, b) => a.tag - b.tag);

  const entrySelector = Math.floor(Math.log2(numTables));
  const searchRange = 2 ** entrySelector * 16;
  const rangeShift = numTables * 16 - searchRange;

  let dataOffset = 12 + numTables * 16;
  const records = tables.map((table) => {
    const record = {
      tag: table.tag,
      checksum: table.origChecksum,
      offset: dataOffset,
      length: table.origLength,
    };
    dataOffset += (table.origLength + 3) & ~3;
    return record;
  });

  const out = new Uint8Array(dataOffset);
  const outView = new DataView(out.buffer);

  outView.setUint32(0, flavor);
  outView.setUint16(4, numTables);
  outView.setUint16(6, searchRange);
  outView.setUint16(8, entrySelector);
  outView.setUint16(10, rangeShift);

  let recordOffset = 12;
  for (const record of records) {
    outView.setUint32(recordOffset, record.tag);
    outView.setUint32(recordOffset + 4, record.checksum);
    outView.setUint32(recordOffset + 8, record.offset);
    outView.setUint32(recordOffset + 12, record.length);
    recordOffset += 16;
  }

  let tableOffset = 12 + numTables * 16;
  for (const table of tables) {
    out.set(table.data, tableOffset);
    tableOffset += (table.origLength + 3) & ~3;
  }

  return out;
}

const geistMonoRegularBase64 = uint8ArrayToBase64(
  await woffToTtf(new Uint8Array(await (await fetch(woff400Url)).arrayBuffer())),
);
const geistMonoBoldBase64 = uint8ArrayToBase64(
  await woffToTtf(new Uint8Array(await (await fetch(woff700Url)).arrayBuffer())),
);

export function registerGeistMono(doc: jsPDF): void {
  doc.addFileToVFS("GeistMono-Regular.ttf", geistMonoRegularBase64);
  doc.addFont("GeistMono-Regular.ttf", "GeistMono", "normal");
  doc.addFileToVFS("GeistMono-Bold.ttf", geistMonoBoldBase64);
  doc.addFont("GeistMono-Bold.ttf", "GeistMono", "bold");
}
