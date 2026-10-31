/** Browser/node text extract from an EagleView or Xactimate PDF. */

export async function extractPdfText(data: ArrayBuffer | Uint8Array): Promise<string> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const src = data instanceof Uint8Array ? data : new Uint8Array(data);
  const bytes = new Uint8Array(src.byteLength);
  bytes.set(src);
  // Preserve the original safe PDF parsing settings despite incomplete library typings.
  const options = {
    data: bytes,
    disableWorker: true,
    isEvalSupported: false,
  } as unknown as Parameters<typeof pdfjs.getDocument>[0];
  const doc = await pdfjs.getDocument(options).promise;
  const pages = Math.min(doc.numPages, 14);
  const chunks: string[] = [];
  for (let i = 1; i <= pages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const line = content.items
      .map((item) => ("str" in item ? String(item.str) : ""))
      .join(" ");
    chunks.push(line);
  }
  return chunks.join("\n");
}
