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
/** Only for an explicit extra bundle pad. EagleView does not stack this on pitched squares. */
export const DEFAULT_WASTE_PCT = 12;
/** Sales quote band. Not an EagleView. */
export const SALES_SQUARE_TOLERANCE = 2;
export const SEARCH_QUOTE_LINE =
  "This is a size estimate from your roof's footprint and what you tap off the photos — pitch, valleys, vents, solar — not a measured roof; the real number comes once we pull an EagleView.";

export function salesSquares(squares: number) {
  if (!Number.isFinite(squares) || squares <= 0) return 0;
  return Math.round(squares);
}

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

export type EagleViewWaste = {
  basePct: number;
  valleyPct: number;
  steepPct: number;
  totalPct: number;
};

function countEdges(edges: NamedEdge[], kind: string): number {
  return edges.filter((edge) => edge.kind === kind).length;
}

/**
 * Suggested asphalt waste from EagleView summaries in the MRC set:
 * 8% one gable, 10% if a 2nd gable/endwall (4+ rakes), +1% per valley,
 * then extra when pitch is 7/12+ (cutoffs will not stay on the roof) and more at 9/12 and 12/12.
 */
export function eagleViewWaste(opts: {
  pitch?: string | null;
  rakeCount?: number | null;
  valleyCount?: number | null;
}): EagleViewWaste {
  const rakes = Math.max(0, Math.round(opts.rakeCount ?? 0));
  const valleys = Math.max(0, Math.round(opts.valleyCount ?? 0));
  const rise = pitchRisePerRun(opts.pitch || "0/12");
  const basePct = rakes >= 4 ? 10 : 8;
  let steepPct = 0;
  if (rise >= 7 / 12) steepPct += 2;
  if (rise >= 9 / 12) steepPct += 2;
  if (rise >= 12 / 12) steepPct += 2;
  const totalPct = Math.min(30, basePct + valleys + steepPct);
  return { basePct, valleyPct: valleys, steepPct, totalPct };
}

function attachSquareWaste(
  summary: RoofSummary,
  wastePct: number | undefined,
  pitch: string,
): RoofSummary {
  if (wastePct != null) {
    const withWaste = applyWasteFactor(summary.total_area_with_pitch_multiplier_sqft, wastePct);
    return {
      ...summary,
      waste_factor_pct: wastePct,
      final_area_sqft_with_waste: withWaste,
      squares_with_waste: Math.round((withWaste / 100) * 100) / 100,
    };
  }
  const ev = eagleViewWaste({
    pitch,
    rakeCount: countEdges(summary.edges, "rake"),
    valleyCount: countEdges(summary.edges, "valley"),
  });
  const withWaste = applyWasteFactor(summary.total_area_with_pitch_multiplier_sqft, ev.totalPct);
  return {
    ...summary,
    waste_factor_pct: ev.totalPct,
    final_area_sqft_with_waste: withWaste,
    squares_with_waste: Math.round((withWaste / 100) * 100) / 100,
  };
}

function predominantPitch(facets: Array<{ pitch: string }>, fallback = "5/12"): string {
  return normalizePitch(facets.find((facet) => normalizePitch(facet.pitch))?.pitch) || fallback;
}

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

export function geodesicSegmentFt(a: LatLng, b: LatLng): number {
  const [mLat, mLng] = metersPerDegree(a[0]);
  const dx = (b[1] - a[1]) * mLng;
  const dy = (b[0] - a[0]) * mLat;
  return Math.hypot(dx, dy) * FT_PER_M;
}

export function geodesicRingPerimeterFt(latlngs: LatLng[]): number {
  const ring = closeRing(latlngs);
  if (ring.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    total += geodesicSegmentFt(ring[i], ring[i + 1]);
  }
  return total;
}

export const ROOF_VERTEX_SNAP_FT = 2.5;

export function snapRoofLatLng(
  pt: LatLng,
  anchors: LatLng[],
  maxFt = ROOF_VERTEX_SNAP_FT,
): LatLng {
  let best = pt;
  let bestFt = maxFt;
  for (const anchor of anchors) {
    const ft = geodesicSegmentFt(pt, anchor);
    if (ft <= bestFt) {
      best = [anchor[0], anchor[1]];
      bestFt = ft;
    }
  }
  return best;
}

export function roofSnapAnchors(facets: RoofFacet[], draft: LatLng[] = []): LatLng[] {
  return [...facets.flatMap((facet) => ringPoints(facet.latlngs)), ...draft];
}

/** Drop a closing tap that is already on the first corner. */
export function closeRoofRing(latlngs: LatLng[], maxFt = ROOF_VERTEX_SNAP_FT): LatLng[] {
  if (latlngs.length < 3) return latlngs;
  const first = latlngs[0];
  const last = latlngs[latlngs.length - 1];
  if (geodesicSegmentFt(first, last) <= maxFt) return latlngs.slice(0, -1);
  return latlngs;
}

