/** Pitch multipliers, geodesic area, and edge names. Port of flipfixer-roof-training/roof_math.py. */

export const PITCH_MULTIPLIERS: Record<string, number> = {
  "0/12": 1.0,
  "1/12": 1.003,
  "2/12": 1.014,
  "3/12": 1.031,
  "4/12": 1.054,
  "5/12": 1.083,
  "6/12": 1.118,
  "7/12": 1.158,
  "8/12": 1.202,
  "9/12": 1.25,
  "10/12": 1.302,
  "11/12": 1.357,
  "12/12": 1.414,
};

export const PITCH_OPTIONS = Object.keys(PITCH_MULTIPLIERS);

export const FT_PER_M = 3.28084;
export const SQFT_PER_SQM = FT_PER_M ** 2;
export const DEFAULT_WASTE_PCT = 12;

export type LatLng = [number, number];

export type RoofFacet = {
  id: string;
  latlngs: LatLng[];
  pitch: string;
  slopeDeg: number | null;
  wall?: boolean;
  wallEdges?: number[];
};

export type NamedEdge = {
  kind: string;
  length_ft: number;
  plan_ft: number;
  rise_ft: number;
  level: boolean;
  latlngs: LatLng[];
};

export type EdgeClass = {
  classified: boolean;
  eaves_ft: number | null;
  rakes_ft: number | null;
  ridges_ft: number | null;
  hips_ft: number | null;
  valleys_ft: number | null;
  steps_ft: number | null;
  ridges_hips_ft: number | null;
  drip_ft: number | null;
  shared_edges: number;
  edges: NamedEdge[];
};

export type RoofSummary = {
  facet_count: number;
  total_flat_area_sqft: number;
  total_area_with_pitch_multiplier_sqft: number;
  total_squares: number;
  waste_factor_pct: number;
  final_area_sqft_with_waste: number;
  squares_with_waste: number;
  perimeter_ft: number;
  incomplete: string | null;
  eaves_ft: number | null;
  rakes_ft: number | null;
  ridges_ft: number | null;
  hips_ft: number | null;
  valleys_ft: number | null;
  steps_ft: number | null;
  ridges_hips_ft: number | null;
  drip_ft: number | null;
  shared_edges: number;
  edges: NamedEdge[];
  steep_squares: number;
};

function emptyEdges(): EdgeClass {
  return {
    classified: false,
    eaves_ft: null,
    rakes_ft: null,
    ridges_ft: null,
    hips_ft: null,
    valleys_ft: null,
    steps_ft: null,
    ridges_hips_ft: null,
    drip_ft: null,
    shared_edges: 0,
    edges: [],
  };
}

export function normalizePitch(pitch: string | null | undefined): string {
  return String(pitch || "").replace(/\s/g, "");
}

export function pitchMultiplier(pitch: string | null | undefined): number {
  const key = normalizePitch(pitch);
  return key ? (PITCH_MULTIPLIERS[key] ?? 1) : 1;
}

export function pitchRisePerRun(pitch: string | null | undefined): number {
  const key = normalizePitch(pitch);
  if (!key.includes("/")) return 0;
  const [rise, run] = key.split("/", 2);
  const runN = Number(run);
  if (!runN) return 0;
  const riseN = Number(rise);
  return Number.isFinite(riseN) ? riseN / runN : 0;
}

export function slopedAreaSqft(flatSqft: number, pitch: string): number {
  return flatSqft * pitchMultiplier(pitch);
}

export function applyWasteFactor(sqft: number, wastePct = DEFAULT_WASTE_PCT): number {
  return Math.round(sqft * (1 + wastePct / 100) * 10) / 10;
}

/** Perimeter of a rectangle with this floor area. Ranch roofs are ~1.8–2.0:1. */
export function rectanglePerimeterFt(areaSqft: number, aspect = 1.9): number {
  if (areaSqft <= 0 || aspect <= 0) return 0;
  const length = Math.sqrt(areaSqft * aspect);
  const width = areaSqft / length;
  return 2 * (length + width);
}

/**
 * Ballpark squares for a simple 1-story house + attached garage.
 * Footprint plus a drip-edge band, then pitch. Not a bid.
 */
