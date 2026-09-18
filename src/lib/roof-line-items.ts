import catalogJson from "../data/catalog.json" with { type: "json" };
import type { RoofSummary } from "./roof-math.ts";
import { actUnitCost, type LineAct } from "./line-act.ts";

const ROOF_OPTIONS = (
  catalogJson as {
    roofing: {
      options: Array<{
        name: string;
        unit: string;
        cost_per_unit: number;
        remove_cost_per_unit?: number;
      }>;
    };
  }
).roofing.options;

export const ROOF_SHINGLE = "Laminated composition shingles";
export const ROOF_OAKRIDGE = "Owens Corning Oakridge";
export const ROOF_3TAB = "3-tab composition shingles \u2014 25 yr";
export const ROOF_TEAROFF = "Tear-off composition shingles \u2014 haul off";
export const ROOF_UNDERLAYMENT = "Synthetic underlayment";
export const ROOF_HAUL = "Debris haul-off";
export const ROOF_DRIP = "Drip edge";
export const ROOF_COIL_NAILS = "Coil nails \u2014 1 1/4 in (20 SQ/box)";
export const ROOF_CAP_NAILS = "Plastic cap nails \u2014 1 in (20 SQ/box)";
export const ROOF_CAULK = "Roofing caulk \u2014 NP1";
export const ROOF_DELIVERY = "Material delivery";
export const ROOF_CREW = "Roofing crew install";
export const ROOF_GUTTER_APRON = "Gutter apron";
export const ROOF_RIDGE_CAP = "Hip / ridge cap \u2014 composition";
export const ROOF_VALLEY = "Valley metal";
export const ROOF_ICE = "Ice & water barrier";
/** IWS in valleys: billed sq ft = 3 ft roll width × valley LF. */
export const VALLEY_ICE_WIDTH_FT = 3;
/** Home Depot ice & water roll is 3 ft × 75 ft (225 sf). */
export const ICE_ROLL_LENGTH_FT = 75;
export const ICE_ROLL_SF = VALLEY_ICE_WIDTH_FT * ICE_ROLL_LENGTH_FT;
export const ROOF_WALL = "Step flashing / roof-to-wall";
export const ROOF_STEEP = "Steep roof charge \u2014 7/12 to 9/12";
export const ROOF_CORNICE_STRIP = "Gable cornice strip";
export const ROOF_CORNICE_RETURN = "Gable cornice return";
export const ROOF_STARTER = "Asphalt starter — universal";
export const ROOF_TURTLE = "Roof vent — turtle type";
export const ROOF_TURBINE = "Roof vent — turbine";
export const ROOF_VENT_PAINT = "Prime & paint roof vent";
export const ROOF_PIPE = "Pipe jack flashing";
export const ROOF_SOLAR_PANEL = "Solar electric panel";
export const ROOF_SOLAR_HARDWARE = "Solar panel mounting hardware";
export const ROOF_HIGH = "High roof charge — 2 stories or greater";

export type RoofLineItem = { name: string; quantity: number | null; act?: LineAct };

export type RoofSendExtras = {
  corniceStripLf?: number | null;
  corniceReturnEa?: number | null;
  starterLf?: number | null;
  turtleVents?: number | null;
  turbineVents?: number | null;
  pipeJacks?: number | null;
  solarPanels?: number | null;
  solarHardware?: number | null;
  highRoofSquares?: number | null;
  penetrations?: RoofLineItem[];
  /** Existing field shingle. 3-tab reroofs install Owens Corning Oakridge. */
  existingShingle?: "3-tab" | "laminated";
};

export const ROOF_PENETRATION_OPTIONS = ROOF_OPTIONS.filter((row) => {
  if (row.unit !== "each") return false;
  if (
    /steep|high roof|patch|cornice return|mounting hardware|paint roof vent|nail|caulk|NP1|debris|delivery|crew/i.test(
      row.name,
    )
  )
    return false;
  return true;
}).map((row) => row.name);

export function mergeRoofPenetrations(
  current: RoofLineItem[],
  incoming: RoofLineItem[],
): RoofLineItem[] {
  const byName = new Map(current.map((row) => [row.name, row]));
  for (const row of incoming) {
    if (!row.name || !roundLf(row.quantity)) continue;
    byName.set(row.name, row);
  }
  return [...byName.values()];
}

const VENT_NAMES = new Set([ROOF_TURTLE, ROOF_TURBINE]);

function boxesFromSquares(squares: number, perBox: number): number | null {
  if (!squares || squares <= 0) return null;
  return Math.ceil(squares / perBox);
}

function roundLf(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 10) / 10;
}

/** Ice & water in the valleys, billed by sq ft from a 3 ft wide roll. */
export function iceAndWaterSf(valleyLf: number | null | undefined): number {
  const lf = roundLf(valleyLf);
  if (!lf) return 0;
  return Math.round(lf * VALLEY_ICE_WIDTH_FT * 10) / 10;
}

export function iceAndWaterRolls(iceSf: number | null | undefined): number {
  if (!iceSf || iceSf <= 0) return 0;
  return Math.ceil(iceSf / ICE_ROLL_SF);
}

