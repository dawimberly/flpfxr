import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import {
  COMPANY,
  PRICE_AS_OF,
  PRICE_LIST,
  type ClientInfo,
  type JobEstimate,
} from "@/lib/estimator";
import { TRADE_NOTE, costPerItemRows, tradeTotals } from "@/lib/trade-groups";

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 48;
const FOOTER = 36;

const INK = rgb(18 / 255, 52 / 255, 59 / 255);
const CREAM = rgb(244 / 255, 241 / 255, 236 / 255);
const PRIMARY = rgb(196 / 255, 92 / 255, 38 / 255);
const MUTED = rgb(91 / 255, 110 / 255, 115 / 255);
const RULE = rgb(213 / 255, 221 / 255, 223 / 255);
const WASH = rgb(232 / 255, 239 / 255, 239 / 255);
const ZEBRA = rgb(251 / 255, 248 / 255, 243 / 255);

export type EstimatePdfKind = "contractor" | "customer";

function money(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function ascii(value: string) {
  return value
    .replace(/[—–]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/×/g, "x")
    .replace(/\s+/g, " ")
    .trim();
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = ascii(text).split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      current = next;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function estimateNumber(issued: Date) {
  return `${issued.getFullYear()}${String(issued.getMonth() + 1).padStart(2, "0")}${String(issued.getDate()).padStart(2, "0")}`;
}

function fileSlug(value: string) {
  const slug = ascii(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "estimate";
}

export function estimatePdfFilename(client: ClientInfo, kind: EstimatePdfKind, issued = new Date()) {
  const label = client.propertyName || client.propertyAddress || client.name || "estimate";
  const suffix = kind === "customer" ? "-customer" : "-contractor";
  return `Flip-Fixer-${fileSlug(label)}${suffix}-${estimateNumber(issued)}.pdf`;
}

type Col = { key: string; label: string; width: number; align?: "left" | "right" };

class PdfWriter {
  doc: PDFDocument;
  page!: PDFPage;
  font!: PDFFont;
  bold!: PDFFont;
  y = PAGE_H;
  issued: Date;
  estimateNo: string;
  coverTitle: string;
  footerNote: string;

  constructor(doc: PDFDocument, issued: Date, coverTitle: string, footerNote: string) {
    this.doc = doc;
    this.issued = issued;
    this.estimateNo = estimateNumber(issued);
    this.coverTitle = coverTitle;
    this.footerNote = footerNote;
  }

  async init() {
    this.font = await this.doc.embedFont(StandardFonts.Helvetica);
    this.bold = await this.doc.embedFont(StandardFonts.HelveticaBold);
    this.newPage(true);
  }

  newPage(first = false) {
    this.page = this.doc.addPage([PAGE_W, PAGE_H]);
    if (first) {
      this.drawCoverBar();
      this.y = PAGE_H - 118;
    } else {
      this.drawInnerHeader();
      this.y = PAGE_H - 78;
    }
  }

  ensure(height: number) {
    if (this.y - height < FOOTER + 16) this.newPage();
  }

  drawCoverBar() {
    this.page.drawRectangle({ x: 0, y: PAGE_H - 92, width: PAGE_W, height: 92, color: INK });
    this.page.drawRectangle({ x: 0, y: PAGE_H - 96, width: PAGE_W, height: 4, color: PRIMARY });
    this.page.drawRectangle({ x: MARGIN, y: PAGE_H - 70, width: 28, height: 28, color: PRIMARY });
    this.page.drawText("FF", {
      x: MARGIN + 5,
      y: PAGE_H - 62,
      size: 11,
      font: this.bold,
      color: CREAM,
    });
    this.page.drawText(COMPANY.name.toUpperCase(), {
      x: MARGIN + 40,
      y: PAGE_H - 50,
      size: 16,
      font: this.bold,
      color: CREAM,
    });
    this.page.drawText(COMPANY.tagline, {
      x: MARGIN + 40,
      y: PAGE_H - 66,
      size: 9,
      font: this.font,
      color: rgb(0.85, 0.78, 0.7),
    });
    const rw = this.bold.widthOfTextAtSize(this.coverTitle, 11);
    this.page.drawText(this.coverTitle, {
      x: PAGE_W - MARGIN - rw,
      y: PAGE_H - 48,
      size: 11,
      font: this.bold,
      color: CREAM,
    });
    const meta = `#${this.estimateNo}`;
    const mw = this.font.widthOfTextAtSize(meta, 9);
    this.page.drawText(meta, {
      x: PAGE_W - MARGIN - mw,
      y: PAGE_H - 64,
      size: 9,
      font: this.font,
      color: rgb(0.85, 0.78, 0.7),
    });
  }

  drawInnerHeader() {
    this.page.drawRectangle({ x: 0, y: PAGE_H - 44, width: PAGE_W, height: 44, color: INK });
    this.page.drawRectangle({ x: 0, y: PAGE_H - 48, width: PAGE_W, height: 4, color: PRIMARY });
    this.page.drawText(COMPANY.name, {
      x: MARGIN,
      y: PAGE_H - 30,
      size: 11,
      font: this.bold,
      color: CREAM,
    });
    const right = `${this.coverTitle}  #${this.estimateNo}`;
    const rw = this.font.widthOfTextAtSize(right, 9);
    this.page.drawText(right, {
      x: PAGE_W - MARGIN - rw,
      y: PAGE_H - 30,
      size: 9,
      font: this.font,
      color: CREAM,
    });
  }

  stampFooters() {
    const pages = this.doc.getPages();
    const total = pages.length;
    pages.forEach((page, index) => {
      const label = `${this.footerNote}  ·  Page ${index + 1} of ${total}`;
      const width = this.font.widthOfTextAtSize(label, 8);
      page.drawLine({
        start: { x: MARGIN, y: 28 },
        end: { x: PAGE_W - MARGIN, y: 28 },
        thickness: 0.5,
        color: RULE,
      });
      page.drawText(label, {
        x: (PAGE_W - width) / 2,
        y: 16,
        size: 8,
        font: this.font,
        color: MUTED,
      });
    });
  }

  text(value: string, x: number, size: number, font: PDFFont, color = INK) {
    this.page.drawText(ascii(value), { x, y: this.y, size, font, color });
  }

  kicker(value: string) {
    this.ensure(28);
    this.y -= 6;
    this.text(value.toUpperCase(), MARGIN, 8, this.bold, PRIMARY);
    this.y -= 14;
  }

  paragraph(value: string, size = 9, color = INK, maxWidth = PAGE_W - MARGIN * 2) {
    const lines = wrap(value, this.font, size, maxWidth);
    for (const line of lines) {
      this.ensure(size + 4);
      this.text(line, MARGIN, size, this.font, color);
      this.y -= size + 3;
    }
  }

  drawPartyCard(job: JobEstimate, client: ClientInfo, issuedLabel: string) {
    const leftLines = [
      client.name || "Client name TBD",
      client.address,
      client.phone,
      client.email,
    ].filter(Boolean);
    const floorTotal = job.rooms.reduce((sum, entry) => sum + entry.scan.floorArea, 0);
    const rightLines = [
      client.propertyName || "Subject property",
      client.propertyAddress,
      `${job.rooms.length} ${job.rooms.length === 1 ? "room" : "rooms"}  ·  Floor ${floorTotal.toFixed(0)} sq ft`,
      `Issued ${issuedLabel}  ·  Valid 30 days`,
    ].filter(Boolean);
    const rows = Math.max(leftLines.length, rightLines.length);
    const boxH = 28 + rows * 12;
    this.ensure(boxH + 12);
    this.page.drawRectangle({
      x: MARGIN,
      y: this.y - boxH + 10,
      width: PAGE_W - MARGIN * 2,
      height: boxH,
      color: WASH,
    });
    this.y -= 12;
    this.page.drawText("PREPARED FOR", {
      x: MARGIN + 12,
      y: this.y,
      size: 7,
      font: this.bold,
      color: MUTED,
    });
    this.page.drawText("PROPERTY", {
      x: 330,
      y: this.y,
      size: 7,
      font: this.bold,
      color: MUTED,
    });
    this.y -= 14;
    for (let i = 0; i < rows; i += 1) {
      if (leftLines[i]) {
        this.page.drawText(ascii(leftLines[i]), {
          x: MARGIN + 12,
          y: this.y,
          size: 9,
          font: i === 0 ? this.bold : this.font,
          color: INK,
        });
      }
      if (rightLines[i]) {
        this.page.drawText(ascii(rightLines[i]), {
          x: 330,
          y: this.y,
          size: 9,
          font: i === 0 ? this.bold : this.font,
          color: INK,
        });
      }
      this.y -= 12;
    }
    this.y -= 16;
  }

  table(cols: Col[], rows: string[][]) {
    const headerH = 18;
    const rowH = 16;
    const startX = MARGIN;
    const totalW = cols.reduce((sum, col) => sum + col.width, 0);

    const drawHeader = () => {
      this.ensure(headerH + 8);
      this.page.drawRectangle({
        x: startX,
        y: this.y - headerH + 4,
        width: totalW,
        height: headerH,
        color: INK,
      });
      let x = startX;
      for (const col of cols) {
        const label = col.label;
        const size = 8;
        const tw = this.bold.widthOfTextAtSize(label, size);
        const tx = col.align === "right" ? x + col.width - 6 - tw : x + 6;
        this.page.drawText(label, {
          x: tx,
          y: this.y - 8,
          size,
          font: this.bold,
          color: CREAM,
        });
        x += col.width;
      }
      this.y -= headerH;
    };

    drawHeader();

    rows.forEach((row, index) => {
      const wrapped = row.map((cell, i) => wrap(cell, this.font, 8, cols[i].width - 12));
      const lines = Math.max(...wrapped.map((w) => w.length), 1);
      const height = Math.max(rowH, lines * 11 + 6);
      if (this.y - height < FOOTER + 16) {
        this.newPage();
        drawHeader();
      }
      if (index % 2) {
        this.page.drawRectangle({
          x: startX,
          y: this.y - height + 4,
          width: totalW,
          height: height,
          color: ZEBRA,
        });
      }
      let x = startX;
      wrapped.forEach((cellLines, i) => {
        const col = cols[i];
        cellLines.forEach((line, li) => {
          const tw = this.font.widthOfTextAtSize(line, 8);
          const tx = col.align === "right" ? x + col.width - 6 - tw : x + 6;
          this.page.drawText(line, {
            x: tx,
            y: this.y - 8 - li * 11,
            size: 8,
            font: this.font,
            color: INK,
          });
        });
        x += col.width;
      });
      this.y -= height;
    });
    this.y -= 8;
  }

  drawTotalBox(job: JobEstimate, breakdown: boolean) {
    const boxW = 220;
    const boxH = breakdown ? 70 : 52;
    this.ensure(boxH + 16);
    const boxX = PAGE_W - MARGIN - boxW;
    this.page.drawRectangle({
      x: boxX,
      y: this.y - boxH + 8,
      width: boxW,
      height: boxH,
      color: INK,
    });
    this.page.drawRectangle({
      x: boxX,
      y: this.y - boxH + 8,
      width: 4,
      height: boxH,
      color: PRIMARY,
    });
    const write = (label: string, value: string, yOff: number, big = false) => {
      this.page.drawText(label, {
        x: boxX + 14,
        y: this.y - yOff,
        size: big ? 10 : 8,
        font: this.font,
        color: CREAM,
      });
      const tw = (big ? this.bold : this.font).widthOfTextAtSize(value, big ? 16 : 9);
      this.page.drawText(value, {
        x: boxX + boxW - 12 - tw,
        y: this.y - yOff - (big ? 2 : 0),
        size: big ? 16 : 9,
        font: big ? this.bold : this.font,
        color: big ? PRIMARY : CREAM,
      });
    };
    if (breakdown) {
      write("Installed", money(job.materialsSubtotal), 10);
      write("Overhead & profit", money(job.laborSubtotal), 24);
      write("Grand total", money(job.grandTotal), 46, true);
      this.y -= boxH + 4;
      return;
    }
    write("Job total", money(job.grandTotal), 28, true);
    this.y -= boxH + 4;
  }
}

async function startPdf(job: JobEstimate, client: ClientInfo, kind: EstimatePdfKind) {
  const issued = new Date();
  const doc = await PDFDocument.create();
  const customer = kind === "customer";
  doc.setTitle(`${COMPANY.name} ${customer ? "customer copy" : "contractor PDF"}`);
  doc.setAuthor(COMPANY.name);
  doc.setSubject(client.propertyName || client.propertyAddress || "Contractor PDF");
  doc.setCreator(COMPANY.name);
  const pdf = new PdfWriter(
    doc,
    issued,
    customer ? "CUSTOMER COPY" : "CONTRACTOR PDF",
    customer ? `${COMPANY.web}  ·  Customer copy` : `${COMPANY.web}  ·  ${PRICE_LIST}`,
  );
  await pdf.init();
  const issuedLabel = issued.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  pdf.drawPartyCard(job, client, issuedLabel);
  return { pdf, doc, issued };
}

function writeRoomMeasurements(pdf: PdfWriter, job: JobEstimate["rooms"][number]) {
  pdf.paragraph(
    `${job.typeName}  ·  ${job.room.lengthFt} x ${job.room.widthFt} x ${job.room.heightFt} ft  ·  Floor ${job.scan.floorArea.toFixed(0)} sq ft  ·  Walls ${job.scan.wallArea.toFixed(0)} sq ft  ·  Perimeter ${job.scan.perimeter.toFixed(0)} lf`,
    8,
    MUTED,
  );
}

function writeTradeSections(pdf: PdfWriter, job: JobEstimate, kind: EstimatePdfKind) {
  const trades = tradeTotals(job);
  const items = costPerItemRows(job.completeLineItems);

  pdf.kicker("By trade");
  if (kind === "contractor") {
    pdf.table(
      [
        { key: "t", label: "Trade", width: 160 },
        { key: "i", label: "Installed", width: 110, align: "right" },
        { key: "o", label: "O&P", width: 100, align: "right" },
        { key: "a", label: "Total", width: 146, align: "right" },
      ],
      [
        ...trades.map((row) => [row.trade, money(row.installed), money(row.op), money(row.total)]),
        ["Installed", money(job.materialsSubtotal), "", ""],
        ["Overhead & profit", money(job.laborSubtotal), "", ""],
        ["Grand total", money(job.grandTotal), "", ""],
      ],
    );
  } else {
    pdf.table(
      [
        { key: "t", label: "Trade", width: 280 },
        { key: "a", label: "Amount", width: 236, align: "right" },
      ],
      [
        ...trades.map((row) => [row.trade, money(row.total)]),
        ["Installed", money(job.materialsSubtotal)],
        ["Overhead & profit", money(job.laborSubtotal)],
        ["Grand total", money(job.grandTotal)],
      ],
    );
  }
  pdf.paragraph(TRADE_NOTE, 8, MUTED);

  pdf.kicker("Cost per item");
  if (kind === "contractor") {
    pdf.table(
      [
        { key: "t", label: "Trade", width: 70 },
        { key: "d", label: "Work", width: 168 },
        { key: "q", label: "Qty", width: 48, align: "right" },
        { key: "u", label: "Unit", width: 44 },
        { key: "c", label: "Cost", width: 54, align: "right" },
        { key: "a", label: "Amount", width: 58, align: "right" },
        { key: "s", label: "Source", width: 74 },
      ],
      items.map((row) => [
        row.trade,
        row.laborOnly ? `${row.description} (labor)` : row.description,
        row.quantity.toFixed(2),
        row.unit,
        money(row.unitCost),
        money(row.amount),
        row.source,
      ]),
    );
  } else {
    pdf.table(
      [
        { key: "t", label: "Trade", width: 90 },
        { key: "d", label: "Work", width: 250 },
        { key: "q", label: "Qty", width: 60, align: "right" },
        { key: "u", label: "Unit", width: 56 },
        { key: "a", label: "Amount", width: 60, align: "right" },
      ],
      items.map((row) => [
        row.trade,
        row.description,
        row.quantity.toFixed(2),
        row.unit,
        money(row.amount),
      ]),
    );
  }
}

export async function buildEstimatePdf(job: JobEstimate, client: ClientInfo) {
  const { pdf, doc } = await startPdf(job, client, "contractor");

  for (const entry of job.rooms) {
    pdf.ensure(54);
    pdf.kicker(entry.room.label);
    writeRoomMeasurements(pdf, entry);
    if (entry.estimate.lineItems.length === 0) {
      pdf.paragraph("No finishes selected for this room.", 9, MUTED);
      continue;
    }
    pdf.table(
      [
        { key: "n", label: "#", width: 28, align: "right" },
        { key: "d", label: "Description", width: 238 },
        { key: "q", label: "Qty", width: 54, align: "right" },
        { key: "u", label: "Unit", width: 56 },
        { key: "c", label: "Unit cost", width: 70, align: "right" },
        { key: "a", label: "Amount", width: 70, align: "right" },
      ],
      entry.estimate.lineItems.map((line, index) => [
        String(index + 1),
        line.description,
        line.quantity.toFixed(2),
        line.unit,
        money(line.unitCost),
        money(line.lineTotal),
      ]),
    );
  }

  pdf.kicker("Complete list");
  pdf.table(
    [
      { key: "n", label: "#", width: 28, align: "right" },
      { key: "r", label: "Room", width: 90 },
      { key: "d", label: "Description", width: 220 },
      { key: "q", label: "Qty", width: 54, align: "right" },
      { key: "u", label: "Unit", width: 54 },
      { key: "a", label: "Amount", width: 70, align: "right" },
    ],
    job.completeLineItems.map((line, index) => [
      String(index + 1),
      line.roomLabel,
      line.description,
      line.quantity.toFixed(2),
      line.unit,
      money(line.lineTotal),
    ]),
  );

  pdf.kicker("By room");
  pdf.table(
    [
      { key: "room", label: "Room", width: 140 },
      { key: "type", label: "Type", width: 100 },
      { key: "floor", label: "Floor", width: 56, align: "right" },
      { key: "installed", label: "Installed", width: 74, align: "right" },
      { key: "op", label: "O&P", width: 64, align: "right" },
      { key: "total", label: "Total", width: 82, align: "right" },
    ],
    job.rooms.map((entry) => [
      entry.room.label,
      entry.typeName,
      `${entry.scan.floorArea.toFixed(0)} sf`,
      money(entry.estimate.materialsSubtotal),
      money(entry.estimate.laborSubtotal),
      money(entry.estimate.grandTotal),
    ]),
  );

  writeTradeSections(pdf, job, "contractor");
  pdf.drawTotalBox(job, true);

  pdf.paragraph(
    `This estimate uses ${PRICE_LIST} installed unit prices (${PRICE_AS_OF}) except cabinets. Cabinets use Northville Cabinetry MSRP (December 2023) plus $75 install per unit ($125 for pantries and refrigerator panels). Overhead and profit is applied to the job total. Final pricing may change after on-site conditions are verified. ${COMPANY.license}.`,
    8,
    MUTED,
  );
  pdf.paragraph(`${COMPANY.email}  ·  ${COMPANY.region}`, 8, MUTED);

  pdf.stampFooters();
  return doc.save();
}

export async function buildCustomerPdf(job: JobEstimate, client: ClientInfo) {
  const { pdf, doc } = await startPdf(job, client, "customer");

  pdf.paragraph(
    "Work and measurements by room. Line prices are omitted. Room totals and the job total are at the end of each section.",
    9,
    MUTED,
  );
  pdf.y -= 6;

  for (const entry of job.rooms) {
    pdf.ensure(54);
    pdf.kicker(entry.room.label);
    writeRoomMeasurements(pdf, entry);
    if (entry.estimate.lineItems.length === 0) {
      pdf.paragraph("No finishes selected for this room.", 9, MUTED);
      continue;
    }
    pdf.table(
      [
        { key: "n", label: "#", width: 28, align: "right" },
        { key: "d", label: "Material / work", width: 330 },
        { key: "q", label: "Qty", width: 78, align: "right" },
        { key: "u", label: "Unit", width: 80 },
      ],
      entry.estimate.lineItems.map((line, index) => [
        String(index + 1),
        line.description,
        line.quantity.toFixed(2),
        line.unit,
      ]),
    );
    pdf.paragraph(`Room total  ${money(entry.estimate.grandTotal)}`, 10, INK);
  }

  pdf.kicker("By room");
  pdf.table(
    [
      { key: "room", label: "Room", width: 150 },
      { key: "type", label: "Type", width: 110 },
      { key: "floor", label: "Floor", width: 70, align: "right" },
      { key: "walls", label: "Walls", width: 70, align: "right" },
      { key: "total", label: "Total", width: 116, align: "right" },
    ],
    job.rooms.map((entry) => [
      entry.room.label,
      entry.typeName,
      `${entry.scan.floorArea.toFixed(0)} sf`,
      `${entry.scan.wallArea.toFixed(0)} sf`,
      money(entry.estimate.grandTotal),
    ]),
  );

  writeTradeSections(pdf, job, "customer");
  pdf.drawTotalBox(job, false);
  pdf.paragraph(
    `Job total includes installed work and overhead. Valid 30 days. Final pricing may change after on-site conditions are verified. ${COMPANY.license}.`,
    8,
    MUTED,
  );
  pdf.paragraph(`${COMPANY.email}  ·  ${COMPANY.region}`, 8, MUTED);

  pdf.stampFooters();
  return doc.save();
}

async function saveDownload(bytes: Uint8Array, filename: string) {
  const blob = new Blob([Uint8Array.from(bytes)], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function downloadEstimatePdf(job: JobEstimate, client: ClientInfo, kind: EstimatePdfKind = "contractor") {
  const bytes = kind === "customer" ? await buildCustomerPdf(job, client) : await buildEstimatePdf(job, client);
  await saveDownload(bytes, estimatePdfFilename(client, kind));
}