export function oneStoryExpectedSquares(
  livingSqft: number,
  garageSqft = 0,
  pitch = "4/12",
  overhangFt = 1.5,
  wastePct = 0,
  aspect = 1.9,
): number {
  const footprint = Math.max(livingSqft, 0) + Math.max(garageSqft, 0);
  const peri = rectanglePerimeterFt(footprint, aspect);
  const plan = footprint + peri * Math.max(overhangFt, 0);
  let sloped = slopedAreaSqft(plan, pitch);
  if (wastePct) sloped = sloped * (1 + wastePct / 100);
  return Math.round((sloped / 100) * 100) / 100;
}

/**
 * Flag a trace that is way off the building footprint.
 * Returns "low", "ok", or "high".
 */
export function traceSanity(
  measuredSquares: number,
  livingSqft: number,
  garageSqft = 0,
  stories = 1,
  _pitch = "4/12",
): "low" | "ok" | "high" {
  if (measuredSquares <= 0 || livingSqft <= 0) return "ok";
  const storeys = stories && stories > 0 ? stories : 1;
  const footprint = livingSqft / storeys + Math.max(garageSqft, 0);
  if (footprint <= 0) return "ok";
  const ratio = (measuredSquares * 100) / footprint;
  if (ratio < 0.9) return "low";
  if (ratio > 1.55) return "high";
  return "ok";
}

/**
 * Explain a bad square count. The 39-on-a-1,700-sf-ranch pattern is
 * living plan × pitch × two slopes × waste. Pitch already converts plan
 * to slope, so the second ×2 is wrong, and the garage never entered.
 */
export function diagnoseMeasuredSquares(
  measuredSquares: number,
  livingSqft: number,
  garageSqft = 0,
  stories = 1,
  pitch = "4/12",
  wastePct = DEFAULT_WASTE_PCT,
): string {
  const band = traceSanity(measuredSquares, livingSqft, garageSqft, stories, pitch);
  const expected = oneStoryExpectedSquares(livingSqft, garageSqft, pitch);
  const expectedWaste = oneStoryExpectedSquares(livingSqft, garageSqft, pitch, 1.5, wastePct);
  const slopedLiving = slopedAreaSqft(livingSqft, pitch) / 100;
  const doubledLivingWaste = slopedLiving * 2 * (1 + wastePct / 100);
  if (Math.abs(measuredSquares - doubledLivingWaste) <= 2) {
    return (
      `high: living-area plan was counted twice for two slopes, then waste ` +
      `was applied (~${doubledLivingWaste.toFixed(1)} sq). Pitch already converts ` +
      `plan to slope — trace the drip edge once, include the garage. ` +
      `Use ~${expected.toFixed(1)} sq net / ~${expectedWaste.toFixed(1)} with ${wastePct.toFixed(0)}% waste.`
    );
  }
  if (band === "high") {
    return (
      `high: ${measuredSquares.toFixed(1)} sq is well above a 1-story ` +
      `${(livingSqft + garageSqft).toFixed(0)} sf footprint (~${expected.toFixed(1)} sq). ` +
      `Check for overlapping planes, a leftover scale length, or waste stacked ` +
      `on an already-sloped number. Use ~${expectedWaste.toFixed(1)} with waste.`
    );
  }
  if (band === "low") {
    return (
      `low: ${measuredSquares.toFixed(1)} sq looks like living area only. ` +
      `Add the garage. Expect ~${expected.toFixed(1)} sq net.`
    );
  }
  return (
    `ok: ${measuredSquares.toFixed(1)} sq is in band for this footprint ` +
    `(~${expected.toFixed(1)} net / ~${expectedWaste.toFixed(1)} with waste).`
  );
}

/** Block a bid when the smell test fails. Overlap is flagged earlier on the summary. */
export function roofTraceReadyToBid(summary: RoofSummary): boolean {
  return !summary.incomplete && summary.squares_with_waste > 0;
}

export function withFootprintSanity(
  summary: RoofSummary,
  livingSqft: number,
  garageSqft = 0,
  stories = 1,
  pitch = "4/12",
): RoofSummary {
  if (summary.incomplete) return summary;
  if (!(livingSqft > 0)) return summary;
  const measured = summary.squares_with_waste || summary.total_squares;
  if (!(measured > 0)) return summary;
  const msg = diagnoseMeasuredSquares(
    measured,
    livingSqft,
    garageSqft,
    stories,
    pitch,
    summary.waste_factor_pct,
  );
  if (msg.startsWith("ok")) return summary;
  return { ...summary, incomplete: msg };
}

export const OVERLAP_PLANES_MESSAGE =
  "Planes overlap. Trace the drip edge once — do not outline the whole house for each slope.";


