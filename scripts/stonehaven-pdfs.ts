import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  msbFp2QueryUrl,
  outlineFromMsbFp2,
  type GeoJsonFeatureCollection,
} from "../src/lib/roof-outline.ts";
import { DEFAULT_WASTE_PCT, summarizeFacets, type RoofFacet } from "../src/lib/roof-math.ts";
import {
  ROOF_CAP_NAILS,
  ROOF_CAULK,
  ROOF_COIL_NAILS,
  ROOF_DELIVERY,
  ROOF_OAKRIDGE,
  ROOF_STARTER,
  roofWorkOrderMaterials,
  roofingSelectionsFromSummary,
} from "../src/lib/roof-line-items.ts";
import {
  CREW_PER_SQ,
  CUSTOMER_PER_SQ,
  HD_AS_OF,
  HD_DELIVERY,
  customerRoofTask,
  homeDepotUnitCost,
  roofCrewBid,
} from "../src/lib/home-depot-roof.ts";
import { streetFileSlug } from "../src/lib/roof-address.ts";

const ADDRESS = "3407 Stonehaven Dr, San Antonio, TX 78230";
const PIN = { lat: 29.528992348131, lng: -98.550916415896 };

function ascii(value: string) {
  return value
    .replace(/[\u2013\u2014\u2212]/g, "-")
    .replace(/[\u00B7\u2022]/g, "-")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function money(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function dayStamp(d = new Date()) {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}

async function fetchOutline() {
  const res = await fetch(msbFp2QueryUrl(PIN.lat, PIN.lng), {
    headers: {
      Accept: "application/json",
      "User-Agent": "TheFlipFixerRoofTracer/1.0 (jon@theflipfixer.com)",
    },
  });
  if (!res.ok) throw new Error(`MSBFP2 ${res.status}`);
  const geojson = (await res.json()) as GeoJsonFeatureCollection;
  const outline = outlineFromMsbFp2(geojson, PIN.lat, PIN.lng);
  if (!outline) throw new Error("No containing building outline");
  return outline;
}

type PdfKind = "contractor" | "customer";

async function writePdf(
  kind: PdfKind,
  payload: {
    summary: ReturnType<typeof summarizeFacets>;
    items: ReturnType<typeof roofingSelectionsFromSummary>;
    bid: NonNullable<ReturnType<typeof roofCrewBid>>;
    wo: NonNullable<ReturnType<typeof roofWorkOrderMaterials>>;
  },
) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let y = 748;
  const ink = rgb(18 / 255, 52 / 255, 59 / 255);
  const muted = rgb(91 / 255, 110 / 255, 115 / 255);
  const primary = rgb(196 / 255, 92 / 255, 38 / 255);

  const text = (s: string, size = 10, f = font, color = ink) => {
    page.drawText(ascii(s), { x: 48, y, size, font: f, color });
    y -= size + 6;
  };

  text("FLIP FIXER", 16, bold, primary);
  text(kind === "customer" ? "CUSTOMER COPY" : "CONTRACTOR PDF", 11, bold);
  text(ADDRESS, 10);
  text(
    `${payload.summary.total_squares.toFixed(2)} net SQ / ${payload.summary.squares_with_waste.toFixed(2)} SQ with 12% waste`,
    10,
  );

  if (kind === "contractor") {
    y -= 6;
    text("Materials", 12, bold);
    text(
      `Home Depot list (${HD_AS_OF}). Crew install is $${CREW_PER_SQ} per square.`,
      8,
      font,
      muted,
    );
    const rows: Array<[string, number, string, number]> = [];
    for (const item of payload.items) {
      if (!item.quantity || /crew/i.test(item.name) || /3-tab/i.test(item.name)) continue;
      const hd = homeDepotUnitCost(item.name);
      const unit = hd ?? (/haul/i.test(item.name) ? 385 : 0);
      if (!unit && !/haul/i.test(item.name) && !/delivery/i.test(item.name)) continue;
      const cost = /haul/i.test(item.name) ? 385 : unit;
      rows.push([
        item.name,
        item.quantity,
        item.name.includes("nail") ||
        item.name.includes("caulk") ||
        item.name.includes("delivery") ||
        /haul/i.test(item.name)
          ? "each"
          : /Oakridge|underlayment/i.test(item.name)
            ? "square"
            : "linear ft",
        cost,
      ]);
    }
    rows.push(["Debris haul-off", 1, "each", 385]);
    for (const [name, qty, unit, cost] of rows) {
      const amt = Math.round(qty * cost * 100) / 100;
      page.drawText(ascii(name.slice(0, 42)), { x: 48, y, size: 9, font, color: ink });
      page.drawText(`${qty.toFixed(2)} ${unit}`, { x: 300, y, size: 9, font, color: ink });
      page.drawText(money(cost), { x: 430, y, size: 9, font, color: ink });
      page.drawText(money(amt), { x: 500, y, size: 9, font, color: ink });
      y -= 14;
    }
    y -= 8;
    text("Crew", 12, bold);
    page.drawText("Roofing crew install", { x: 48, y, size: 9, font, color: ink });
    page.drawText(`${payload.bid.squares.toFixed(2)} square`, {
      x: 300,
      y,
      size: 9,
      font,
      color: ink,
    });
    page.drawText(money(CREW_PER_SQ), { x: 430, y, size: 9, font, color: ink });
    page.drawText(money(payload.bid.crew), { x: 500, y, size: 9, font, color: ink });
    y -= 22;
    text("Price per square", 12, bold);
    text(`Materials  ${money(payload.bid.materialsPerSq)}`, 9);
    text(`Labor (crew install)  ${money(payload.bid.laborPerSq)}`, 9);
    text(`Customer price  ${money(payload.bid.customerPerSq)}`, 9);
    y -= 6;
    text("Work order materials", 12, bold);
    const wo = payload.wo;
    const woRows: Array<[string, string]> = [
      ["Roof squares (no waste)", `${wo.pitchedSquares.toFixed(2)} SQ`],
      ["Shingles (with waste)", `${wo.shingleSquares.toFixed(2)} SQ`],
      ["Synthetic underlayment", `${wo.underlaymentSquares.toFixed(2)} SQ`],
      ["Synthetic rolls", `${wo.underlaymentRolls} roll (10 SQ)`],
      ["Starter", `${wo.starterLf.toFixed(1)} LF / ${wo.starterBundles} bdl`],
      ["Ridge cap", `${wo.ridgeLf.toFixed(1)} LF`],
      ["Drip edge (rakes)", `${wo.dripLf.toFixed(1)} LF / ${wo.dripPcs} pc`],
      ["Coil nails 1 1/4 in", `${wo.coilNailBoxes} box (20 SQ)`],
      ["Plastic cap nails 1 in", `${wo.capNailBoxes} box (20 SQ)`],
      ["Roofing caulk NP1", `${wo.caulkTubes} tube (1/10 SQ)`],
      ["Valley metal", `${wo.valleyLf.toFixed(1)} LF`],
      ["Ice & water (valleys)", `${wo.iceSf.toFixed(1)} SF (3 ft x valley LF)`],
      ["Ice & water rolls", `${wo.iceRolls} roll (3 ft x 75 ft)`],
    ];
    for (const [label, qty] of woRows) {
      page.drawText(label, { x: 48, y, size: 9, font, color: ink });
      page.drawText(qty, { x: 360, y, size: 9, font, color: ink });
      y -= 14;
    }
    y -= 10;
    text(`Materials  ${money(payload.bid.materials)}`, 11, bold);
    text(`Crew @ $${CREW_PER_SQ}/SQ  ${money(payload.bid.crew)}`, 11, bold);
    text(`Job total  ${money(payload.bid.total)}`, 14, bold, primary);
    text(
      `Contractor copy. Materials are Home Depot including $${HD_DELIVERY} bulk delivery.`,
      8,
      font,
      muted,
    );
  } else {
    y -= 6;
    text("Scope of work. This copy shows the job total only.", 9, font, muted);
    text("What we will do", 12, bold);
    const seen = new Set<string>();
    for (const item of [
      ...payload.items.map((row) => ({ description: row.name })),
      { description: "Debris haul-off" },
    ]) {
      const label = customerRoofTask(item.description);
      if (!label) continue;
      const key = label.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      text(label, 10);
    }
    y -= 12;
    text(`Job total  ${money(payload.bid.customerTotal)}`, 14, bold, primary);
    text(
      `Market installed ${money(CUSTOMER_PER_SQ)} per shingle square with waste.`,
      8,
      font,
      muted,
    );
  }

  return doc.save();
}

function writeAll(bytes: Uint8Array, filename: string) {
  const dests = [
    join(process.cwd(), "Estimates", filename),
    join("C:\\Users\\Owner\\Downloads", filename),
    join("C:\\Users\\Owner\\Desktop\\FLPFXR-deliverables", filename),
  ];
  for (const dest of dests) {
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, bytes);
    console.log("wrote", dest);
  }
}

