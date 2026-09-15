import type { RoofSummary } from "./roof-math.ts";

export const ROOF_SHINGLE = "Laminated composition shingles";
export const ROOF_TEAROFF = "Tear-off composition shingles \u2014 haul off";
export const ROOF_UNDERLAYMENT = "Synthetic underlayment";
export const ROOF_DRIP = "Drip edge / gutter apron";
export const ROOF_RIDGE_CAP = "Hip / ridge cap \u2014 composition";
export const ROOF_VALLEY = "Valley metal";
export const ROOF_STEEP = "Steep roof charge \u2014 7/12 to 9/12";

export type RoofLineItem = { name: string; quantity: number | null };

function roundLf(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 10) / 10;
}

export function roofingSelectionsFromSummary(summary: RoofSummary): RoofLineItem[] {
  const squares = summary.squares_with_waste;
  const items: RoofLineItem[] = [
    { name: ROOF_TEAROFF, quantity: squares },
    { name: ROOF_SHINGLE, quantity: squares },
    { name: ROOF_UNDERLAYMENT, quantity: squares },
  ];
  const drip = roundLf(
    summary.drip_ft ??
      (summary.eaves_ft != null && summary.rakes_ft != null ? summary.eaves_ft + summary.rakes_ft : null),
  );
  const ridgeCap = roundLf(summary.ridges_hips_ft);
  const valley = roundLf(summary.valleys_ft);
  if (drip) items.push({ name: ROOF_DRIP, quantity: drip });
  if (ridgeCap) items.push({ name: ROOF_RIDGE_CAP, quantity: ridgeCap });
  if (valley) items.push({ name: ROOF_VALLEY, quantity: valley });
  if (summary.steep_squares > 0) {
    items.push({ name: ROOF_STEEP, quantity: Math.round(summary.steep_squares * 100) / 100 });
  }
  return items;
}
