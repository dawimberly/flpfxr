/** Position-aware PDF text rows so estimate tables stay on one line per item. */

type PdfItem = { str?: string; transform?: number[]; width?: number };

export async function extractPdfRows(data: ArrayBuffer | Uint8Array): Promise<string[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const src = data instanceof Uint8Array ? data : new Uint8Array(data);
  const bytes = new Uint8Array(src.byteLength);
  bytes.set(src);
  const options = {
    data: bytes,
    disableWorker: true,
    isEvalSupported: false,
  } as unknown as Parameters<typeof pdfjs.getDocument>[0];
  const doc = await pdfjs.getDocument(options).promise;
  const rows: string[] = [];
  const pages = Math.min(doc.numPages, 20);
  for (let pageNumber = 1; pageNumber <= pages; pageNumber += 1) {
    const page = await doc.getPage(pageNumber);
    const content = await page.getTextContent();
    rows.push(...rowsFromItems(content.items as PdfItem[]));
  }
  return rows;
}

export function rowsFromItems(items: PdfItem[]): string[] {
  const placed = items.flatMap((item) => {
    const str = item.str?.replace(/\s+/g, " ").trim() ?? "";
    const x = item.transform?.[4];
    const y = item.transform?.[5];
    if (!str || typeof x !== "number" || typeof y !== "number") return [];
    return [{ str, x, y, width: item.width ?? str.length * 4 }];
  });
  const buckets = new Map<number, typeof placed>();
  for (const item of placed) {
    const y = Math.round(item.y);
    const key = [...buckets.keys()].find((bucket) => Math.abs(bucket - y) <= 2) ?? y;
    const list = buckets.get(key) ?? [];
    list.push(item);
    buckets.set(key, list);
  }
  return [...buckets.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([, line]) => {
      const sorted = line.sort((a, b) => a.x - b.x);
      let text = "";
      let cursor = -Infinity;
      for (const item of sorted) {
        text += item.x - cursor > 14 ? (text ? "  " : "") + item.str : (text ? " " : "") + item.str;
        cursor = item.x + item.width;
      }
      return text.replace(/\s+/g, " ").trim();
    })
    .filter(Boolean);
}
