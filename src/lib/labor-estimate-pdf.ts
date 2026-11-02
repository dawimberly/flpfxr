import { PDFDocument, PDFName, PDFString, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
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
}): Promise<Uint8Array> {
  const issued = args.issued ?? new Date();
  const number = `${issued.getFullYear()}${String(issued.getMonth() + 1).padStart(2, "0")}${String(issued.getDate()).padStart(2, "0")}-${args.submissionId.slice(0, 4).toUpperCase()}`;
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
  const newPage = () => {
    page = doc.addPage([PAGE_W, PAGE_H]);
    pages.push(page);
    const slot = 18;
    page.drawRectangle({
      x: MARGIN,
      y: PAGE_H - 18 - slot,
      width: slot,
      height: slot,
      borderColor: RULE,
      borderWidth: 0.8,
    });
    textAt("FLIP FIXER", MARGIN + slot + 8, PAGE_H - 32, 11, bold);
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
      textAt(index === 0 ? "•" : "", MARGIN, y, 10, font);
      textAt(line, MARGIN + 14, y, 10, font);
      y -= 12;
    });
  };

    const slot = 40;
  page.drawRectangle({
    x: MARGIN,
    y: PAGE_H - 24 - slot,
    width: slot,
    height: slot,
    borderColor: RULE,
    borderWidth: 1,
  });
  textAt("FLIP FIXER", MARGIN + slot + 12, PAGE_H - 42, 18, bold);
  textAt(CUSTOMER_CONTACT_LINE, MARGIN + slot + 12, PAGE_H - 58, 9, font, MUTED);
  const meta = [`Estimate #${number}`, `Issued ${dateLabel}`, "Valid 30 days"];
  meta.forEach((line, index) => {
    const size = index === 0 ? 10 : 9;
    const face = index === 0 ? bold : font;
    textAt(line, PAGE_W - MARGIN - face.widthOfTextAtSize(line, size), PAGE_H - 42 - index * 14, size, face, index === 2 ? PRIMARY : INK);
  });
  y = PAGE_H - 24 - slot - 18;
  page.drawLine({ start: { x: MARGIN, y: y + 8 }, end: { x: PAGE_W - MARGIN, y: y + 8 }, thickness: 0.6, color: RULE });

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
    textAt("Labor and services", MARGIN, y, 11, bold);
    const total = money(args.document.totalCents);
    textAt(total, PAGE_W - MARGIN - bold.widthOfTextAtSize(total, 12), y, 12, bold);
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