export function parseRoofQty(value: string | null | undefined): number | null {
  if (!value) return null;
  return roundLf(Number(value));
}

export function roofingSelectionsFromSummary(
  summary: RoofSummary,
  extras: RoofSendExtras = {},
): RoofLineItem[] {
  const pitched = Math.round((summary.total_squares || summary.squares_with_waste) * 100) / 100;
  const squares = summary.squares_with_waste;
  const threeTab = extras.existingShingle !== "laminated";
  const items: RoofLineItem[] = threeTab
    ? [
        { name: ROOF_3TAB, quantity: pitched, act: "r" },
        { name: ROOF_OAKRIDGE, quantity: squares, act: "plus" },
        { name: ROOF_UNDERLAYMENT, quantity: pitched, act: "plus" },
      ]
    : [
        { name: ROOF_TEAROFF, quantity: pitched, act: "r" },
        { name: ROOF_SHINGLE, quantity: squares, act: "plus" },
        { name: ROOF_UNDERLAYMENT, quantity: pitched, act: "plus" },
      ];
  const ridgeCap = roundLf(summary.ridges_hips_ft);
  const valley = roundLf(summary.valleys_ft);
  const wall = roundLf(summary.steps_ft);
  const rakes = roundLf(summary.rakes_ft);
  if (ridgeCap) items.push({ name: ROOF_RIDGE_CAP, quantity: ridgeCap, act: "plus" });
  if (valley) {
    items.push({ name: ROOF_VALLEY, quantity: valley, act: "plus" });
    items.push({
      name: ROOF_ICE,
      quantity: iceAndWaterSf(valley),
      act: "plus",
    });
  }
  if (wall) items.push({ name: ROOF_WALL, quantity: wall, act: "plus" });
  if (rakes) items.push({ name: ROOF_DRIP, quantity: rakes, act: "rr" });
  const strip = roundLf(extras.corniceStripLf);
  const corniceReturn = roundLf(extras.corniceReturnEa);
  if (strip) items.push({ name: ROOF_CORNICE_STRIP, quantity: strip, act: "plus" });
  if (corniceReturn)
    items.push({ name: ROOF_CORNICE_RETURN, quantity: corniceReturn, act: "plus" });
  if (summary.steep_squares > 0) {
    items.push({
      name: ROOF_STEEP,
      quantity: Math.round(summary.steep_squares * 100) / 100,
      act: "plus",
    });
  }
  const starter = roundLf(extras.starterLf) ?? roundLf(summary.eaves_ft);
  if (starter) items.push({ name: ROOF_STARTER, quantity: starter, act: "plus" });
  const turtles = roundLf(extras.turtleVents);
  if (turtles) items.push({ name: ROOF_TURTLE, quantity: turtles, act: "rr" });
  const turbines = roundLf(extras.turbineVents);
  if (turbines) items.push({ name: ROOF_TURBINE, quantity: turbines, act: "rr" });
  const jacks = roundLf(extras.pipeJacks);
  if (jacks) items.push({ name: ROOF_PIPE, quantity: jacks, act: "rr" });
  const panels = roundLf(extras.solarPanels);
  if (panels) items.push({ name: ROOF_SOLAR_PANEL, quantity: panels, act: "rr" });
  const hardware = roundLf(extras.solarHardware);
  if (hardware) items.push({ name: ROOF_SOLAR_HARDWARE, quantity: hardware, act: "plus" });
  for (const row of extras.penetrations ?? []) {
    const qty = roundLf(row.quantity);
    if (!qty) continue;
    if (items.some((item) => item.name === row.name)) continue;
    items.push({ name: row.name, quantity: qty, act: row.act ?? "rr" });
  }
  const ventQty = items
    .filter((item) => VENT_NAMES.has(item.name))
    .reduce((sum, item) => sum + (item.quantity ?? 0), 0);
  if (ventQty && !items.some((item) => item.name === ROOF_VENT_PAINT)) {
    items.push({ name: ROOF_VENT_PAINT, quantity: ventQty, act: "plus" });
  }
  const solarQty = items.find((item) => item.name === ROOF_SOLAR_PANEL)?.quantity ?? 0;
  if (solarQty && !items.some((item) => item.name === ROOF_SOLAR_HARDWARE)) {
    items.push({ name: ROOF_SOLAR_HARDWARE, quantity: solarQty, act: "plus" });
  }
  const high = roundLf(extras.highRoofSquares);
  if (high) items.push({ name: ROOF_HIGH, quantity: high, act: "plus" });
  const coilBoxes = boxesFromSquares(squares, COIL_NAIL_SQ_PER_BOX);
  if (coilBoxes) items.push({ name: ROOF_COIL_NAILS, quantity: coilBoxes, act: "plus" });
  const capBoxes = boxesFromSquares(pitched, CAP_NAIL_SQ_PER_BOX);
  if (capBoxes) items.push({ name: ROOF_CAP_NAILS, quantity: capBoxes, act: "plus" });
  const caulkTubes = boxesFromSquares(pitched, CAULK_SQ_PER_TUBE);
  if (caulkTubes) items.push({ name: ROOF_CAULK, quantity: caulkTubes, act: "plus" });
  if (squares > 0 || pitched > 0) items.push({ name: ROOF_DELIVERY, quantity: 1, act: "plus" });
  if (squares > 0)
    items.push({ name: ROOF_CREW, quantity: Math.round(squares * 100) / 100, act: "plus" });
  return items;
}

