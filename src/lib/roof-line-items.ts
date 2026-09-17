import catalogJson from "../data/catalog.json" with { type: "json" };
import type { RoofSummary } from "./roof-math.ts";
import { actUnitCost, type LineAct } from "./line-act.ts";

const ROOF_OPTIONS = (
  catalogJson as {
    roofing: { options: Array<{ name: string; unit: string; cost_per_unit: number; remove_cost_per_unit?: number }> };
  }
).roofing.options;

export const ROOF_SHINGLE = "Laminated composition shingles";
export const ROOF_TEAROFF = "Tear-off composition shingles \u2014 haul off";
export const ROOF_UNDERLAYMENT = "Synthetic underlayment";
export const ROOF_DRIP = "Drip edge";
export const ROOF_GUTTER_APRON = "Gutter apron";
export const ROOF_RIDGE_CAP = "Hip / ridge cap \u2014 composition";
export const ROOF_VALLEY = "Valley metal";
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
};

export const ROOF_PENETRATION_OPTIONS = ROOF_OPTIONS.filter((row) => {
  if (row.unit !== "each") return false;
  if (/steep|high roof|patch|cornice return|mounting hardware|paint roof vent/i.test(row.name)) return false;
  return true;
}).map((row) => row.name);

export function mergeRoofPenetrations(current: RoofLineItem[], incoming: RoofLineItem[]): RoofLineItem[] {
  const byName = new Map(current.map((row) => [row.name, row]));
  for (const row of incoming) {
    if (!row.name || !roundLf(row.quantity)) continue;
    byName.set(row.name, row);
  }
  return [...byName.values()];
}

const VENT_NAMES = new Set([ROOF_TURTLE, ROOF_TURBINE]);

function roundLf(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 10) / 10;
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
  const items: RoofLineItem[] = [
    { name: ROOF_TEAROFF, quantity: pitched, act: "r" },
    { name: ROOF_SHINGLE, quantity: squares, act: "plus" },
    { name: ROOF_UNDERLAYMENT, quantity: squares, act: "plus" },
  ];
  const ridgeCap = roundLf(summary.ridges_hips_ft);
  const valley = roundLf(summary.valleys_ft);
  const wall = roundLf(summary.steps_ft);
  const rakes = roundLf(summary.rakes_ft);
  if (ridgeCap) items.push({ name: ROOF_RIDGE_CAP, quantity: ridgeCap, act: "plus" });
  if (valley) items.push({ name: ROOF_VALLEY, quantity: valley, act: "plus" });
  if (wall) items.push({ name: ROOF_WALL, quantity: wall, act: "plus" });
  if (rakes) items.push({ name: ROOF_DRIP, quantity: rakes, act: "rr" });
  const strip = roundLf(extras.corniceStripLf);
  const corniceReturn = roundLf(extras.corniceReturnEa);
  if (strip) items.push({ name: ROOF_CORNICE_STRIP, quantity: strip, act: "plus" });
  if (corniceReturn) items.push({ name: ROOF_CORNICE_RETURN, quantity: corniceReturn, act: "plus" });
  if (summary.steep_squares > 0) {
    items.push({ name: ROOF_STEEP, quantity: Math.round(summary.steep_squares * 100) / 100, act: "plus" });
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
  return items;
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