export function metersPerDegree(latDegrees: number): [number, number] {
  const lat = (latDegrees * Math.PI) / 180;
  const mPerDegLat = 111132.92 - 559.82 * Math.cos(2 * lat) + 1.175 * Math.cos(4 * lat);
  const mPerDegLng = 111412.84 * Math.cos(lat) - 93.5 * Math.cos(3 * lat);
  return [mPerDegLat, mPerDegLng];
}

function closeRing(latlngs: LatLng[]): LatLng[] {
  if (latlngs.length < 2) return [...latlngs];
  const first = latlngs[0];
  const last = latlngs[latlngs.length - 1];
  if (first[0] === last[0] && first[1] === last[1]) return [...latlngs];
  return [...latlngs, first];
}

export function geodesicRingAreaSqft(latlngs: LatLng[]): number {
  const ring = closeRing(latlngs);
  if (ring.length < 4) return 0;
  const lat0 = ring.slice(0, -1).reduce((sum, pt) => sum + pt[0], 0) / (ring.length - 1);
  const [mLat, mLng] = metersPerDegree(lat0);
  let areaM2 = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [lat1, lng1] = ring[i];
    const [lat2, lng2] = ring[i + 1];
    const x1 = lng1 * mLng;
    const y1 = lat1 * mLat;
    const x2 = lng2 * mLng;
    const y2 = lat2 * mLat;
    areaM2 += x1 * y2 - x2 * y1;
  }
  return (Math.abs(areaM2) / 2) * SQFT_PER_SQM;
}

export function geodesicRingPerimeterFt(latlngs: LatLng[]): number {
  const ring = closeRing(latlngs);
  if (ring.length < 2) return 0;
  const [mLat, mLng] = metersPerDegree(ring[0][0]);
  let totalM = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [lat1, lng1] = ring[i];
    const [lat2, lng2] = ring[i + 1];
    const dx = (lng2 - lng1) * mLng;
    const dy = (lat2 - lat1) * mLat;
    totalM += Math.hypot(dx, dy);
  }
  return totalM * FT_PER_M;
}

function ringPoints(latlngs: LatLng[] | undefined): LatLng[] {
  const pts = (latlngs || []).map((pt) => [Number(pt[0]), Number(pt[1])] as LatLng);
  if (pts.length >= 2 && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1]) {
    return pts.slice(0, -1);
  }
  return pts;
}

function toLocalFt(latlngs: LatLng[], lat0: number): [number, number][] {
  const [mLat, mLng] = metersPerDegree(lat0);
  return latlngs.map(([lat, lng]) => [lng * mLng * FT_PER_M, lat * mLat * FT_PER_M]);
}

export type PlanPt = [number, number];

function signedPlanArea(pts: PlanPt[]): number {
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    area += x1 * y2 - x2 * y1;
  }
  return area / 2;
}

function ensureCcw(pts: PlanPt[]): PlanPt[] {
  return signedPlanArea(pts) < 0 ? [...pts].reverse() : pts;
}

function isLeftOf(a: PlanPt, b: PlanPt, p: PlanPt): boolean {
  return (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]) >= -1e-9;
}

function lineHit(p1: PlanPt, p2: PlanPt, a: PlanPt, b: PlanPt): PlanPt {
  const den = (p1[0] - p2[0]) * (a[1] - b[1]) - (p1[1] - p2[1]) * (a[0] - b[0]);
  if (Math.abs(den) < 1e-12) return p2;
  const t = ((p1[0] - a[0]) * (a[1] - b[1]) - (p1[1] - a[1]) * (a[0] - b[0])) / den;
  return [p1[0] + t * (p2[0] - p1[0]), p1[1] + t * (p2[1] - p1[1])];
}

/** Convex clip. Roof planes and full-house outlines are convex. */
export function clipPolygon(subject: PlanPt[], clip: PlanPt[]): PlanPt[] {
  let output = ensureCcw(subject);
  const clipCcw = ensureCcw(clip);
  for (let i = 0; i < clipCcw.length; i++) {
    const a = clipCcw[i];
    const b = clipCcw[(i + 1) % clipCcw.length];
    const input = output;
    output = [];
    if (!input.length) break;
    for (let j = 0; j < input.length; j++) {
      const p = input[j];
      const q = input[(j + 1) % input.length];
      const pIn = isLeftOf(a, b, p);
      const qIn = isLeftOf(a, b, q);
      if (pIn && qIn) output.push(q);
      else if (pIn && !qIn) output.push(lineHit(p, q, a, b));
      else if (!pIn && qIn) {
        output.push(lineHit(p, q, a, b));
        output.push(q);
      }
    }
  }
  return output;
}

