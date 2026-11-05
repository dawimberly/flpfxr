import { readFile, readdir } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { inflateRawSync, gunzipSync, brotliDecompressSync } from "node:zlib";
import { pathToFileURL } from "node:url";

const markers = /\bMSRP\b|\bour\s+cost\b|\blabo[u]?r\s+(?:rates?|costs?|per|@)\b|\binstall\s+each\b|\$\s*(?:75|125)(?:\.00)?(?![\d.])|\bO\s*&\s*P\b|\b(?:profit|gross|net)\s+margins?\b|laborPerUnit|laborPerOversized|personHours|adjustedDays|CREW_DAY_RATE|materialsAtCost|laborRate/i;
const proseMargin = /\bmargins?\b/i;
const textExtensions = /\.(?:docx|pdf|txt|json|csv|md|xml|html)$/i;
const maxExpanded = 32 * 1024 * 1024;

/** Read every ZIP entry from its central directory; DOCX text is compressed XML. */
export function docxText(buffer) {
  let end = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) { end = i; break; }
  }
  if (end < 0) throw new Error("Invalid DOCX ZIP directory");
  let cursor = buffer.readUInt32LE(end + 16), expanded = 0;
  const parts = [];
  for (let i = 0; i < buffer.readUInt16LE(end + 10); i++) {
    if (buffer.readUInt32LE(cursor) !== 0x02014b50) throw new Error("Invalid DOCX entry");
    const flags = buffer.readUInt16LE(cursor + 8), method = buffer.readUInt16LE(cursor + 10);
    const length = buffer.readUInt32LE(cursor + 20), size = buffer.readUInt32LE(cursor + 24);
    const nameLen = buffer.readUInt16LE(cursor + 28), extraLen = buffer.readUInt16LE(cursor + 30), commentLen = buffer.readUInt16LE(cursor + 32);
    const offset = buffer.readUInt32LE(cursor + 42), name = buffer.subarray(cursor + 46, cursor + 46 + nameLen).toString();
    cursor += 46 + nameLen + extraLen + commentLen;
    if (flags & 1 || ![0,8].includes(method)) throw new Error("Unreadable DOCX entry");
    expanded += size;
    if (expanded > maxExpanded) throw new Error("DOCX expansion limit exceeded");
    const start = offset + 30 + buffer.readUInt16LE(offset + 26) + buffer.readUInt16LE(offset + 28);
    const compressed = buffer.subarray(start, start + length);
    const bytes = method === 8 ? inflateRawSync(compressed, { maxOutputLength: maxExpanded }) : compressed;
    if (bytes.length !== size) throw new Error("DOCX size mismatch");
    if (/\.(?:xml|rels|txt)$/i.test(name)) parts.push(bytes.toString().replace(/<[^>]*>/g, "").replaceAll("&amp;", "&").replaceAll("&#36;", "$"));
  }
  return parts.join(" ");
}
async function pdfText(buffer) {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = getDocument({ data: new Uint8Array(buffer), useSystemFonts: true, isEvalSupported: false });
  const doc = await task.promise;
  try {
    const pages = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n), content = await page.getTextContent();
      const text = content.items.map(item => item.str ?? "").join(" ");
      // Fail closed on image-only PDFs: they cannot be audited without OCR.
      if (!text.trim()) throw new Error("PDF page has no auditable text (image-only PDFs require review)");
      pages.push(text);
    }
    return pages.join(" ");
  } finally { await task.destroy(); }
}
export async function scanPublicPricing(roots) {
  let count = 0;
  async function visit(path) {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      const file = join(path, entry.name);
      if (entry.isSymbolicLink()) throw new Error("Public symlinks cannot be audited: " + file);
      if (entry.isDirectory()) { await visit(file); continue; }
      count++;
      const buffer = await readFile(file), ext = extname(file).toLowerCase();
      let text = /\.(?:png|jpe?g|webp|avif|ico|woff2?|ttf|wasm)$/i.test(file) ? (buffer.toString("latin1").match(/[\x20-\x7e\r\n\t]{24,}/g) ?? []).join(" ") : buffer.toString("utf8");
      if (ext === ".docx") text += " " + docxText(buffer);
      if (ext === ".pdf") text += " " + await pdfText(buffer);
      if ([".zip", ".doc", ".xls", ".xlsx", ".ppt", ".pptx", ".7z"].includes(ext)) throw new Error("Unsupported public document/archive: " + file);
      if (ext === ".gz") text += gunzipSync(buffer, { maxOutputLength: maxExpanded }).toString();
      if (ext === ".br") text += brotliDecompressSync(buffer, { maxOutputLength: maxExpanded }).toString();
      // Normalize escapes used by JSON/JS and entity-encoded prose before matching.
      text = text.replace(/\\u([a-f0-9]{4})/gi, (_, n) => String.fromCharCode(parseInt(n,16))).replace(/\\x([a-f0-9]{2})/gi, (_, n) => String.fromCharCode(parseInt(n,16))).replaceAll("&amp;", "&").replaceAll("&#36;", "$" );
      if (markers.test(text) || (textExtensions.test(file) && proseMargin.test(text))) throw new Error("Confidential pricing marker in public file: " + file);
    }
  }
  for (const root of roots) await visit(resolve(root));
  return count;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const roots = process.argv.slice(2);
  if (!roots.length) throw new Error("Supply public directories to audit");
  console.log("Public pricing scan passed: " + await scanPublicPricing(roots) + " files.");
}
