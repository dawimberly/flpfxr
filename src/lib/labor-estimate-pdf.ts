import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { SITE } from "./site.ts";
import { CATALOG_BROWSE_NOTE, FEE_CREDIT_NOTE, LABOR_ONLY_NOTE } from "./offer-copy.ts";
import { type LaborDocument, type LaborLine } from "./labor-estimate.ts";

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 48;
const FOOTER = 40;
const INK = rgb(18 / 255, 52 / 255, 59 / 255);
const CREAM = rgb(244 / 255, 241 / 255, 236 / 255);
const PRIMARY = rgb(196 / 255, 92 / 255, 38 / 255);
const MUTED = rgb(91 / 255, 110 / 255, 115 / 255);
const RULE = rgb(213 / 255, 221 / 255, 223 / 255);
const WASH = rgb(232 / 255, 239 / 255, 239 / 255);
const ZEBRA = rgb(251 / 255, 248 / 255, 243 / 255);

function money(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

function ascii(value: string) {
  return value
    .replace(/[\u2013\u2014\u2212]/g, "-")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[^\x20-\x7E\n]/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = ascii(text).split(" ");
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
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const pages: PDFPage[] = [];
  let page = doc.addPage([PAGE_W, PAGE_H]);
  pages.push(page);
  let y = PAGE_H;

  const newPage = () => {
    page = doc.addPage([PAGE_W, PAGE_H]);
    pages.push(page);
    page.drawRectangle({ x: 0, y: PAGE_H - 36, width: PAGE_W, height: 36, color: INK });
    page.drawRectangle({ x: 0, y: PAGE_H - 40, width: PAGE_W, height: 4, color: PRIMARY });
    page.drawText("THE FLIP FIXER", { x: MARGIN, y: PAGE_H - 24, size: 10, font: bold, color: CREAM });
    const right = `Labor estimate  #${number}`;
    page.drawText(right, {
      x: PAGE_W - MARGIN - font.widthOfTextAtSize(right, 9),
      y: PAGE_H - 23,
      size: 9,
      font,
      color: CREAM,
    });
    y = PAGE_H - 64;
  };
  const ensure = (height: number) => {
    if (y - height < FOOTER + 12) newPage();
  };
  const text = (value: string, size: number, face: PDFFont, color = INK, x = MARGIN) => {
    page.drawText(ascii(value), { x, y, size, font: face, color });
  };
  const paragraph = (value: string, size = 10, face = font, color = INK) => {
    for (const line of wrap(value, face, size, PAGE_W - MARGIN * 2)) {
      ensure(size + 4);
      text(line, size, face, color);
      y -= size + 4;
    }
  };
  const gap = (n = 10) => {
    y -= n;
  };
  const heading = (value: string) => {
    ensure(28);
    text(value, 13, bold);
    y -= 18;
  };

  page.drawRectangle({ x: 0, y: PAGE_H - 108, width: PAGE_W, height: 108, color: INK });
  page.drawRectangle({ x: 0, y: PAGE_H - 112, width: PAGE_W, height: 4, color: PRIMARY });
  page.drawRectangle({ x: MARGIN, y: PAGE_H - 78, width: 28, height: 28, color: PRIMARY });
  page.drawText("FF", { x: MARGIN + 5, y: PAGE_H - 70, size: 11, font: bold, color: CREAM });
  page.drawText("THE FLIP FIXER", { x: MARGIN + 40, y: PAGE_H - 58, size: 16, font: bold, color: CREAM });
  page.drawText("Labor and service estimate", { x: MARGIN + 40, y: PAGE_H - 76, size: 10, font, color: rgb(0.85, 0.78, 0.7) });
  const meta = `#${number}`;
  page.drawText(meta, {
    x: PAGE_W - MARGIN - bold.widthOfTextAtSize(meta, 11),
    y: PAGE_H - 58,
    size: 11,
    font: bold,
    color: CREAM,
  });
  const dateLabel = issued.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  page.drawText(dateLabel, {
    x: PAGE_W - MARGIN - font.widthOfTextAtSize(dateLabel, 9),
    y: PAGE_H - 76,
    size: 9,
    font,
    color: rgb(0.85, 0.78, 0.7),
  });
  y = PAGE_H - 136;

  paragraph(`Prepared for ${args.name}`, 12, bold);
  paragraph(`${args.phone}  ·  ${args.email}`, 10, font, MUTED);
  gap(8);
  paragraph(args.document.projectLabel, 16, bold);
  paragraph(
    [args.document.size, ...args.document.selections].filter(Boolean).join("  ·  "),
    10,
    font,
    MUTED,
  );
  gap(8);
  ensure(64);
  page.drawRectangle({ x: MARGIN, y: y - 52, width: PAGE_W - MARGIN * 2, height: 64, color: WASH });
  y -= 8;
  text(args.document.kind === "itemized" ? "Labor and services" : "Labor total", 9, font, MUTED, MARGIN + 12);
  y -= 22;
  text(
    args.document.kind === "itemized" ? money(args.document.totalCents) : "Set after the walkthrough",
    18,
    bold,
    INK,
    MARGIN + 12,
  );
  y -= 16;
  text(args.document.timeline, 9, font, MUTED, MARGIN + 12);
  y -= 26;
  paragraph(LABOR_ONLY_NOTE);
  if (args.document.rangeLabel) {
    paragraph(`The free planning range already shown on the site is ${args.document.rangeLabel}. That range is not this labor total.`);
  }
  paragraph(`You paid ${args.feeLabel} for this estimate. ${FEE_CREDIT_NOTE}`);
  paragraph("Each labor rate is that line's labor divided by its quantity, rounded to the cent. Line amounts are the scoped labor.");
  if (args.document.supplierNote) paragraph(args.document.supplierNote);

  if (args.document.kind === "itemized") {
    heading("Scope by area");
    const cols = [210, 54, 52, 72, 76];
    const headers = ["Work", "Qty", "Unit", "Rate", "Amount"];
    const drawHeader = () => {
      ensure(22);
      page.drawRectangle({ x: MARGIN, y: y - 14, width: PAGE_W - MARGIN * 2, height: 18, color: INK });
      let x = MARGIN + 6;
      headers.forEach((label, index) => {
        page.drawText(label, { x, y: y - 9, size: 8, font: bold, color: CREAM });
        x += cols[index];
      });
      y -= 20;
    };
    drawHeader();
    let area = "";
    let stripe = false;
    const paintLine = (line: LaborLine) => {
      const detail = wrap(line.detail, font, 8, cols[0] - 8);
      const height = 16 + detail.length * 10;
      if (y - height < FOOTER + 12) {
        newPage();
        drawHeader();
      }
      if (line.area !== area) {
        ensure(20);
        page.drawRectangle({ x: MARGIN, y: y - 14, width: PAGE_W - MARGIN * 2, height: 18, color: PRIMARY });
        page.drawText(ascii(line.area).toUpperCase(), { x: MARGIN + 6, y: y - 9, size: 8, font: bold, color: CREAM });
        y -= 18;
        area = line.area;
        stripe = false;
      }
      if (stripe) page.drawRectangle({ x: MARGIN, y: y - height + 4, width: PAGE_W - MARGIN * 2, height, color: ZEBRA });
      stripe = !stripe;
      let x = MARGIN + 6;
      const cells = [line.label, line.quantityLabel, line.unit, money(line.rateCents), money(line.amountCents)];
      cells.forEach((cell, index) => {
        page.drawText(ascii(cell), { x, y: y - 12, size: 9, font: index === 0 ? bold : font, color: INK });
        x += cols[index];
      });
      let dy = 24;
      for (const extra of detail) {
        page.drawText(extra, { x: MARGIN + 6, y: y - dy, size: 8, font, color: MUTED });
        dy += 10;
      }
      y -= height;
    };
    for (const line of args.document.lines) paintLine(line);
    gap(8);
    ensure(28);
    page.drawRectangle({ x: MARGIN, y: y - 20, width: PAGE_W - MARGIN * 2, height: 28, color: INK });
    page.drawText("Labor and services total", { x: MARGIN + 8, y: y - 10, size: 10, font: bold, color: CREAM });
    const total = money(args.document.totalCents);
    page.drawText(total, {
      x: PAGE_W - MARGIN - 8 - bold.widthOfTextAtSize(total, 12),
      y: y - 12,
      size: 12,
      font: bold,
      color: CREAM,
    });
    y -= 36;

    heading("Options");
    paragraph("Same finishes you picked. The other sizes use example quantities, not the measurements in your scope.");
    gap(4);
    for (const tier of args.document.tiers) {
      ensure(36);
      page.drawRectangle({
        x: MARGIN,
        y: y - 28,
        width: PAGE_W - MARGIN * 2,
        height: 34,
        color: tier.selected ? WASH : CREAM,
        borderColor: tier.selected ? PRIMARY : RULE,
        borderWidth: tier.selected ? 1.5 : 0.5,
      });
      const title = tier.selected ? `${tier.size} · your scope` : tier.size;
      page.drawText(ascii(title), { x: MARGIN + 8, y: y - 14, size: 10, font: bold, color: INK });
      const amount = money(tier.totalCents);
      page.drawText(amount, {
        x: PAGE_W - MARGIN - 8 - bold.widthOfTextAtSize(amount, 11),
        y: y - 15,
        size: 11,
        font: bold,
        color: INK,
      });
      page.drawText(ascii(`${tier.timeline} ${tier.note}`), { x: MARGIN + 8, y: y - 26, size: 8, font, color: MUTED });
      y -= 40;
    }
  } else {
    heading("Measured on the call");
    paragraph("This project does not have a standard quantity takeoff. The designer measures it, then writes the labor scope. You are not being shown a guessed total.");
  }

  const bullets = (title: string, rows: string[]) => {
    heading(title);
    for (const row of rows) paragraph(`•  ${row}`, 10, font);
    gap(4);
  };
  bullets("Included", args.document.included);
  bullets("Not included", args.document.excluded);
  bullets("Before we start", args.document.prep);
  if (args.document.answers.length) {
    heading("What you told us");
    for (const row of args.document.answers) paragraph(`${row.label}: ${row.value}`);
    gap(4);
  }
  bullets("Next steps", args.document.nextSteps);
  heading("Cabinet catalog");
  paragraph(CATALOG_BROWSE_NOTE);
  paragraph(args.catalogUrl);
  paragraph(`Questions: call ${SITE.phoneDisplay}.`);

  pages.forEach((item, index) => {
    const label = `Labor and services only  ·  ${SITE.url.replace("https://", "")}  ·  Page ${index + 1} of ${pages.length}`;
    item.drawLine({
      start: { x: MARGIN, y: 28 },
      end: { x: PAGE_W - MARGIN, y: 28 },
      thickness: 0.4,
      color: RULE,
    });
    item.drawText(label, { x: MARGIN, y: 16, size: 8, font, color: MUTED });
  });
  return doc.save();
}
