import { PDFDocument, PDFName, PDFString, StandardFonts, degrees, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { PRELIMINARY_ESTIMATE_WORDING } from "./public-pricing.ts";
import {
  CUSTOMER_CONTACT_LINE,
  CUSTOMER_DEPOSIT_LINE,
  CUSTOMER_READY_LINE,
  customerFacingCopy,
  type LaborDocument,
} from "./labor-estimate.ts";

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 54;
const FOOTER = 40;
const CONTENT_W = PAGE_W - MARGIN * 2;
const INK = rgb(18 / 255, 52 / 255, 59 / 255);
const PRIMARY = rgb(196 / 255, 92 / 255, 38 / 255);
const MUTED = rgb(91 / 255, 110 / 255, 115 / 255);
const RULE = rgb(213 / 255, 221 / 255, 223 / 255);
/** Live nav background (`--color-bg` in src/styles.css). The header logo is white ink on this. */
const HEADER_BG = rgb(0x12 / 255, 0x14 / 255, 0x16 / 255);
const LOGO_ORANGE = rgb(0xf0 / 255, 0x83 / 255, 0x30 / 255);

/**
 * Polygon points from public/logo.svg, the file the site header loads
 * (`src/components/site-header.tsx` img src="/logo.svg", preloaded on theflipfixer.com).
 * viewBox 0 0 283.5 281.25. cls-1 is white, cls-2 is #f08330.
 */
export const SITE_HEADER_LOGO = {
  source: "public/logo.svg",
  viewW: 283.5,
  viewH: 281.25,
  white:
    "213.29 144.95 199.1 159.15 184.9 144.95 176.25 136.3 158.16 118.21 118.46 118.21 136.54 136.3 145.19 144.95 163.28 163.04 179.24 179 159.39 198.85 141.75 216.49 88.29 163.04 70.2 144.95 27.78 144.95 45.87 163.04 68.41 185.58 68.41 226.27 91.23 226.27 91.23 208.4 141.75 258.92 237.63 163.04 255.72 144.95 213.29 144.95",
  orange:
    "237.63 118.21 215.28 95.86 215.28 55.04 192.46 55.04 192.46 73.04 141.75 22.33 45.87 118.21 27.78 136.3 70.21 136.3 83.52 122.98 96.84 136.3 105.49 144.95 123.57 163.04 163.28 163.04 145.19 144.95 136.54 136.3 118.46 118.21 103.37 103.13 123.23 83.28 141.75 64.76 195.21 118.21 213.29 136.3 255.72 136.3 237.63 118.21",
};

function polygonPath(points: string) {
  const nums = points.trim().split(/\s+/);
  let path = "";
  for (let i = 0; i < nums.length; i += 2) {
    path += `${i === 0 ? "M" : "L"}${nums[i]} ${nums[i + 1]} `;
  }
  return `${path}Z`;
}

function money(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

function ascii(value: string) {
  return value
    .replace(/[\u2013\u2014\u2212]/g, "-")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\u00B7/g, "\u00B7")
    .replace(/[^\x20-\x7E\u00B7\n]/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = ascii(text).split(" ").filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) current = next;
    else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

export async function renderLaborEstimatePdf(args: {
  document: LaborDocument;
  name: string;
  phone: string;
  email: string;
  feeLabel: string;
  catalogUrl: string;
  submissionId: string;
  issued?: Date;
  /** Example PDF. Watermarks every page and labels the estimate number SAMPLE. */
  sample?: boolean;
}): Promise<Uint8Array> {
  const issued = args.issued ?? new Date();
  const number = args.sample
    ? "SAMPLE"
    : `${issued.getFullYear()}${String(issued.getMonth() + 1).padStart(2, "0")}${String(issued.getDate()).padStart(2, "0")}-${args.submissionId.slice(0, 4).toUpperCase()}`;
  const dateLabel = issued.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const copy = customerFacingCopy(args.document, args);
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const pages: PDFPage[] = [];
  let page = doc.addPage([PAGE_W, PAGE_H]);
  pages.push(page);
  let y = PAGE_H;

  const textAt = (value: string, x: number, baseline: number, size: number, face: PDFFont, color = INK) => {
    page.drawText(ascii(value), { x, y: baseline, size, font: face, color });
  };
  const drawLogo = (x: number, top: number, height: number) => {
    const width = height * (SITE_HEADER_LOGO.viewW / SITE_HEADER_LOGO.viewH);
    const scale = height / SITE_HEADER_LOGO.viewH;
    page.drawRectangle({ x, y: top - height, width, height, color: HEADER_BG });
    const originY = top;
    page.drawSvgPath(polygonPath(SITE_HEADER_LOGO.orange), { x, y: originY, scale, color: LOGO_ORANGE });
    page.drawSvgPath(polygonPath(SITE_HEADER_LOGO.white), { x, y: originY, scale, color: rgb(1, 1, 1) });
    return width;
  };
  const newPage = () => {
    page = doc.addPage([PAGE_W, PAGE_H]);
    pages.push(page);
    const mark = drawLogo(MARGIN, PAGE_H - 16, 18);
    textAt("FLIP FIXER", MARGIN + mark + 8, PAGE_H - 32, 11, bold);
    const right = `Estimate #${number}`;
    textAt(right, PAGE_W - MARGIN - font.widthOfTextAtSize(right, 8), PAGE_H - 32, 8, font, MUTED);
    y = PAGE_H - 56;
  };
  const ensure = (height: number) => {
    if (y - height < FOOTER + 8) newPage();
  };
  const paragraph = (value: string, size = 10, face = font, color = INK, width = CONTENT_W) => {
    const lines = wrap(value, face, size, width);
    for (const line of lines) {
      ensure(size + 4);
      textAt(line, MARGIN, y, size, face, color);
      y -= size + 3;
    }
    return lines;
  };
  const heading = (value: string) => {
    ensure(20);
    y -= 4;
    textAt(value, MARGIN, y, 11, bold);
    y -= 4;
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: MARGIN + 72, y },
      thickness: 1.2,
      color: PRIMARY,
    });
    y -= 12;
  };
  const bullet = (value: string) => {
    const lines = wrap(value, font, 10, CONTENT_W - 16);
    ensure(lines.length * 14 + 2);
    lines.forEach((line, index) => {
      if (index === 0) page.drawText("\u2022", { x: MARGIN, y, size: 10, font, color: INK });
      textAt(line, MARGIN + 14, y, 10, font);
      y -= 12;
    });
  };

  const mark = drawLogo(MARGIN, PAGE_H - 22, 40);
  textAt("FLIP FIXER", MARGIN + mark + 12, PAGE_H - 42, 18, bold);
  textAt(CUSTOMER_CONTACT_LINE, MARGIN + mark + 12, PAGE_H - 58, 9, font, MUTED);
  const meta = [`Estimate #${number}`, `Issued ${dateLabel}`, args.sample ? "SAMPLE" : "Valid 30 days"];
  meta.forEach((line, index) => {
    const size = index === 0 ? 10 : 9;
    const face = index === 0 ? bold : font;
    textAt(line, PAGE_W - MARGIN - face.widthOfTextAtSize(line, size), PAGE_H - 42 - index * 14, size, face, index === 2 ? PRIMARY : INK);
  });
  y = PAGE_H - 22 - 40 - 18;
  page.drawLine({ start: { x: MARGIN, y: y + 8 }, end: { x: PAGE_W - MARGIN, y: y + 8 }, thickness: 0.6, color: RULE });

  if (args.sample) {
    heading("SAMPLE");
    paragraph("This example uses a made-up customer and a typical medium kitchen. It is not a real job.");
  }

  heading("PROJECT");
  paragraph(copy.project, 10, font);

  heading("WHAT'S INCLUDED");
  for (const row of copy.included) bullet(row);

  heading("WHAT'S NOT INCLUDED");
  for (const row of copy.excluded) bullet(row);

  heading("INVESTMENT");
  if (copy.investment.length) {
    for (const row of copy.investment) {
      ensure(16);
      textAt(row.label, MARGIN, y, 10, font);
      const amount = money(row.cents);
      textAt(amount, PAGE_W - MARGIN - font.widthOfTextAtSize(amount, 10), y, 10, font);
      y -= 14;
    }
    ensure(22);
    y -= 2;
    page.drawLine({ start: { x: MARGIN, y: y + 12 }, end: { x: PAGE_W - MARGIN, y: y + 12 }, thickness: 0.6, color: INK });
    textAt("Estimated job total", MARGIN, y, 11, bold);
    const total = args.document.rangeLabel ?? money(args.document.totalCents);
    const totalSize = args.document.rangeLabel ? 10 : 12;
    textAt(total, PAGE_W - MARGIN - bold.widthOfTextAtSize(total, totalSize), y, totalSize, bold);
    y -= 18;
  } else {
    paragraph("Set after we walk the space.");
  }

  heading("NOTES");
  for (const row of copy.notes) {
    if (!row.includes(args.catalogUrl)) {
      bullet(row);
      continue;
    }
    bullet("We order materials with you after the designer call. Browse finishes here:");
    ensure(16);
    const urlX = MARGIN + 14;
    const urlW = font.widthOfTextAtSize(args.catalogUrl, 10);
    textAt(args.catalogUrl, urlX, y, 10, font, PRIMARY);
    page.drawLine({
      start: { x: urlX, y: y - 1 },
      end: { x: urlX + urlW, y: y - 1 },
      thickness: 0.4,
      color: PRIMARY,
    });
    const linkPage = page;
    const annot = doc.context.obj({
      Type: "Annot",
      Subtype: "Link",
      Rect: [urlX, y - 2, urlX + urlW, y + 10],
      Border: [0, 0, 0],
      A: { Type: "Action", S: "URI", URI: PDFString.of(args.catalogUrl) },
    });
    linkPage.node.set(PDFName.of("Annots"), doc.context.obj([doc.context.register(annot)]));
    y -= 13;
  }

  ensure(52);
  y -= 4;
  paragraph(CUSTOMER_DEPOSIT_LINE, 10, bold);
  y -= 2;
  paragraph(PRELIMINARY_ESTIMATE_WORDING, 10, bold);
  y -= 4;
  paragraph(CUSTOMER_READY_LINE, 12, bold);

  pages.forEach((item, index) => {
    if (args.sample) {
      item.drawText("SAMPLE", {
        x: 118,
        y: 250,
        size: 92,
        font: bold,
        color: PRIMARY,
        opacity: 0.16,
        rotate: degrees(34),
      });
    }
    const label = `theflipfixer.com  ·  San Antonio, TX  ·  ${index + 1} of ${pages.length}`;
    item.drawLine({
      start: { x: MARGIN, y: 28 },
      end: { x: PAGE_W - MARGIN, y: 28 },
      thickness: 0.4,
      color: RULE,
    });
    item.drawText(ascii(label), { x: MARGIN, y: 14, size: 8, font, color: MUTED });
  });
  return doc.save();
}
