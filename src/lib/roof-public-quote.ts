/** Public /roof ballpark: one building outline x pitch bucket x shingle grade. */

import { CUSTOMER_PER_SQ } from "./home-depot-roof.ts";
import {
  applyWasteFactor,
  SALES_SQUARE_TOLERANCE,
  slopedAreaSqft,
} from "./roof-math.ts";

export type PublicPitchId = "low" | "medium" | "steep";
export type PublicShingleId = "3-tab" | "architectural" | "designer";

export const PUBLIC_PITCH: Record<
  PublicPitchId,
  { id: PublicPitchId; label: string; hint: string; pitch: string; wastePct: number }
> = {
  low: { id: "low", label: "Low", hint: "4/12 or less", pitch: "4/12", wastePct: 12 },
  medium: { id: "medium", label: "Medium", hint: "5/12 to 7/12", pitch: "6/12", wastePct: 12 },
  steep: { id: "steep", label: "Steep", hint: "8/12 or more", pitch: "9/12", wastePct: 15 },
};

/** Catalog 3-tab vs Oakridge. Designer is a one-step bump off architectural. */
const TAB_TO_ARCH = 247.7 / 266.69;
const DESIGNER_TO_ARCH = 1.25;

export const PUBLIC_SHINGLE: Record<
  PublicShingleId,
  { id: PublicShingleId; label: string; hint: string; perSq: number }
> = {
  "3-tab": {
    id: "3-tab",
    label: "3-tab",
    hint: "Basic strip shingle",
    perSq: Math.round(CUSTOMER_PER_SQ * TAB_TO_ARCH * 100) / 100,
  },
  architectural: {
    id: "architectural",
    label: "Architectural",
    hint: "Oakridge / laminated",
    perSq: CUSTOMER_PER_SQ,
  },
  designer: {
    id: "designer",
    label: "Designer",
    hint: "Premium laminate",
    perSq: Math.round(CUSTOMER_PER_SQ * DESIGNER_TO_ARCH * 100) / 100,
  },
};

export const PUBLIC_PITCH_IDS = Object.keys(PUBLIC_PITCH) as PublicPitchId[];
export const PUBLIC_SHINGLE_IDS = Object.keys(PUBLIC_SHINGLE) as PublicShingleId[];

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export type PublicRoofQuote = {
  planSqft: number;
  pitch: string;
  wastePct: number;
  netSquares: number;
  squaresWithWaste: number;
  perSq: number;
  mid: number;
  low: number;
  high: number;
};

/** One roof from the building footprint. Living area and stories do not multiply squares. */
export function publicRoofQuote(
  planSqft: number,
  pitchId: PublicPitchId,
  shingleId: PublicShingleId,
): PublicRoofQuote | null {
  if (!Number.isFinite(planSqft) || planSqft < 200) return null;
  const bucket = PUBLIC_PITCH[pitchId];
  const shingle = PUBLIC_SHINGLE[shingleId];
  const sloped = slopedAreaSqft(planSqft, bucket.pitch);
  const withWaste = applyWasteFactor(sloped, bucket.wastePct);
  const netSquares = round2(sloped / 100);
  const squaresWithWaste = round2(withWaste / 100);
  const perSq = shingle.perSq;
  const pad = SALES_SQUARE_TOLERANCE;
  return {
    planSqft: Math.round(planSqft * 10) / 10,
    pitch: bucket.pitch,
    wastePct: bucket.wastePct,
    netSquares,
    squaresWithWaste,
    perSq,
    mid: Math.round(squaresWithWaste * perSq),
    low: Math.round(Math.max(0, squaresWithWaste - pad) * perSq),
    high: Math.round((squaresWithWaste + pad) * perSq),
  };
}

export function publicRoofLeadMessage(opts: {
  address: string;
  pitchId: PublicPitchId;
  shingleId: PublicShingleId;
  quote: PublicRoofQuote;
  rangeLabel: string;
}): string {
  const pitch = PUBLIC_PITCH[opts.pitchId];
  const shingle = PUBLIC_SHINGLE[opts.shingleId];
  return [
    `Roof ballpark from the website: ${opts.rangeLabel}.`,
    `Address: ${opts.address}.`,
    `${pitch.label} pitch (${pitch.pitch}), ${shingle.label.toLowerCase()} shingles.`,
    `About ${opts.quote.squaresWithWaste.toFixed(1)} squares from the building outline. Not a bid.`,
  ].join(" ");
}
