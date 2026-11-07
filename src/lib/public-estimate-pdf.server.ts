/**
 * Personalized preliminary-estimate PDF for visitors.
 * One combined total only — never SKUs, unit prices, or itemization.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { PRELIMINARY_ESTIMATE_WORDING, formatPublicEstimate } from "./public-estimate-display.ts";
import {
  COUNTER_MATERIALS, FLOOR_MATERIALS, PROJECT_SERVICES, SHOWER_MATERIALS,
  effectiveIncludeFlooring, flooringIsOptional, selectedVanity,
  type ProjectInputs,
} from "./public-estimate-options.ts";
import { CABINET_FINISHES } from "./public-cabinet-finishes.ts";
import { projectScope } from "./public-estimate-options.ts";

const PAGE_W = 612;
const PAGE_H = 792;
const INK = rgb(18 / 255, 52 / 255, 59 / 255);
const ACCENT = rgb(196 / 255, 92 / 255, 38 / 255);
const MUTED = rgb(91 / 255, 110 / 255, 115 / 255);

function ascii(value: string) {
  return value
    .replace(/[\u2013\u2014\u2212]/g, "-")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\s+/g, " ")
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

export function publicEstimateMaterialSummary(input: ProjectInputs): string {
  const scope = projectScope(input.service, input.size, {
    floorSqft: input.floorSqft,
    showerSqft: input.showerSqft,
    counterSqft: input.counterSqft,
    roomSqft: input.roomSqft,
    cabinetBoxes: input.cabinetBoxes,
    xlFridgeBoxes: input.xlFridgeBoxes,
  }, input.vanity);
  const includeFloor = effectiveIncludeFlooring(input);
  return [
    includeFloor && scope?.floor ? FLOOR_MATERIALS.find(m => m.id === input.floor)?.label : "",
    input.service === "kitchen" || input.service === "bathroom"
      ? COUNTER_MATERIALS.find(m => m.id === input.counter)?.label
      : "",
    input.service === "bathroom" ? SHOWER_MATERIALS.find(m => m.id === input.shower)?.label : "",
    input.service === "kitchen"
      ? CABINET_FINISHES.find(finish => finish.id === (input.cabinetFinish ?? "ew"))?.name
      : "",
    input.service === "bathroom" ? selectedVanity(input.size, input.vanity).label : "",
    input.service === "bathroom" ? (input.newToilet ? "New toilet" : "Existing toilet") : "",
    scope?.wall ? (input.prime ? "Primer and paint" : "Paint only") : "",
    input.service === "exterior-paint" ? (input.exteriorCoats === 2 ? "2 coats" : "1 coat") : "",
  ].filter(Boolean).join(", ");
}

export function flooringInclusionLabel(input: ProjectInputs): string | null {
  if (!flooringIsOptional(input.service)) return null;
  return effectiveIncludeFlooring(input) ? "Flooring included" : "Flooring not included";
}

export async function renderPublicEstimatePdf(args: {
  input: ProjectInputs;
  /** Server-recalculated combined preliminary total (already rounded). */
  total: number;
  name: string;
  issued?: Date;
}): Promise<Uint8Array> {
  const issued = args.issued ?? new Date();
  const dateLabel = issued.toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });
  const service = PROJECT_SERVICES.find(row => row.id === args.input.service)?.label ?? args.input.service;
  const materials = publicEstimateMaterialSummary(args.input) || "To be selected";
  const flooring = flooringInclusionLabel(args.input);
  const totalLabel = formatPublicEstimate(args.total);

  const doc = await PDFDocument.create();
  doc.setTitle(`The Flip Fixer | Preliminary estimate for ${ascii(args.name)}`);
  doc.setAuthor("The Flip Fixer");
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([PAGE_W, PAGE_H]);

  const draw = (value: string, x: number, y: number, size: number, useBold = false, color = INK) => {
    page.drawText(ascii(value), { x, y, size, font: useBold ? bold : font, color });
  };
  const drawWrapped = (value: string, x: number, y: number, size: number, maxWidth: number, useBold = false, color = INK) => {
    const lines = wrap(value, useBold ? bold : font, size, maxWidth);
    let cursor = y;
    for (const line of lines) {
      draw(line, x, cursor, size, useBold, color);
      cursor -= size + 4;
    }
    return cursor;
  };

  page.drawRectangle({ x: 0, y: PAGE_H - 10, width: PAGE_W, height: 10, color: ACCENT });
  draw("THE FLIP FIXER", 48, PAGE_H - 56, 16, true);
  draw("SAN ANTONIO  /  PRELIMINARY ESTIMATE", 48, PAGE_H - 76, 10, true, ACCENT);
  draw(`Prepared for ${args.name}`, 48, PAGE_H - 110, 12, false, MUTED);
  draw(`Generated ${dateLabel}`, 48, PAGE_H - 128, 11, false, MUTED);

  draw(service, 48, PAGE_H - 170, 22, true);
  draw(`Project size: ${args.input.size}`, 48, PAGE_H - 198, 12);
  let y = drawWrapped(`Selected materials and finishes: ${materials}`, 48, PAGE_H - 222, 12, 516);
  if (flooring) {
    y = drawWrapped(flooring, 48, y - 8, 12, 516, true);
  }

  page.drawRectangle({ x: 36, y: y - 120, width: 540, height: 100, color: rgb(0.93, 0.96, 0.95) });
  draw("COMBINED PRELIMINARY TOTAL", 48, y - 48, 11, true);
  draw(totalLabel, 48, y - 92, 36, true);
  y -= 140;

  y = drawWrapped(PRELIMINARY_ESTIMATE_WORDING, 48, y, 11, 516, true);
  y = drawWrapped(
    "This PDF is your personalized preliminary estimate for the selections above. It is not labeled example-only.",
    48,
    y - 12,
    11,
    516,
    false,
    MUTED,
  );
  y = drawWrapped(
    "Share project details or request an on-site estimate at theflipfixer.com/estimate.",
    48,
    y - 12,
    11,
    516,
    false,
    MUTED,
  );

  page.drawLine({ start: { x: 48, y: 72 }, end: { x: 564, y: 72 }, thickness: 1, color: ACCENT });
  draw("theflipfixer.com", 48, 48, 12, true);

  return doc.save();
}
