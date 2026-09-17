import type { RoofSummary } from "./roof-math.ts";
import type { LineAct } from "./line-act.ts";

export const ROOF_SHINGLE = "Laminated composition shingles";
export const ROOF_TEAROFF = "Tear-off composition shingles \u2014 haul off";
export const ROOF_UNDERLAYMENT = "Synthetic underlayment";
export const ROOF_DRIP = "Drip edge / gutter apron";
export const ROOF_RIDGE_CAP = "Hip / ridge cap \u2014 composition";
export const ROOF_VALLEY = "Valley metal";
export const ROOF_WALL = "Step flashing / roof-to-wall";
export const ROOF_STEEP = "Steep roof charge \u2014 7/12 to 9/12";
export const ROOF_CORNICE_STRIP = "Gable cornice strip";
export const ROOF_CORNICE_RETURN = "Gable cornice return";

export type RoofLineItem = { name: string; quantity: number | null; act?: LineAct };

export type RoofSendExtras = {
  corniceStripLf?: number | null;
  corniceReturnEa?: number | null;
};

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
  const squares = summary.squares_with_waste;
  const items: RoofLineItem[] = [
    { name: ROOF_TEAROFF, quantity: squares, act: "r" },
    { name: ROOF_SHINGLE, quantity: squares, act: "plus" },
    { name: ROOF_UNDERLAYMENT, quantity: squares, act: "plus" },
  ];
  const drip = roundLf(
    summary.drip_ft ??
      (summary.eaves_ft != null && summary.rakes_ft != null ? summary.eaves_ft + summary.rakes_ft : null),
  );
  const ridgeCap = roundLf(summary.ridges_hips_ft);
  const valley = roundLf(summary.valleys_ft);
  const wall = roundLf(summary.steps_ft);
  if (drip) items.push({ name: ROOF_DRIP, quantity: drip, act: "plus" });
  if (ridgeCap) items.push({ name: ROOF_RIDGE_CAP, quantity: ridgeCap, act: "plus" });
  if (valley) items.push({ name: ROOF_VALLEY, quantity: valley, act: "plus" });
  if (wall) items.push({ name: ROOF_WALL, quantity: wall, act: "plus" });
  const strip = roundLf(extras.corniceStripLf);
  const corniceReturn = roundLf(extras.corniceReturnEa);
  if (strip) items.push({ name: ROOF_CORNICE_STRIP, quantity: strip, act: "plus" });
  if (corniceReturn) items.push({ name: ROOF_CORNICE_RETURN, quantity: corniceReturn, act: "plus" });
  if (summary.steep_squares > 0) {
    items.push({ name: ROOF_STEEP, quantity: Math.round(summary.steep_squares * 100) / 100, act: "plus" });
  }
  return items;
}