/** Intersection / min(area). Two full-house outlines land near 1. Adjacent slopes near 0. */
export function ringOverlapCoverage(a: PlanPt[], b: PlanPt[]): number {
  const areaA = Math.abs(signedPlanArea(a));
  const areaB = Math.abs(signedPlanArea(b));
  if (areaA < 1e-6 || areaB < 1e-6) return 0;
  const inter = Math.abs(signedPlanArea(clipPolygon(a, b)));
  return inter / Math.min(areaA, areaB);
}

export const FULL_PLAN_OVERLAP = 0.5;

export function hasOverlappingFullPlanRings(rings: PlanPt[][]): boolean {
  for (let i = 0; i < rings.length; i++) {
    if (rings[i].length < 3) continue;
    for (let j = i + 1; j < rings.length; j++) {
      if (rings[j].length < 3) continue;
      if (ringOverlapCoverage(rings[i], rings[j]) >= FULL_PLAN_OVERLAP) return true;
    }
  }
  return false;
}

function facetLocalRings(facets: RoofFacet[]): PlanPt[][] {
  const prepared = facets.filter((facet) => ringPoints(facet.latlngs).length >= 3);
  if (!prepared.length) return [];
  const lats = prepared.flatMap((facet) => ringPoints(facet.latlngs).map((pt) => pt[0]));
  const lat0 = lats.reduce((sum, lat) => sum + lat, 0) / lats.length;
  return prepared.map((facet) => toLocalFt(ringPoints(facet.latlngs), lat0));
}

function descentEn(slopeDeg: number): [number, number] {
  const rad = (slopeDeg * Math.PI) / 180;
  return [Math.sin(rad), Math.cos(rad)];
}

function snapPt(pt: [number, number], snapFt: number): [number, number] {
  return [Math.round(pt[0] / snapFt), Math.round(pt[1] / snapFt)];
}

type Drain = "along" | "toward" | "away" | null;

type EdgeSlot = {
  sides: { drains: Drain; rise: number | null; wall: boolean }[];
  plans: number[];
  rises: number[];
  ends: Map<string, LatLng[]>;
};

function snapKey(a: [number, number], b: [number, number]): string {
  return `${a[0]},${a[1]}|${b[0]},${b[1]}`;
}

