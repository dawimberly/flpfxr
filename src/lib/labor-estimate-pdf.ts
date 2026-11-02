import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { SITE } from "./site.ts";
import { PRELIMINARY_ESTIMATE_WORDING } from "./public-pricing.ts";
import { perUnitNoun, type LaborDocument, type LaborLine } from "./labor-estimate.ts";

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 46;
const FOOTER = 36;
const CONTENT_W = PAGE_W - MARGIN * 2;
const INK = rgb(18 / 255, 52 / 255, 59 / 255);
const CREAM = rgb(244 / 255, 241 / 255, 236 / 255);
const PRIMARY = rgb(196 / 255, 92 / 255, 38 / 255);
const MUTED = rgb(91 / 255, 110 / 255, 115 / 255);
const RULE = rgb(213 / 255, 221 / 255, 223 / 255);
const WASH = rgb(232 / 255, 239 / 255, 239 / 255);
const ZEBRA = rgb(251 / 255, 248 / 255, 243 / 255);
const WHITE = rgb(1, 1, 1);

/** Paths copied from public/logo.svg so the mark stays the site logo. */
const LOGO_WHITE =
  "213.29 144.95 199.1 159.15 184.9 144.95 176.25 136.3 158.16 118.21 118.46 118.21 136.54 136.3 145.19 144.95 163.28 163.04 179.24 179 159.39 198.85 141.75 216.49 88.29 163.04 70.2 144.95 27.78 144.95 45.87 163.04 68.41 185.58 68.41 226.27 91.23 226.27 91.23 208.4 141.75 258.92 237.63 163.04 255.72 144.95 213.29 144.95";
const LOGO_ORANGE =
  "237.63 118.21 215.28 95.86 215.28 55.04 192.46 55.04 192.46 73.04 141.75 22.33 45.87 118.21 27.78 136.3 70.21 136.3 83.52 122.98 96.84 136.3 105.49 144.95 123.57 163.04 163.28 163.04 145.19 144.95 136.54 136.3 118.46 118.21 103.37 103.13 123.23 83.28 141.75 64.76 195.21 118.21 213.29 136.3 255.72 136.3 237.63 118.21";

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

