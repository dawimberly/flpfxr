import { PDFDocument, PDFName, PDFString, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import { SITE } from "./site.ts";
import { PRELIMINARY_ESTIMATE_WORDING } from "./public-pricing.ts";
import { FLIPFIXER_LOGO_PNG_BASE64 } from "./flipfixer-logo.ts";
import type { LaborDocument, LaborLine } from "./labor-estimate.ts";

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

function installSteps(lines: LaborLine[]): string {
  const has = (pattern: RegExp) => lines.some((line) => pattern.test(line.label));
  const parts: string[] = [];
  if (has(/cabinet|vanity|refrigerator/i)) parts.push("cabinets");
  if (has(/countertop/i)) parts.push("counters");
  if (has(/backsplash/i)) parts.push("backsplash");
  if (has(/floor installation/i)) parts.push("floor");
  if (has(/shower wall/i)) parts.push("shower");
  if (has(/trim/i)) parts.push("trim");
  if (has(/paint|primer/i)) parts.push("paint");
  if (has(/fixture|valve/i)) parts.push("fixtures");
  if (!parts.length) return "Set the work in this estimate.";
  const label = parts.join(", ");
  return label.charAt(0).toUpperCase() + label.slice(1) + ".";
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
  let logo: PDFImage | null = null;
  try {
    logo = await doc.embedPng(Buffer.from(FLIPFIXER_LOGO_PNG_BASE64, "base64"));
  } catch {
    logo = null;
  }
  const pages: PDFPage[] = [];
  let page = doc.addPage([PAGE_W, PAGE_H]);
  pages.push(page);
  let y = PAGE_H;

  const drawLogo = (x: number, top: number, height: number) => {
    if (logo) {
      const width = height * (logo.width / logo.height);
      page.drawImage(logo, { x, y: top - height, width, height });
      return width;
    }
    page.drawRectangle({ x, y: top - height, width: height, height, color: PRIMARY });
    const mark = "FF";
    const markSize = Math.max(7, height * 0.38);
    const markW = bold.widthOfTextAtSize(mark, markSize);
    page.drawText(mark, {
      x: x + (height - markW) / 2,
      y: top - height * 0.66,
      size: markSize,
      font: bold,
      color: CREAM,
    });
    return height;
  };

  const linkAnnots: ReturnType<typeof doc.context.register>[] = [];
  const addLink = (x: number, bottom: number, width: number, height: number, url: string) => {
    const annot = doc.context.obj({
      Type: "Annot",
      Subtype: "Link",
      Rect: [x, bottom, x + width, bottom + height],
      Border: [0, 0, 0],
      A: { Type: "Action", S: "URI", URI: PDFString.of(url) },
    });
    linkAnnots.push(doc.context.register(annot));
  };

  const newPage = () => {
    page = doc.addPage([PAGE_W, PAGE_H]);
    pages.push(page);
    page.drawRectangle({ x: 0, y: PAGE_H - 32, width: PAGE_W, height: 32, color: INK });
    page.drawRectangle({ x: 0, y: PAGE_H - 36, width: PAGE_W, height: 4, color: PRIMARY });
    const markW = drawLogo(MARGIN, PAGE_H - 5, 22);
    page.drawText("THE FLIP FIXER", { x: MARGIN + markW + 8, y: PAGE_H - 22, size: 9, font: bold, color: CREAM });
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
  const coverMark = drawLogo(MARGIN, PAGE_H - 22, 68);
  const coverX = MARGIN + coverMark + 14;
  page.drawText("THE FLIP FIXER", { x: coverX, y: PAGE_H - 42, size: 16, font: bold, color: CREAM });
  page.drawText(SITE.phoneDisplay, { x: coverX, y: PAGE_H - 58, size: 9, font, color: CREAM });
  page.drawText(SITE.email, { x: coverX, y: PAGE_H - 72, size: 9, font, color: CREAM });
  page.drawText("theflipfixer.com", { x: coverX, y: PAGE_H - 86, size: 9, font, color: CREAM });
  page.drawText("Insurance claim specialists", { x: coverX, y: PAGE_H - 102, size: 8, font: bold, color: PRIMARY });
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
  gap(14);

  heading("How the work moves");
  const hasDemo = args.document.lines.some((line) => /demolition/i.test(line.label));
  const phases = [
    ["1", "Demo", hasDemo ? "Remove the finishes coming out." : "Protect what is staying."],
    ["2", "Prep", "Protect the room and set the layout."],
    ["3", "Install", installSteps(args.document.lines)],
    ["4", "Finish", "Walk the job with you."],
  ];
  const phaseW = (CONTENT_W - 18) / 4;
  const phaseLines = phases.map((phase) => wrap(phase[2], font, 8, phaseW - 16));
  const phaseH = 26 + Math.max(...phaseLines.map((lines) => lines.length)) * 10;
  ensure(phaseH + 8);
  phases.forEach((phase, index) => {
    const x = MARGIN + index * (phaseW + 6);
    page.drawRectangle({ x, y: y - phaseH, width: phaseW, height: phaseH, color: index === 3 ? WASH : CREAM, borderColor: RULE, borderWidth: 0.6 });
    textAt(phase[0], x + 8, y - 16, 8, bold, PRIMARY);
    textAt(phase[1], x + 20, y - 16, 10, bold);
    for (const [lineIndex, line] of phaseLines[index].entries()) {
      textAt(line, x + 8, y - 30 - lineIndex * 10, 8, font, MUTED);
    }
  });
  y -= phaseH + 12;

  if (args.document.kind === "itemized") {
    heading("Scope by area");
    const cols = [360, 70, 90];
    const headers = ["Work", "Qty", "Amount"];
    const drawHeader = () => {
      ensure(18);
      page.drawRectangle({ x: MARGIN, y: y - 12, width: CONTENT_W, height: 16, color: INK });
      let x = MARGIN + 6;
      headers.forEach((label, index) => {
        const width = bold.widthOfTextAtSize(label, 8);
        const rightAligned = index >= 1;
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
      const qty = `${line.quantityLabel} ${line.unit}`;
      textAt(qty, MARGIN + cols[0] + cols[1] - font.widthOfTextAtSize(qty, 8) - 8, mid, 8, font);
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
  gap(6);
  const buttonLabel = "Browse the cabinet catalog";
  const buttonW = Math.min(CONTENT_W, bold.widthOfTextAtSize(buttonLabel, 11) + 36);
  const buttonH = 28;
  ensure(buttonH + 6);
  const buttonPage = page;
  page.drawRectangle({ x: MARGIN, y: y - buttonH, width: buttonW, height: buttonH, color: PRIMARY });
  const buttonTextW = bold.widthOfTextAtSize(buttonLabel, 11);
  textAt(buttonLabel, MARGIN + (buttonW - buttonTextW) / 2, y - buttonH + 9, 11, bold, WHITE);
  addLink(MARGIN, y - buttonH, buttonW, buttonH, args.catalogUrl);
  y -= buttonH + 16;

  heading("Why us");
  paragraph("We are insurance claim specialists, with a decade handling claims. We design the work and we build it.");
  gap(10);
  let boxH = y - FOOTER - 52;
  if (boxH > 340) boxH = 340;
  if (boxH < 150) {
    newPage();
    boxH = 280;
  }
  const boxBottom = y - boxH;
  page.drawRectangle({
    x: MARGIN,
    y: boxBottom,
    width: CONTENT_W,
    height: boxH,
    color: CREAM,
    borderColor: RULE,
    borderWidth: 0.8,
  });
  textAt("Acceptance", MARGIN + 14, y - 20, 12, bold);
  textAt("Sign if you want this labor scope held for the designer call.", MARGIN + 14, y - 38, 9, font, MUTED);
  textAt("Name", MARGIN + 14, y - 68, 9, font, MUTED);
  page.drawLine({ start: { x: MARGIN + 52, y: y - 72 }, end: { x: MARGIN + 280, y: y - 72 }, thickness: 0.7, color: INK });
  textAt("Date", MARGIN + 300, y - 68, 9, font, MUTED);
  page.drawLine({ start: { x: MARGIN + 330, y: y - 72 }, end: { x: PAGE_W - MARGIN - 14, y: y - 72 }, thickness: 0.7, color: INK });
  textAt("Signature", MARGIN + 14, boxBottom + 40, 9, font, MUTED);
  page.drawLine({
    start: { x: MARGIN + 72, y: boxBottom + 36 },
    end: { x: PAGE_W - MARGIN - 14, y: boxBottom + 36 },
    thickness: 0.7,
    color: INK,
  });
  y = boxBottom - 16;
  paragraph(PRELIMINARY_ESTIMATE_WORDING, 9, bold);

  if (linkAnnots.length) {
    buttonPage.node.set(PDFName.of("Annots"), doc.context.obj(linkAnnots));
  }

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
