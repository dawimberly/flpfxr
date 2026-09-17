import {
  applyWasteFactor,
  eagleViewWaste,
  pitchRisePerRun,
  type RoofSummary,
} from "./roof-math.ts";

export type EagleViewReport = {
  address: string;
  areaSqft: number;
  facets: number;
  pitch: string;
  ridgesFt: number;
  hipsFt: number;
  valleysFt: number;
  rakesFt: number;
  eavesFt: number;
  rakeCount: number;
  valleyCount: number;
  hipCount: number;
  storiesOverOne: boolean;
  wastePct: number;
  summary: RoofSummary;
};

function grab(rx: RegExp, text: string): string {
  const m = text.match(rx);
  return m?.[1]?.replace(/,/g, "").trim() ?? "";
}

function num(rx: RegExp, text: string): number {
  const raw = grab(rx, text);
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function int(rx: RegExp, text: string): number {
  return Math.round(num(rx, text));
}

function grabAddress(text: string): string {
  const matches = [...text.matchAll(/(\d{2,6}\s+[A-Za-z0-9.' ]+[, ]+[A-Za-z .']+[, ]+[A-Z]{2}\s+\d{5}(?:-\d{4})?)/g)];
  const rows = matches.map((m) => m[1].replace(/^(?:19|20)\d{2}\s+/, "").trim());
  return (
    rows.find(
      (row) =>
        /^\d{3,5}\s/.test(row) &&
        /(?:st|street|dr|drive|rd|road|ave|ln|way|ct|blvd|[nsew])\b/i.test(row),
    ) ||
    rows[0] ||
    ""
  );
}

export function isEagleViewText(text: string): boolean {
  return /Eagle\s*View Technologies|EagleView/i.test(text);
}

export function parseEagleViewText(text: string): EagleViewReport | null {
  if (!isEagleViewText(text)) return null;
  const areaSqft =
    num(/Total Roof Area\s*=\s*([\d,]+)\s*sq\s*ft/i, text) ||
    num(/Total Area(?:\s*\(All Pitches\))?\s*=\s*([\d,]+)\s*sq\s*ft/i, text);
  if (areaSqft < 200) return null;
  const pitchRaw =
    grab(/Predominant Pitch\s*=\s*(\d+\s*\/\s*12)/i, text) || "5/12";
  const pitch = pitchRaw.replace(/\s/g, "");
  const facets = int(/Total Roof Facets\s*=\s*(\d+)/i, text);
  const ridgesFt = num(/Total Ridges\s*=\s*([\d.]+)\s*ft/i, text);
  const hipsFt = num(/(?:^|[^/])Hips\s*=\s*([\d.]+)\s*ft/im, text);
  const ridgesHipsCombo = num(/Total Ridges\/Hips\s*=\s*([\d.]+)\s*ft/i, text);
  const valleysFt = num(/\bValleys\s*=\s*([\d.]+)\s*ft/i, text);
  const rakesFt = num(/\bRakes[^\n=]*=\s*([\d.]+)\s*ft/i, text);
  const eavesFt = num(/\bEaves[^\n=]*=\s*([\d.]+)\s*ft/i, text);
  const rakeCount = int(/\(\s*(\d+)\s+Rakes?\)/i, text);
  const valleyCount = int(/\(\s*(\d+)\s+Valleys?\)/i, text);
  const hipCount = int(/\(\s*(\d+)\s+Hips?\)/i, text);
  const storiesOverOne = /Number of Stories\s*>\s*1/i.test(text);
  const address = grabAddress(text);
  const ridgeCap = (ridgesFt || 0) + (hipsFt || 0) || ridgesHipsCombo;
  const waste = eagleViewWaste({
    pitch,
    rakeCount,
    valleyCount,
  });
  const drip = eavesFt + rakesFt || null;
  const withWaste = applyWasteFactor(areaSqft, waste.totalPct);
  const totalSquares = Math.round((areaSqft / 100) * 100) / 100;
  const rise = pitchRisePerRun(pitch);
  const steepSquares = rise >= 7 / 12 ? totalSquares : 0;
  const summary: RoofSummary = {
    facet_count: facets,
    total_flat_area_sqft: Math.round(areaSqft),
    total_area_with_pitch_multiplier_sqft: Math.round(areaSqft),
    total_squares: totalSquares,
    waste_factor_pct: waste.totalPct,
    final_area_sqft_with_waste: withWaste,
    squares_with_waste: Math.round((withWaste / 100) * 100) / 100,
    perimeter_ft: Math.round((eavesFt + rakesFt) * 10) / 10,
    incomplete: null,
    eaves_ft: eavesFt || null,
    rakes_ft: rakesFt || null,
    ridges_ft: ridgesFt || null,
    hips_ft: hipsFt || null,
    valleys_ft: valleysFt || null,
    steps_ft: null,
    ridges_hips_ft: ridgeCap || null,
    drip_ft: drip || null,
    shared_edges: 0,
    edges: [],
    steep_squares: steepSquares,
  };
  return {
    address,
    areaSqft,
    facets,
    pitch,
    ridgesFt,
    hipsFt,
    valleysFt,
    rakesFt,
    eavesFt,
    rakeCount,
    valleyCount,
    hipCount,
    storiesOverOne,
    wastePct: waste.totalPct,
    summary,
  };
}