function logoPath(points: string, x: number, top: number, size: number) {
  const nums = points.split(/\s+/).map(Number);
  const sx = size / 283.5;
  const sy = size / 281.25;
  let path = "";
  for (let i = 0; i < nums.length; i += 2) {
    const px = x + nums[i] * sx;
    const py = top - nums[i + 1] * sy;
    path += `${i === 0 ? "M" : "L"} ${px.toFixed(2)} ${py.toFixed(2)} `;
  }
  return `${path}Z`;
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

  const drawLogo = (x: number, top: number, size: number) => {
    page.drawSvgPath(logoPath(LOGO_ORANGE, x, top, size), { x: 0, y: 0, color: PRIMARY });
    page.drawSvgPath(logoPath(LOGO_WHITE, x, top, size), { x: 0, y: 0, color: WHITE });
  };

  const newPage = () => {
    page = doc.addPage([PAGE_W, PAGE_H]);
    pages.push(page);
    page.drawRectangle({ x: 0, y: PAGE_H - 32, width: PAGE_W, height: 32, color: INK });
    page.drawRectangle({ x: 0, y: PAGE_H - 36, width: PAGE_W, height: 4, color: PRIMARY });
    drawLogo(MARGIN, PAGE_H - 4, 24);
    page.drawText("THE FLIP FIXER", { x: MARGIN + 30, y: PAGE_H - 22, size: 9, font: bold, color: CREAM });
    const right = `Labor estimate  #${number}`;
    page.drawText(right, {
      x: PAGE_W - MARGIN - font.widthOfTextAtSize(right, 8),
      y: PAGE_H - 21,
      size: 8,
      font,
      color: CREAM,
    });
    y = PAGE_H - 56;
  };
  const ensure = (height: number) => {
    if (y - height < FOOTER + 8) newPage();
  };
  const textAt = (value: string, x: number, baseline: number, size: number, face: PDFFont, color = INK) => {
    page.drawText(ascii(value), { x, y: baseline, size, font: face, color });
  };
  const paragraph = (value: string, size = 10, face = font, color = INK) => {
    for (const line of wrap(value, face, size, CONTENT_W)) {
      ensure(size + 4);
      textAt(line, MARGIN, y, size, face, color);
      y -= size + 4;
    }
  };
  const gap = (n = 8) => {
    y -= n;
  };
  const heading = (value: string) => {
    ensure(22);
    textAt(value, MARGIN, y, 12, bold);
    y -= 16;
  };

  page.drawRectangle({ x: 0, y: PAGE_H - 108, width: PAGE_W, height: 108, color: INK });
  page.drawRectangle({ x: 0, y: PAGE_H - 112, width: PAGE_W, height: 4, color: PRIMARY });
  drawLogo(MARGIN, PAGE_H - 18, 72);
  page.drawText("THE FLIP FIXER", { x: MARGIN + 84, y: PAGE_H - 42, size: 16, font: bold, color: CREAM });
  page.drawText(SITE.phoneDisplay, { x: MARGIN + 84, y: PAGE_H - 58, size: 9, font, color: CREAM });
  page.drawText(SITE.email, { x: MARGIN + 84, y: PAGE_H - 72, size: 9, font, color: CREAM });
  page.drawText("theflipfixer.com", { x: MARGIN + 84, y: PAGE_H - 86, size: 9, font, color: CREAM });
  page.drawText("Insurance claim specialists", { x: MARGIN + 84, y: PAGE_H - 102, size: 8, font: bold, color: PRIMARY });
  const coverTitle = "Labor estimate";
  page.drawText(coverTitle, {
    x: PAGE_W - MARGIN - bold.widthOfTextAtSize(coverTitle, 12),
    y: PAGE_H - 46,
    size: 12,
    font: bold,
    color: CREAM,
  });
  const meta = `#${number}`;
  page.drawText(meta, {
    x: PAGE_W - MARGIN - font.widthOfTextAtSize(meta, 9),
    y: PAGE_H - 62,
    size: 9,
    font,
    color: CREAM,
  });
  const dateLabel = issued.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  page.drawText(dateLabel, {
    x: PAGE_W - MARGIN - font.widthOfTextAtSize(dateLabel, 8),
    y: PAGE_H - 76,
    size: 8,
    font,
    color: rgb(0.85, 0.78, 0.7),
  });
  y = PAGE_H - 132;

  paragraph(`Prepared for ${args.name}`, 12, bold);
  paragraph(`${args.phone}  ·  ${args.email}`, 10, font, MUTED);
  gap(6);
  paragraph(args.document.projectLabel, 16, bold);
  const subtitle = [args.document.size, ...args.document.selections].filter(Boolean).join(" · ");
  if (subtitle) paragraph(subtitle, 10, font, MUTED);
  paragraph(
    args.document.usesExampleQuantities
      ? `Quantities follow a typical ${args.document.size.toLowerCase() || "project"} size. We confirm them on site.`
      : "Quantities are based on the numbers you entered. We confirm them on site.",
    9,
    font,
    MUTED,
  );
  gap(8);

  ensure(78);
  page.drawRectangle({ x: MARGIN, y: y - 70, width: CONTENT_W, height: 70, color: WASH });
  textAt(args.document.kind === "itemized" ? "Labor and services" : "Labor total", MARGIN + 14, y - 16, 9, font, MUTED);
  textAt(
    args.document.kind === "itemized" ? money(args.document.totalCents) : "Set after the walkthrough",
    MARGIN + 14,
    y - 38,
    20,
    bold,
  );
  textAt(args.document.timeline, MARGIN + 14, y - 56, 9, font, MUTED);
  y -= 82;
  if (args.document.rangeLabel) {
    paragraph(`This total is labor and services. The free range on the site (${args.document.rangeLabel}) also includes materials and cabinets.`);
  } else {
    paragraph("This total is labor and services. Material prices are not included.");
  }
  if (args.document.supplierNote) paragraph(args.document.supplierNote, 9, font, MUTED);

  heading("How the work moves");
  const phases = [
    ["1", "Demo", "Remove what is coming out."],
    ["2", "Prep", "Protect the room and set the layout."],
    ["3", "Install", "Set the work in the table."],
    ["4", "Finish", "Walk the job with you."],
  ];
  const phaseW = (CONTENT_W - 18) / 4;
  ensure(58);
  phases.forEach((phase, index) => {
    const x = MARGIN + index * (phaseW + 6);
    page.drawRectangle({ x, y: y - 54, width: phaseW, height: 54, color: index === 3 ? WASH : CREAM, borderColor: RULE, borderWidth: 0.6 });
    textAt(phase[0], x + 8, y - 16, 8, bold, PRIMARY);
    textAt(phase[1], x + 20, y - 16, 10, bold);
    for (const [lineIndex, line] of wrap(phase[2], font, 8, phaseW - 16).entries()) {
      textAt(line, x + 8, y - 30 - lineIndex * 10, 8, font, MUTED);
    }
  });
  y -= 64;

  if (args.document.kind === "itemized") {
    heading("Scope by area");
    const cols = [248, 46, 122, 100];
    const headers = ["Work", "Qty", "Per unit", "Amount"];
    const drawHeader = () => {
      ensure(18);
      page.drawRectangle({ x: MARGIN, y: y - 12, width: CONTENT_W, height: 16, color: INK });
      let x = MARGIN + 6;
      headers.forEach((label, index) => {
        const width = bold.widthOfTextAtSize(label, 8);
        const rightAligned = index >= 2;
        const left = rightAligned ? x + cols[index] - width - 8 : x;
        textAt(label, left, y - 8, 8, bold, CREAM);
        x += cols[index];
      });
      y -= 16;
    };
    drawHeader();
    let area = "";
    let stripe = false;
    const areaTotal = (name: string) =>
      args.document.lines.filter((line) => line.area === name).reduce((sum, line) => sum + line.amountCents, 0);
    const paintLine = (line: LaborLine) => {
      const labelLines = wrap(line.label, bold, 9, cols[0] - 12);
      const detailLines = wrap(line.detail, font, 8, cols[0] - 12);
      const rowH = 8 + labelLines.length * 11 + (detailLines.length ? 2 + detailLines.length * 10 : 0) + 6;
      const needsHeader = line.area !== area;
      const block = rowH + (needsHeader ? 18 : 0);
      if (y - block < FOOTER + 10) {
        newPage();
        drawHeader();
        area = "";
      }
      if (line.area !== area) {
        page.drawRectangle({ x: MARGIN, y: y - 14, width: CONTENT_W, height: 16, color: PRIMARY });
        textAt(line.area.toUpperCase(), MARGIN + 6, y - 10, 8, bold, CREAM);
        const sub = money(areaTotal(line.area));
        textAt(sub, PAGE_W - MARGIN - 8 - bold.widthOfTextAtSize(sub, 8), y - 10, 8, bold, CREAM);
        y -= 16;
        area = line.area;
        stripe = false;
      }
      const bottom = y - rowH;
      if (stripe) page.drawRectangle({ x: MARGIN, y: bottom, width: CONTENT_W, height: rowH, color: ZEBRA });
      stripe = !stripe;
      let baseline = y - 12;
      for (const label of labelLines) {
        textAt(label, MARGIN + 6, baseline, 9, bold);
        baseline -= 11;
      }
      baseline -= 1;
      for (const extra of detailLines) {
        textAt(extra, MARGIN + 6, baseline, 8, font, MUTED);
        baseline -= 10;
      }
      const mid = y - 12;
      textAt(line.quantityLabel, MARGIN + cols[0] + 4, mid, 9, font);
      const perUnit = `${money(line.rateCents)} / ${perUnitNoun(line.unit)}`;
      const perX = MARGIN + cols[0] + cols[1] + cols[2] - font.widthOfTextAtSize(perUnit, 8) - 8;
      textAt(perUnit, perX, mid, 8, font);
      const amount = money(line.amountCents);
      textAt(amount, PAGE_W - MARGIN - 8 - font.widthOfTextAtSize(amount, 9), mid, 9, font);
      y = bottom;
    };
    for (const line of args.document.lines) paintLine(line);
    gap(8);
    ensure(26);
    page.drawRectangle({ x: MARGIN, y: y - 16, width: CONTENT_W, height: 24, color: INK });
    textAt("Labor and services total", MARGIN + 8, y - 8, 10, bold, CREAM);
    const total = money(args.document.totalCents);
    textAt(total, PAGE_W - MARGIN - 8 - bold.widthOfTextAtSize(total, 12), y - 9, 12, bold, CREAM);
    y -= 32;

    if (args.document.tiers.length) {
      heading("Other sizes");
      paragraph("Same finishes. Other sizes use a typical quantity, not the numbers in this estimate.");
      gap(2);
      for (const tier of args.document.tiers) {
        ensure(32);
        page.drawRectangle({
          x: MARGIN,
          y: y - 22,
          width: CONTENT_W,
          height: 28,
          color: tier.selected ? WASH : CREAM,
          borderColor: tier.selected ? PRIMARY : RULE,
          borderWidth: tier.selected ? 1.2 : 0.4,
        });
        textAt(tier.selected ? `${tier.size} · this estimate` : tier.size, MARGIN + 8, y - 6, 10, bold);
        const amount = money(tier.totalCents);
        textAt(amount, PAGE_W - MARGIN - 8 - bold.widthOfTextAtSize(amount, 11), y - 6, 11, bold);
        textAt(tier.selected ? "Quantities in this estimate." : "Typical size, same finishes.", MARGIN + 8, y - 18, 8, font, MUTED);
        y -= 34;
      }
    }
  } else {
    heading("Measured on the call");
    paragraph("This project does not have a standard quantity takeoff. We measure it, then write the labor scope. There is no guessed total.");
  }

  heading("Included");
  for (const row of args.document.included) paragraph(row, 10, font);
  gap(4);
  heading("Not included");
  for (const row of args.document.excluded) paragraph(`•  ${row}`, 10, font);
  gap(4);
  heading("Before we start");
  for (const row of args.document.prep) paragraph(`•  ${row}`, 10, font);
  if (args.document.answers.length) {
    gap(2);
    heading("What you told us");
    for (const row of args.document.answers) paragraph(`${row.label}: ${row.value}`, 10, font);
  }

  gap(6);
  ensure(70);
  page.drawRectangle({ x: MARGIN, y: y - 64, width: CONTENT_W, height: 64, color: WASH });
  textAt("Payment", MARGIN + 12, y - 16, 11, bold);
  textAt("50% deposit to begin. Balance on completion.", MARGIN + 12, y - 32, 10, font);
  textAt(`${args.feeLabel} is credited toward the job if you book.`, MARGIN + 12, y - 46, 10, font);
  y -= 76;

  ensure(78);
  page.drawRectangle({ x: MARGIN, y: y - 72, width: CONTENT_W, height: 72, color: INK });
  textAt("Book your designer call", MARGIN + 12, y - 18, 13, bold, CREAM);
  textAt("We'll finalize cabinets, fillers, toe kick, and baseboard with you.", MARGIN + 12, y - 34, 9, font, CREAM);
  textAt(SITE.phoneDisplay, MARGIN + 12, y - 50, 12, bold, PRIMARY);
  textAt("theflipfixer.com/contact", MARGIN + 12, y - 64, 10, font, CREAM);
  y -= 84;
  paragraph("Browse finishes in the catalog. We order materials with you after the call.");
  paragraph(args.catalogUrl, 9, font, MUTED);
  gap(8);
  paragraph(PRELIMINARY_ESTIMATE_WORDING, 9, bold);

  pages.forEach((item, index) => {
    const label = `Labor and services only  ·  ${SITE.phoneDisplay}  ·  theflipfixer.com  ·  ${index + 1} of ${pages.length}`;
    item.drawLine({
      start: { x: MARGIN, y: 26 },
      end: { x: PAGE_W - MARGIN, y: 26 },
      thickness: 0.4,
      color: RULE,
    });
    item.drawText(ascii(label), { x: MARGIN, y: 14, size: 8, font, color: MUTED });
  });
  return doc.save();
}