export function classifyEdges(facets: RoofFacet[], snapFt = 2): EdgeClass {
  const empty = emptyEdges();
  const prepared = facets.filter((facet) => ringPoints(facet.latlngs).length >= 3);
  if (!prepared.length) return empty;
  if (!prepared.some((facet) => facet.slopeDeg != null)) return empty;

  const lats = prepared.flatMap((facet) => ringPoints(facet.latlngs).map((pt) => pt[0]));
  const lat0 = lats.reduce((sum, lat) => sum + lat, 0) / lats.length;
  const groups = new Map<string, EdgeSlot>();

  for (const facet of prepared) {
    const pts = ringPoints(facet.latlngs);
    const local = toLocalFt(pts, lat0);
    let signed = 0;
    for (let i = 0; i < local.length; i++) {
      const [x1, y1] = local[i];
      const [x2, y2] = local[(i + 1) % local.length];
      signed += x1 * y2 - x2 * y1;
    }
    const ccw = signed > 0;
    const risePer = pitchRisePerRun(facet.pitch);
    const descent = facet.slopeDeg == null ? null : descentEn(facet.slopeDeg);
    const upslope = descent ? ([-descent[0], -descent[1]] as [number, number]) : null;
    const origin = local[0];
    const wallEdges = new Set(facet.wallEdges || []);
    const facetWall = Boolean(facet.wall);
    for (let i = 0; i < local.length; i++) {
      const p1 = local[i];
      const p2 = local[(i + 1) % local.length];
      const dx = p2[0] - p1[0];
      const dy = p2[1] - p1[1];
      const plan = Math.hypot(dx, dy);
      if (plan < 0.05) continue;
      const a = snapPt(p1, snapFt);
      const b = snapPt(p2, snapFt);
      const keyPair = [a, b].sort((left, right) => left[0] - right[0] || left[1] - right[1]);
      if (keyPair[0][0] === keyPair[1][0] && keyPair[0][1] === keyPair[1][1]) continue;
      const key = snapKey(keyPair[0], keyPair[1]);
      let rise: number | null = null;
      let drains: Drain = null;
      if (upslope && descent) {
        const h1 = risePer * ((p1[0] - origin[0]) * upslope[0] + (p1[1] - origin[1]) * upslope[1]);
        const h2 = risePer * ((p2[0] - origin[0]) * upslope[0] + (p2[1] - origin[1]) * upslope[1]);
        rise = Math.abs(h2 - h1);
        const left: [number, number] = [-dy / plan, dx / plan];
        const inward = ccw ? left : ([-left[0], -left[1]] as [number, number]);
        const dot = descent[0] * inward[0] + descent[1] * inward[1];
        if (Math.abs(dot) < 0.3) drains = "along";
        else if (dot < 0) drains = "toward";
        else drains = "away";
      }
      const wallSide = wallEdges.has(i) || (facetWall && drains === "away");
      const slot: EdgeSlot = groups.get(key) ?? { sides: [], plans: [], rises: [], ends: new Map() };
      slot.sides.push({ drains, rise, wall: wallSide });
      slot.plans.push(plan);
      if (rise != null) slot.rises.push(rise);
      const endPairs: [[number, number], LatLng][] = [
        [snapPt(p1, snapFt), pts[i]],
        [snapPt(p2, snapFt), pts[(i + 1) % pts.length]],
      ];
      for (const [snap, latlng] of endPairs) {
        const endKey = `${snap[0]},${snap[1]}`;
        const samples = slot.ends.get(endKey) ?? [];
        samples.push(latlng);
        slot.ends.set(endKey, samples);
      }
      groups.set(key, slot);
    }
  }

  const edges: NamedEdge[] = [];
  for (const slot of groups.values()) {
    const plan = slot.plans.reduce((sum, n) => sum + n, 0) / slot.plans.length;
    const rise = slot.rises.length ? slot.rises.reduce((sum, n) => sum + n, 0) / slot.rises.length : 0;
    const level = rise <= Math.max(0.4, 0.03 * plan);
    const length = level ? plan : Math.hypot(plan, rise);
    const drains = slot.sides.map((side) => side.drains);
    const wall = slot.sides.some((side) => side.wall);
    let kind = "unclassified";
    if (drains.length && drains.every((item) => item != null)) {
      if (wall && drains.length === 1 && !(drains[0] === "toward" && level)) {
        kind = "step";
      } else if (drains.length === 1) {
        if (drains[0] === "away" && level) kind = "step";
        else if (drains[0] === "toward" && level) kind = "eave";
        else kind = "rake";
      } else if (drains.length === 2) {
        const pair = new Set(drains);
        if ((pair.size === 1 && pair.has("toward")) || (pair.has("toward") && pair.has("along") && pair.size === 2)) {
          kind = "valley";
        } else if (pair.size === 1 && pair.has("away") && level) {
          kind = "ridge";
        } else if ((pair.size === 1 && pair.has("away")) || (pair.has("away") && pair.has("along") && pair.size === 2)) {
          kind = "hip";
        } else {
          kind = "step";
        }
      }
    }
    const ends: LatLng[] = [];
    for (const samples of slot.ends.values()) {
      ends.push([
        Math.round((samples.reduce((sum, pt) => sum + pt[0], 0) / samples.length) * 1e7) / 1e7,
        Math.round((samples.reduce((sum, pt) => sum + pt[1], 0) / samples.length) * 1e7) / 1e7,
      ]);
    }
    edges.push({
      kind,
      length_ft: Math.round(length * 10) / 10,
      plan_ft: Math.round(plan * 10) / 10,
      rise_ft: Math.round(rise * 100) / 100,
      level,
      latlngs: ends.slice(0, 2),
    });
  }

  const total = (kind: string) =>
    Math.round(edges.filter((edge) => edge.kind === kind).reduce((sum, edge) => sum + edge.length_ft, 0) * 10) / 10;
  const eaves = total("eave");
  const rakes = total("rake");
  const ridges = total("ridge");
  const hips = total("hip");
  const valleys = total("valley");
  const named = edges.some((edge) => edge.kind !== "unclassified");
  return {
    classified: named,
    eaves_ft: eaves,
    rakes_ft: rakes,
    ridges_ft: ridges,
    hips_ft: hips,
    valleys_ft: valleys,
    steps_ft: total("step"),
    ridges_hips_ft: Math.round((ridges + hips) * 10) / 10,
    drip_ft: Math.round((eaves + rakes) * 10) / 10,
    shared_edges: [...groups.values()].filter((slot) => slot.sides.length >= 2).length,
    edges,
  };
}

