import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";
import { inflateRawSync, inflateSync, gunzipSync, brotliDecompressSync } from "node:zlib";
import { pathToFileURL } from "node:url";

// HTML5 named references from Python's standard-library html.entities.html5.
const entities = JSON.parse(readFileSync(new URL("./html-entities.json", import.meta.url), "utf8"));
const allowed = new Set([".js", ".mjs", ".css", ".html", ".htm", ".json", ".map", ".txt", ".xml", ".rels", ".svg", ".csv", ".md", ".webmanifest", ".pdf", ".docx", ".png", ".jpg", ".jpeg", ".webp", ".avif", ".ico", ".woff", ".woff2", ".ttf", ".otf", ".wasm", ".gz", ".br"]);
const binary = new Set([".png", ".jpg", ".jpeg", ".webp", ".avif", ".ico", ".woff", ".woff2", ".ttf", ".otf", ".wasm"]);
const markers = /\bMSRP\b|\bour\s+cost\b|\blabo[u]?r\s+(?:rates?|costs?|per|@)\b|\binstall\s+each\b|\$\s*(?:75|125)(?:\.00)?(?![\d.])|\bO\s*&\s*P\b|\boverhead\s+and\s+profit\b|\bmarkup\b|\boff\s+list\b|\bdealer\s+price\b|\b(?:profit|gross|net)\s+margins?\b|\blabo[u]?r\b[^\r\n]{0,32}\d+(?:\.\d+)?\s*\/\s*(?:hr|unit)\b|\d+(?:\.\d+)?\s*\/\s*(?:hr|unit)\b[^\r\n]{0,32}\blabo[u]?r\b|laborPerUnit|laborPerOversized|personHours|adjustedDays|CREW_DAY_RATE|materialsAtCost|laborRate/i;
const prose = /\.(?:docx|pdf|txt|json|csv|md|xml|rels|html?|svg|webmanifest)$/i;
// PNG metadata cannot tell us what the pixels say. Re-render and visually review
// the PDF before updating this digest when the public sample changes.
const reviewedSamplePng = "bc3faa37810d5a183c8c61db2338af1ee366c02bc3e28d27d930b51e953cd019";

function checkSampleEstimate(text, file) {
  const value = normalizePricingText(text).replace(/\s+/g, " ");
  const amounts = value.match(/\$\s*\d[\d,.]*/g) ?? [];
  const numbers = value.match(/\d[\d,.]*/g) ?? [];
  const banned = /\b(?:itemized|fees?|credit(?:ed)?|insurance claims?|guaranteed|free quote|starting at|licensed and insured)\b/i;
  if (amounts.length !== 1 || (value.match(/\$/g) ?? []).length !== 1 ||
      numbers.length !== 1 || !/^\$\d{1,3}(?:,\d{3})*$/.test(amounts[0]) ||
      banned.test(value) || !value.includes("Preliminary estimate only — not a quote.")) {
    throw new Error("Public sample must show one preliminary total and no itemized prices, ranges, or fees: " + file);
  }
}