/** MRC roof WO: 4-nail coil, 20 squares per box. */
export const COIL_NAIL_SQ_PER_BOX = 20;
/** MRC roof WO: 1 in plastic caps, 20 squares per box. */
export const CAP_NAIL_SQ_PER_BOX = 20;
/** MRC roof WO: NP1 caulk, 1 tube per 10 squares. */
export const CAULK_SQ_PER_TUBE = 10;
/** One 3 ft × 75 ft ice & water roll covers 2.25 squares (225 sf). */
export const ICE_SQ_PER_ROLL = ICE_ROLL_SF / 100;
/** MRC roof WO: drip edge 10 ft sticks. */
export const DRIP_LF_PER_PC = 10;

/** MRC roof WO: synthetic 15# / Super Felt is 10 squares per roll. */
export const SYNTHETIC_SQ_PER_ROLL = 10;
/** MRC roof WO: universal starter 100 lf per bundle. */
export const STARTER_LF_PER_BUNDLE = 100;

export type RoofWorkOrderMaterials = {
  pitchedSquares: number;
  shingleSquares: number;
  underlaymentSquares: number;
  underlaymentRolls: number;
  starterLf: number;
  starterBundles: number;
  ridgeLf: number;
  dripLf: number;
  dripPcs: number;
  coilNailBoxes: number;
  capNailBoxes: number;
  caulkTubes: number;
  iceSf: number;
  iceRolls: number;
  valleyLf: number;
  pricePerSq: number;
};

export function roofWorkOrderMaterials(
  items: Array<{ name: string; quantity: number | null; description?: string }>,
  grandTotal: number,
): RoofWorkOrderMaterials | null {
  const qty = (match: string) => {
    const row = items.find((item) => (item.description ?? item.name).includes(match));
    return row?.quantity && row.quantity > 0 ? row.quantity : 0;
  };
  const pitched = qty(ROOF_TEAROFF) || qty(ROOF_3TAB) || qty(ROOF_UNDERLAYMENT);
  const shingles = qty(ROOF_OAKRIDGE) || qty(ROOF_SHINGLE);
  if (!pitched && !shingles) return null;
  const underlayment = qty(ROOF_UNDERLAYMENT) || pitched;
  const starterLf = qty(ROOF_STARTER);
  const dripLf = qty(ROOF_DRIP);
  const valleyLf = qty(ROOF_VALLEY);
  const iceSf = qty(ROOF_ICE) || iceAndWaterSf(valleyLf);
  return {
    pitchedSquares: pitched,
    shingleSquares: shingles,
    underlaymentSquares: underlayment,
    underlaymentRolls: underlayment > 0 ? Math.ceil(underlayment / SYNTHETIC_SQ_PER_ROLL) : 0,
    starterLf,
    starterBundles: starterLf > 0 ? Math.ceil(starterLf / STARTER_LF_PER_BUNDLE) : 0,
    ridgeLf: qty(ROOF_RIDGE_CAP),
    dripLf,
    dripPcs: dripLf > 0 ? Math.ceil(dripLf / DRIP_LF_PER_PC) : 0,
    coilNailBoxes:
      qty(ROOF_COIL_NAILS) || (shingles > 0 ? Math.ceil(shingles / COIL_NAIL_SQ_PER_BOX) : 0),
    capNailBoxes:
      qty(ROOF_CAP_NAILS) || (pitched > 0 ? Math.ceil(pitched / CAP_NAIL_SQ_PER_BOX) : 0),
    caulkTubes: qty(ROOF_CAULK) || (pitched > 0 ? Math.ceil(pitched / CAULK_SQ_PER_TUBE) : 0),
    iceSf,
    iceRolls: iceAndWaterRolls(iceSf),
    valleyLf,
    pricePerSq: shingles > 0 ? Math.round((grandTotal / shingles) * 100) / 100 : 0,
  };
}

export const FAST_QUOTE_BAND = 0.025;

export function roofBallpark(
  summary: RoofSummary,
  extras: RoofSendExtras = {},
): { mid: number; low: number; high: number } {
  let mid = 0;
  for (const item of roofingSelectionsFromSummary(summary, extras)) {
    if (item.quantity == null || item.quantity <= 0) continue;
    const option = ROOF_OPTIONS.find((row) => row.name === item.name);
    if (!option) continue;
    const act = (item.act ?? "plus") as LineAct;
    mid += item.quantity * actUnitCost(option, act);
  }
  mid = Math.round(mid);
  return {
    mid,
    low: Math.round(mid * (1 - FAST_QUOTE_BAND)),
    high: Math.round(mid * (1 + FAST_QUOTE_BAND)),
  };
}