export function summarizeFacets(facets: RoofFacet[], wastePct = DEFAULT_WASTE_PCT): RoofSummary {
  let flat = 0;
  let sloped = 0;
  let perimeter = 0;
  let steepSloped = 0;
  let missingPitch = false;
  let count = 0;
  for (const facet of facets) {
    const latlngs = ringPoints(facet.latlngs);
    if (latlngs.length < 3) continue;
    count += 1;
    const facetFlat = geodesicRingAreaSqft(latlngs);
    if (!normalizePitch(facet.pitch)) missingPitch = true;
    const pitch = normalizePitch(facet.pitch) || "0/12";
    const facetSloped = slopedAreaSqft(facetFlat, pitch);
    flat += facetFlat;
    sloped += facetSloped;
    perimeter += geodesicRingPerimeterFt(latlngs);
    if (pitchRisePerRun(pitch) >= 7 / 12) steepSloped += facetSloped;
  }
  const edges = classifyEdges(facets);
  const slopedRounded = Math.round(sloped * 10) / 10;
  const withWaste = applyWasteFactor(slopedRounded, wastePct);
  const overlap = hasOverlappingFullPlanRings(facetLocalRings(facets));
  return {
    facet_count: count,
    total_flat_area_sqft: Math.round(flat * 10) / 10,
    total_area_with_pitch_multiplier_sqft: slopedRounded,
    total_squares: Math.round((slopedRounded / 100) * 100) / 100,
    waste_factor_pct: wastePct,
    final_area_sqft_with_waste: withWaste,
    squares_with_waste: Math.round((withWaste / 100) * 100) / 100,
    perimeter_ft: edges.classified && edges.drip_ft != null ? edges.drip_ft : Math.round(perimeter * 10) / 10,
    incomplete:
      count === 0
        ? "Draw at least one roof plane."
        : overlap
          ? OVERLAP_PLANES_MESSAGE
          : missingPitch
            ? "Every facet needs a pitch."
            : null,
    eaves_ft: edges.eaves_ft,
    rakes_ft: edges.rakes_ft,
    ridges_ft: edges.ridges_ft,
    hips_ft: edges.hips_ft,
    valleys_ft: edges.valleys_ft,
    steps_ft: edges.steps_ft,
    ridges_hips_ft: edges.ridges_hips_ft,
    drip_ft: edges.drip_ft,
    shared_edges: edges.shared_edges,
    edges: edges.edges,
    steep_squares: Math.round((steepSloped / 100) * 100) / 100,
  };
}

export const PHOTO_LAT0 = 29.4417;
export const PHOTO_LNG0 = -98.679;

export function feetRing(pts: [number, number][], lat0 = PHOTO_LAT0, lng0 = PHOTO_LNG0): LatLng[] {
  const [mLat, mLng] = metersPerDegree(lat0);
  return pts.map(([east, north]) => [
    lat0 + north / FT_PER_M / mLat,
    lng0 + east / FT_PER_M / mLng,
  ]);
}

export function latlngToPhotoPx(
  latlng: LatLng,
  ftPerPx: number,
  lat0 = PHOTO_LAT0,
  lng0 = PHOTO_LNG0,
): Px {
  const [mLat, mLng] = metersPerDegree(lat0);
  const north = (latlng[0] - lat0) * mLat * FT_PER_M;
  const east = (latlng[1] - lng0) * mLng * FT_PER_M;
  return [east / ftPerPx, -north / ftPerPx];
}

/** Wall width plus barge overhang on both gables. That roof gable is the scale length. */
export function gableRoofFt(garageWidthFt: number, rakeOverhangIn: number): number {
  if (!Number.isFinite(garageWidthFt) || garageWidthFt <= 0) return 0;
  const rakeFt = Number.isFinite(rakeOverhangIn) && rakeOverhangIn > 0 ? rakeOverhangIn / 12 : 0;
  return Math.round((garageWidthFt + 2 * rakeFt) * 100) / 100;
}

export function inchesToFt(inches: number): number {
  if (!Number.isFinite(inches) || inches <= 0) return 0;
  return Math.round((inches / 12) * 100) / 100;
}

export type Px = [number, number];

export function pixelDistance(a: Px, b: Px): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

export function polygonAreaPx(points: Px[]): number {
  if (points.length < 3) return 0;
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    area += x1 * y2 - x2 * y1;
  }
  return Math.abs(area) / 2;
}

