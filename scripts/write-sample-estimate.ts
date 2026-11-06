/** Regenerate both public samples with Node and Poppler's pdftoppm on PATH. */
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  formatPublicEstimate,
  PRELIMINARY_ESTIMATE_WORDING,
} from "../src/lib/public-estimate-display.ts";

const pdf = await PDFDocument.create();
pdf.setTitle("The Flip Fixer | Sample preliminary estimate");
const regular = await pdf.embedFont(StandardFonts.Helvetica);
const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
const page = pdf.addPage([612, 500]);
const ink = rgb(0.09, 0.21, 0.23);
const accent = rgb(0.74, 0.26, 0.08);
const muted = rgb(0.28, 0.34, 0.35);

function text(value: string, y: number, size: number, font = regular, color = ink) {
  page.drawText(value, { x: 48, y, size, font, color });
}

page.drawRectangle({ x: 0, y: 492, width: 612, height: 8, color: accent });
text("THE FLIP FIXER", 446, 16, bold);
text("SAN ANTONIO  /  SAMPLE ESTIMATE", 423, 10, bold, accent);
text("Example kitchen remodel", 367, 30, bold);
text("Example only. Actual project totals vary.", 342, 13, regular, muted);

page.drawRectangle({ x: 36, y: 214, width: 540, height: 100, color: rgb(0.93, 0.96, 0.95) });
text("COMBINED PRELIMINARY TOTAL", 284, 11, bold);
text(formatPublicEstimate(12800), 235, 38, bold);

text(PRELIMINARY_ESTIMATE_WORDING, 171, 11, bold);
text("Share your project details to request an on-site estimate.", 145, 12, regular, muted);

page.drawLine({ start: { x: 48, y: 106 }, end: { x: 564, y: 106 }, thickness: 1, color: accent });
text("PLAN YOUR PROJECT", 77, 10, bold, accent);
text("theflipfixer.com/estimate", 53, 13, bold);

writeFileSync("public/sample-estimate.pdf", await pdf.save());
execFileSync("pdftoppm", [
  "-singlefile", "-scale-to", "1100", "-png",
  "public/sample-estimate.pdf", "public/sample-estimate",
], { stdio: "inherit" });