const outline = await fetchOutline();
const facet: RoofFacet = { id: "stonehaven", latlngs: outline.ring, pitch: "4/12", slopeDeg: null };
const summary = summarizeFacets([facet], DEFAULT_WASTE_PCT);
const items = roofingSelectionsFromSummary(summary, { existingShingle: "3-tab" });
const lines = [
  ...items.map((item) => ({
    description: `+ ${item.name}`,
    quantity: item.quantity ?? 0,
    lineTotal: /haul/i.test(item.name) ? 385 : 0,
  })),
  { description: "R Debris haul-off", quantity: 1, lineTotal: 385 },
];
const bid = roofCrewBid(lines);
if (!bid) throw new Error("no bid");
const wo = roofWorkOrderMaterials([...items, { name: "Debris haul-off", quantity: 1 }], bid.total);
if (!wo) throw new Error("no work order");

console.log({
  plan: summary.total_flat_area_sqft,
  net: summary.total_squares,
  waste: summary.squares_with_waste,
  eaves: summary.eaves_ft,
  rakes: summary.rakes_ft,
  ridge: summary.ridges_hips_ft,
  materials: bid.materials,
  crew: bid.crew,
  contractor: bid.total,
  customer: bid.customerTotal,
});

if (summary.squares_with_waste >= 35) throw new Error("refusing 39-square overlap bid");

const issued = dayStamp();
const slug = streetFileSlug(ADDRESS);
const contractorName = `Flip-Fixer-${slug}-contractor-${issued}.pdf`;
const customerName = `Flip-Fixer-${slug}-customer-${issued}.pdf`;
writeAll(await writePdf("contractor", { summary, items, bid, wo }), contractorName);
writeAll(await writePdf("customer", { summary, items, bid, wo }), customerName);