export function ftPerPxFromScale(a: Px, b: Px, feet: number): number | null {
  const px = pixelDistance(a, b);
  if (px < 1 || !Number.isFinite(feet) || feet <= 0) return null;
  return feet / px;
}

export type PhotoFacet = {
  id: string;
  points: Px[];
  pitch: string;
  slopeDeg?: number | null;
};

export type PhotoEdge = {
  kind: string;
  a: Px;
  b: Px;
  length_ft: number;
};

function photoSegmentKey(a: Px, b: Px): string {
  const snap = (n: number) => Math.round(n);
  const left = snap(a[0]) < snap(b[0]) || (snap(a[0]) === snap(b[0]) && snap(a[1]) <= snap(b[1]));
  const [p, q] = left ? [a, b] : [b, a];
  return `${snap(p[0])},${snap(p[1])}|${snap(q[0])},${snap(q[1])}`;
}

export function photoFacetsToRoof(facets: PhotoFacet[], ftPerPx: number): RoofFacet[] {
  return facets
    .filter((facet) => facet.points.length >= 3)
    .map((facet) => ({
      id: facet.id,
      pitch: facet.pitch,
      slopeDeg: facet.slopeDeg ?? null,
      latlngs: feetRing(facet.points.map(([x, y]) => [x * ftPerPx, -y * ftPerPx])),
    }));
}

function unclassifiedPhotoEdges(facets: PhotoFacet[], ftPerPx: number): PhotoEdge[] {
  const seen = new Map<string, PhotoEdge>();
  for (const facet of facets) {
    const n = facet.points.length;
    if (n < 2) continue;
    for (let i = 0; i < n; i++) {
      const a = facet.points[i];
      const b = facet.points[(i + 1) % n];
      const key = photoSegmentKey(a, b);
      if (seen.has(key)) {
        seen.delete(key);
        continue;
      }
      seen.set(key, {
        kind: "unclassified",
        a,
        b,
        length_ft: Math.round(pixelDistance(a, b) * ftPerPx * 10) / 10,
      });
    }
  }
  return [...seen.values()];
}

export function photoEdges(facets: PhotoFacet[], ftPerPx: number | null): PhotoEdge[] {
  if (ftPerPx == null || ftPerPx <= 0) return [];
  const roof = photoFacetsToRoof(facets, ftPerPx);
  const classified = classifyEdges(roof);
  if (!classified.classified) return unclassifiedPhotoEdges(facets, ftPerPx);
  return classified.edges
    .filter((edge) => edge.latlngs.length >= 2)
    .map((edge) => ({
      kind: edge.kind,
      a: latlngToPhotoPx(edge.latlngs[0], ftPerPx),
      b: latlngToPhotoPx(edge.latlngs[1], ftPerPx),
      length_ft: edge.length_ft,
    }));
}

export type PhotoMeasure = {
  id: string;
  a: Px;
  b: Px;
  name: string;
  kind?: "ridge" | "hip" | "valley" | "rake" | "eave";
};