const maxExpanded = 32 * 1024 * 1024;
const entityPattern = /&(?:#[xX][0-9a-fA-F]+;?|#[0-9]+;?|[a-zA-Z][a-zA-Z0-9]+;?)/g;
function decodeEntity(value) {
  const key = value.slice(1);
  if (key[0] !== "#") return entities[key] ?? value;
  const hex = /^#x/i.test(key), number = parseInt(key.replace(/^#x?/i, ""), hex ? 16 : 10);
  return number > 0 && number <= 0x10ffff && !(number >= 0xd800 && number <= 0xdfff) ? String.fromCodePoint(number) : "\ufffd";
}
export function normalizePricingText(value) {
  const canonical = text => text.normalize("NFKC").replace(/[\u00ad\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g, "");
  let text = canonical(value).replace(/\\u([a-f0-9]{4})/gi, (_, n) => String.fromCharCode(parseInt(n,16))).replace(/\\x([a-f0-9]{2})/gi, (_, n) => String.fromCharCode(parseInt(n,16)));
  for (let i = 0; i < 12; i++) {
    const decoded = canonical(text.replace(entityPattern, decodeEntity));
    if (decoded === text) return text;
    text = decoded;
  }
  throw new Error("Excessive nested text encoding");
}
function textViews(buffer) {
  const even = buffer.subarray(0, buffer.length - buffer.length % 2);
  return [buffer.toString("utf8"), buffer.toString("latin1"), even.toString("utf16le"), Buffer.from(even).swap16().toString("utf16le")];
}
function signature(buffer) {
  if (buffer.length >= 4 && [0x04034b50,0x06054b50,0x08074b50].includes(buffer.readUInt32LE(0))) return "zip";
  if (buffer[0] === 0x1f && buffer[1] === 0x8b) return "gzip";
  if (buffer.length >= 2 && (buffer[0] & 15) === 8 && (buffer[0] >> 4) <= 7 && ((buffer[0] << 8) + buffer[1]) % 31 === 0) return "zlib";
  if (buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return "png";
  if (buffer.subarray(0,5).toString() === "%PDF-") return "pdf";
  return null;
}
function zipEntries(buffer) {
  let end = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i--) if (buffer.readUInt32LE(i) === 0x06054b50) { end=i;break; }
  if (end < 0 || buffer.readUInt16LE(end+4) || buffer.readUInt16LE(end+6)) throw new Error("Unsupported ZIP directory");
  let cursor=buffer.readUInt32LE(end+16), unpacked=0;
  const entries=[];
  for(let i=0;i<buffer.readUInt16LE(end+10);i++) {
    if(buffer.readUInt32LE(cursor)!==0x02014b50)throw new Error("Invalid ZIP entry");
    const flags=buffer.readUInt16LE(cursor+8), method=buffer.readUInt16LE(cursor+10), length=buffer.readUInt32LE(cursor+20), size=buffer.readUInt32LE(cursor+24);
    const nameLen=buffer.readUInt16LE(cursor+28), extraLen=buffer.readUInt16LE(cursor+30), commentLen=buffer.readUInt16LE(cursor+32), offset=buffer.readUInt32LE(cursor+42);
    const name=buffer.subarray(cursor+46,cursor+46+nameLen).toString();cursor+=46+nameLen+extraLen+commentLen;
    unpacked+=size;
    if(flags&1 || ![0,8].includes(method) || unpacked>maxExpanded || size>maxExpanded || name.includes("..") || name.startsWith("/"))throw new Error("Unsupported ZIP entry");
    if(buffer.readUInt32LE(offset)!==0x04034b50)throw new Error("Invalid ZIP local header");
    const start=offset+30+buffer.readUInt16LE(offset+26)+buffer.readUInt16LE(offset+28);
    if(start+length>buffer.length)throw new Error("Truncated ZIP entry");
    const compressed=buffer.subarray(start,start+length), bytes=method===8?inflateRawSync(compressed,{maxOutputLength:maxExpanded}):compressed;
    if(bytes.length!==size)throw new Error("ZIP size mismatch");
    entries.push({name,bytes});
  }
  if(!entries.some(entry=>entry.name==="word/document.xml"))throw new Error("Only auditable DOCX archives are supported");
  return entries;
}
function pngMetadata(buffer) {
  const parts=[];let offset=8, ended=false, inflated=0;
  const expand=bytes=>{const value=inflateSync(bytes,{maxOutputLength:maxExpanded});inflated+=value.length;if(inflated>maxExpanded)throw new Error("PNG metadata expansion limit exceeded");return value;};
  while(offset+12<=buffer.length) {
    const length=buffer.readUInt32BE(offset), type=buffer.subarray(offset+4,offset+8).toString(), start=offset+8;
    if(start+length+4>buffer.length)throw new Error("Truncated PNG chunk");
    const data=buffer.subarray(start,start+length);offset=start+length+4;
    if(type==="tEXt") parts.push(data);
    if(type==="zTXt") {
      const zero=data.indexOf(0);if(zero<0 || data[zero+1]!==0)throw new Error("Invalid PNG compressed text");
      parts.push(data.subarray(0,zero),expand(data.subarray(zero+2)));
    }
    if(type==="iTXt") {
      const zero=data.indexOf(0);if(zero<0 || data.length<zero+5 || data[zero+1]>1 || data[zero+2]!==0)throw new Error("Invalid PNG international text");
      const languageEnd=data.indexOf(0,zero+3), keywordEnd=data.indexOf(0,languageEnd+1);
      if(languageEnd<0 || keywordEnd<0)throw new Error("Invalid PNG text fields");
      parts.push(data.subarray(0,zero),data.subarray(zero+3,keywordEnd));
      const text=data.subarray(keywordEnd+1);parts.push(data[zero+1]===1?expand(text):text);
    }
    if(type==="IEND"){ended=true;break;}
  }
  if(!ended || offset!==buffer.length)throw new Error("Invalid PNG ending or trailing content");
  return parts;
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
  let count=0, expanded=0;
  function checkText(text,file,isProse) {
    const value=normalizePricingText(text);
    if(/^\s*\{\s*\\rtf/i.test(value))throw new Error("RTF is not allowed in public output: "+file);
    const variants=isProse?[value,normalizePricingText(value.replace(/<[^>]*>/g,""))]:[value];
    if(variants.some(s=>markers.test(s)||(isProse&&/\bmargins?\b/i.test(s))))throw new Error("Confidential pricing marker in public file: "+file);
  }
  async function inspect(buffer,file,depth=0) {
    if(depth>6)throw new Error("Nested archive depth exceeded: "+file);
    const ext=extname(file).toLowerCase();
    if(!allowed.has(ext))throw new Error("Public extension is not allow-listed: "+file);
    expanded+=buffer.length;if(buffer.length>maxExpanded || expanded>256*1024*1024)throw new Error("Public scan expansion limit exceeded");
    const kind=signature(buffer);
    if (basename(file).toLowerCase() === "sample-estimate.png" &&
        createHash("sha256").update(buffer).digest("hex") !== reviewedSamplePng) {
      throw new Error("Public sample PNG must match the reviewed preview: " + file);
    }
    if(kind==="gzip" || kind==="zlib") {
      const data=kind==="gzip"?gunzipSync(buffer,{maxOutputLength:maxExpanded}):inflateSync(buffer,{maxOutputLength:maxExpanded});
      const inner=ext===".gz"?file.slice(0,-3):file;
      await inspect(data,inner,depth+1);return;
    }
    if(ext===".gz")throw new Error("Invalid gzip signature: "+file);
    if(ext===".br") {await inspect(brotliDecompressSync(buffer,{maxOutputLength:maxExpanded}),file.slice(0,-3),depth+1);return;}
    if(kind==="zip") {
      if(ext!==".docx")throw new Error("Renamed or unsupported ZIP archive: "+file);
      for(const entry of zipEntries(buffer))if(!entry.name.endsWith("/")) {
        // Embedded archives/unsupported objects are refused, never silently skipped.
        await inspect(entry.bytes,entry.name,depth+1);
      }
      return;
    }
    if(ext===".docx")throw new Error("Invalid DOCX ZIP signature: "+file);
    if (kind === "pdf") {
      const text = await pdfText(buffer);
      checkText(text, file, true);
      if (basename(file).toLowerCase() === "sample-estimate.pdf") checkSampleEstimate(text, file);
      return;
    }
    if(ext===".pdf")throw new Error("Invalid PDF signature: "+file);
    if(kind==="png") {for(const metadata of pngMetadata(buffer)) for(const text of textViews(metadata))checkText(text,file,true);return;}
    if(ext===".png")throw new Error("Invalid PNG signature: "+file);
    if(binary.has(ext)) {
      // Raster pixels are not OCR. Only readable binary metadata is scanned.
      for(const text of buffer.toString("latin1").match(/[\x20-\x7e\r\n\t]{24,}/g)??[])checkText(text,file,false);
    } else for(const text of textViews(buffer))checkText(text,file,prose.test(file));
  }
  async function visit(path) {
    for(const entry of await readdir(path,{withFileTypes:true})) {
      const file=join(path,entry.name);
      if(entry.isSymbolicLink())throw new Error("Public symlinks cannot be audited: "+file);
      if(entry.isDirectory()){await visit(file);continue;}
      count++;await inspect(await readFile(file),file);
    }
  }
  for(const root of roots)await visit(resolve(root));return count;
}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  if(process.argv.length<3)throw new Error("Supply public directories to audit");
  console.log("Public pricing scan passed: "+await scanPublicPricing(process.argv.slice(2))+" files.");
}