/** Pull this plane’s corners onto existing planes so a shared ridge is one line. */
export function alignRingToAnchors(
  ring: LatLng[],
  anchors: LatLng[],
  maxFt = ROOF_VERTEX_SNAP_FT,
): LatLng[] {
  return ring.map((pt) => snapRoofLatLng(pt, anchors, maxFt));
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
    const wallKind = level ? "headwall" : "sidewall";
    let kind = "unclassified";
    if (drains.length && drains.every((item) => item != null)) {
      if (wall && drains.length === 1 && !(drains[0] === "toward" && level)) {
        kind = wallKind;
      } else if (drains.length === 1) {
        if (drains[0] === "away" && level) kind = "headwall";
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
          kind = wallKind;
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
  const steps = Math.round((total("headwall") + total("sidewall") + total("step") + total("wall")) * 10) / 10;
  const named = edges.some((edge) => edge.kind !== "unclassified");
  return {
    classified: named,
    eaves_ft: eaves,
    rakes_ft: rakes,
    ridges_ft: ridges,
    hips_ft: hips,
    valleys_ft: valleys,
    steps_ft: steps,
    ridges_hips_ft: Math.round((ridges + hips) * 10) / 10,
    drip_ft: Math.round((eaves + rakes) * 10) / 10,
    shared_edges: [...groups.values()].filter((slot) => slot.sides.length >= 2).length,
    edges,
  };
}

export function summarizeFacets(facets: RoofFacet[], wastePct?: number): RoofSummary {
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
  return attachSquareWaste(
    {
      facet_count: count,
      total_flat_area_sqft: Math.round(flat * 10) / 10,
      total_area_with_pitch_multiplier_sqft: slopedRounded,
      total_squares: Math.round((slopedRounded / 100) * 100) / 100,
      waste_factor_pct: 0,
      final_area_sqft_with_waste: slopedRounded,
      squares_with_waste: Math.round((slopedRounded / 100) * 100) / 100,
      perimeter_ft: edges.classified && edges.drip_ft != null ? edges.drip_ft : Math.round(perimeter * 10) / 10,
      incomplete: count === 0 ? "Draw at least one roof plane." : missingPitch ? "Every facet needs a pitch." : null,
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
    },
    wastePct,
    predominantPitch(facets),
  );
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
  kind?: "ridge" | "hip" | "valley" | "rake" | "eave" | "headwall" | "sidewall";
};

export function summarizePhotoFacets(
  facets: PhotoFacet[],
  ftPerPx: number | null,
  wastePct?: number,
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
      waste_factor_pct: wastePct ?? 0,
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
  const classified = classifyEdges(photoFacetsToRoof(facets, ftPerPx));
  const linePitch = pitch || facets.find((facet) => normalizePitch(facet.pitch))?.pitch || "5/12";
  const lined = applyDrawnLines(
    {
      facet_count: count,
      total_flat_area_sqft: Math.round(flat * 10) / 10,
      total_area_with_pitch_multiplier_sqft: slopedRounded,
      total_squares: Math.round((slopedRounded / 100) * 100) / 100,
      waste_factor_pct: 0,
      final_area_sqft_with_waste: slopedRounded,
      squares_with_waste: Math.round((slopedRounded / 100) * 100) / 100,
      perimeter_ft: Math.round(peri * 10) / 10,
      incomplete:
        count === 0 ? "Draw at least one roof plane on the plan photo." : missingPitch ? "Every facet needs a pitch." : null,
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
  return attachSquareWaste(lined, wastePct, linePitch);
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
  if (!kind || risePer <= 0 || kind === "eave" || kind === "ridge" || kind === "headwall") return plan;
  if (kind === "rake" || kind === "sidewall") return Math.hypot(plan, plan * risePer);
  return Math.hypot(plan, (plan * risePer) / Math.SQRT2);
}

export function applyDrawnLines(
  summary: RoofSummary,
  lines: PhotoMeasure[],
  ftPerPx: number | null,
  pitch = "5/12",
): RoofSummary {
  if (ftPerPx == null || ftPerPx <= 0 || !lines.length) return summary;
  const add = { eave: 0, rake: 0, ridge: 0, hip: 0, valley: 0, headwall: 0, sidewall: 0 };
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
  const steps = round((summary.steps_ft ?? 0) + add.headwall + add.sidewall);
  return {
    ...summary,
    eaves_ft: eaves,
    rakes_ft: rakes,
    ridges_ft: ridges,
    hips_ft: hips,
    valleys_ft: valleys,
    steps_ft: steps,
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