export function summarizePhotoFacets(
  facets: PhotoFacet[],
  ftPerPx: number | null,
  wastePct = DEFAULT_WASTE_PCT,
  lines: PhotoMeasure[] = [],
  pitch?: string,
): RoofSummary {
  const emptyEdges: NamedEdge[] = [];
  if (ftPerPx == null || ftPerPx <= 0) {
    return {
      facet_count: 0,
      total_flat_area_sqft: 0,
      total_area_with_pitch_multiplier_sqft: 0,
      total_squares: 0,
      waste_factor_pct: wastePct,
      final_area_sqft_with_waste: 0,
      squares_with_waste: 0,
      perimeter_ft: 0,
      incomplete: "Label a known length so the picture has a scale.",
      eaves_ft: null,
      rakes_ft: null,
      ridges_ft: null,
      hips_ft: null,
      valleys_ft: null,
      steps_ft: null,
      ridges_hips_ft: null,
      drip_ft: null,
      shared_edges: 0,
      edges: emptyEdges,
      steep_squares: 0,
    };
  }
  let flat = 0;
  let sloped = 0;
  let peri = 0;
  let steepSloped = 0;
  let missingPitch = false;
  let count = 0;
  for (const facet of facets) {
    if (facet.points.length < 3) continue;
    count += 1;
    const facetFlat = polygonAreaPx(facet.points) * ftPerPx * ftPerPx;
    if (!normalizePitch(facet.pitch)) missingPitch = true;
    const pitch = normalizePitch(facet.pitch) || "0/12";
    const facetSloped = slopedAreaSqft(facetFlat, pitch);
    flat += facetFlat;
    sloped += facetSloped;
    for (let i = 0; i < facet.points.length; i++) {
      peri += pixelDistance(facet.points[i], facet.points[(i + 1) % facet.points.length]) * ftPerPx;
    }
    if (pitchRisePerRun(pitch) >= 7 / 12) steepSloped += facetSloped;
  }
  const slopedRounded = Math.round(sloped * 10) / 10;
  const withWaste = applyWasteFactor(slopedRounded, wastePct);
  const classified = classifyEdges(photoFacetsToRoof(facets, ftPerPx));
  const linePitch = pitch || facets.find((facet) => normalizePitch(facet.pitch))?.pitch || "5/12";
  const overlap = hasOverlappingFullPlanRings(facets.map((facet) => facet.points));
  return applyDrawnLines(
    {
      facet_count: count,
      total_flat_area_sqft: Math.round(flat * 10) / 10,
      total_area_with_pitch_multiplier_sqft: slopedRounded,
      total_squares: Math.round((slopedRounded / 100) * 100) / 100,
      waste_factor_pct: wastePct,
      final_area_sqft_with_waste: withWaste,
      squares_with_waste: Math.round((withWaste / 100) * 100) / 100,
      perimeter_ft: Math.round(peri * 10) / 10,
      incomplete:
        count === 0
          ? "Draw at least one roof plane on the plan photo."
          : overlap
            ? OVERLAP_PLANES_MESSAGE
            : missingPitch
              ? "Every facet needs a pitch."
              : null,
      eaves_ft: classified.eaves_ft,
      rakes_ft: classified.rakes_ft,
      ridges_ft: classified.ridges_ft,
      hips_ft: classified.hips_ft,
      valleys_ft: classified.valleys_ft,
      steps_ft: classified.steps_ft,
      ridges_hips_ft: classified.ridges_hips_ft,
      drip_ft: classified.drip_ft,
      shared_edges: classified.shared_edges,
      edges: classified.edges.length ? classified.edges : emptyEdges,
      steep_squares: Math.round((steepSloped / 100) * 100) / 100,
    },
    lines,
    ftPerPx,
    linePitch,
  );
}

/** Plan length from the photo. EagleView prints 3D (along-the-roof) lengths instead. */
export function lineTrueLengthFt(
  a: Px,
  b: Px,
  kind: PhotoMeasure["kind"] | undefined,
  ftPerPx: number,
  pitch: string,
): number {
  const plan = pixelDistance(a, b) * ftPerPx;
  const risePer = pitchRisePerRun(pitch);
  if (!kind || risePer <= 0 || kind === "eave" || kind === "ridge") return plan;
  if (kind === "rake") return Math.hypot(plan, plan * risePer);
  return Math.hypot(plan, (plan * risePer) / Math.SQRT2);
}

export function applyDrawnLines(
  summary: RoofSummary,
  lines: PhotoMeasure[],
  ftPerPx: number | null,
  pitch = "5/12",
): RoofSummary {
  if (ftPerPx == null || ftPerPx <= 0 || !lines.length) return summary;
  const add = { eave: 0, rake: 0, ridge: 0, hip: 0, valley: 0 };
  let any = false;
  for (const line of lines) {
    const kind = line.kind;
    if (!kind || !(kind in add)) continue;
    add[kind] += lineTrueLengthFt(line.a, line.b, kind, ftPerPx, pitch);
    any = true;
  }
  if (!any) return summary;
  const round = (n: number) => Math.round(n * 10) / 10;
  const eaves = round((summary.eaves_ft ?? 0) + add.eave);
  const rakes = round((summary.rakes_ft ?? 0) + add.rake);
  const ridges = round((summary.ridges_ft ?? 0) + add.ridge);
  const hips = round((summary.hips_ft ?? 0) + add.hip);
  const valleys = round((summary.valleys_ft ?? 0) + add.valley);
  return {
    ...summary,
    eaves_ft: eaves,
    rakes_ft: rakes,
    ridges_ft: ridges,
    hips_ft: hips,
    valleys_ft: valleys,
    ridges_hips_ft: round(ridges + hips),
    drip_ft: round(eaves + rakes),
  };
}

export function measureLengthFt(
  measure: PhotoMeasure,
  ftPerPx: number | null,
  pitch = "5/12",
): number | null {
  if (ftPerPx == null) return null;
  return Math.round(lineTrueLengthFt(measure.a, measure.b, measure.kind, ftPerPx, pitch) * 10) / 10;
}
