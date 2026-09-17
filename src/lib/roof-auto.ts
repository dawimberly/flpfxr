import {
  eagleViewWaste,
  geodesicRingAreaSqft,
  salesSquares,
  slopedAreaSqft,
  type RoofSummary,
} from "./roof-math.ts";

export type AutoRoofQuote = {
  squares: number;
  roofSqft: number;
  planSqft: number;
  pitch: string | null;
  steepSquares: number;
  source: "osm-footprint";
};

export function pitchLabelFromDegrees(deg: number) {
  if (!Number.isFinite(deg) || deg < 0) return "0/12";
  const rise = Math.round(Math.tan((deg * Math.PI) / 180) * 12);
  return `${Math.min(12, Math.max(0, rise))}/12`;
}

export type RoofFastClass = {
  pitch?: string | null;
  rakeCount?: number | null;
  valleyCount?: number | null;
};

function steepFromPitch(pitch: string | null | undefined, squares: number) {
  const rise = Number(String(pitch || "0/12").split("/")[0]) / 12;
  return rise >= 7 / 12 ? squares : 0;
}

export function quoteFromPlanSqft(planSqft: number, pitch = "5/12"): AutoRoofQuote | null {
  if (!Number.isFinite(planSqft) || planSqft < 200) return null;
  const roofSqft = slopedAreaSqft(planSqft, pitch);
  const squares = salesSquares(roofSqft / 100);
  return {
    squares,
    roofSqft: Math.round(roofSqft),
    planSqft: Math.round(planSqft),
    pitch,
    steepSquares: steepFromPitch(pitch, squares),
    source: "osm-footprint",
  };
}

export function applyFastClass(quote: AutoRoofQuote, klass: RoofFastClass = {}): AutoRoofQuote {
  const pitch = klass.pitch || quote.pitch || "5/12";
  return quoteFromPlanSqft(quote.planSqft, pitch) ?? quote;
}

/** Typical 3D lengths from 51 MRC EagleViews. Used when we do not measure the roof. */
export const UNMEASURED_EV = {
  valleyFtEach: 12.5,
  rakeFtEach: 10.8,
  eaveFtPerSquare: 6.7,
  ridgeHipFtPerSquare: 6.8,
} as const;

export function unmeasuredRoofEdges(opts: {
  squares: number;
  rakeCount?: number | null;
  valleyCount?: number | null;
}) {
  const squares = Math.max(0, opts.squares);
  const rakes = Math.max(0, Math.round(opts.rakeCount ?? 2));
  const valleys = Math.max(0, Math.round(opts.valleyCount ?? 0));
  const eaves_ft = Math.round(squares * UNMEASURED_EV.eaveFtPerSquare * 10) / 10;
  const rakes_ft = Math.round(rakes * UNMEASURED_EV.rakeFtEach * 10) / 10;
  const valleys_ft = Math.round(valleys * UNMEASURED_EV.valleyFtEach * 10) / 10;
  const ridges_hips_ft = Math.round(squares * UNMEASURED_EV.ridgeHipFtPerSquare * 10) / 10;
  return {
    eaves_ft,
    rakes_ft,
    ridges_ft: ridges_hips_ft,
    hips_ft: 0,
    valleys_ft,
    steps_ft: null as number | null,
    ridges_hips_ft,
    drip_ft: Math.round((eaves_ft + rakes_ft) * 10) / 10,
    shared_edges: 0,
    edges: [] as RoofSummary["edges"],
    classified: true,
  };
}

export function autoRoofSummary(quote: AutoRoofQuote, klass: RoofFastClass = {}): RoofSummary {
  const next = applyFastClass(quote, klass);
  const rakeCount = klass.rakeCount ?? 2;
  const valleyCount = klass.valleyCount ?? 0;
  const ev = eagleViewWaste({
    pitch: next.pitch,
    rakeCount,
    valleyCount,
  });
  const withWaste = next.roofSqft * (1 + ev.totalPct / 100);
  const totalSquares = Math.round((next.roofSqft / 100) * 100) / 100;
  const edges = unmeasuredRoofEdges({
    squares: totalSquares,
    rakeCount,
    valleyCount,
  });
  return {
    facet_count: 0,
    total_flat_area_sqft: next.planSqft,
    total_area_with_pitch_multiplier_sqft: next.roofSqft,
    total_squares: totalSquares,
    waste_factor_pct: ev.totalPct,
    final_area_sqft_with_waste: Math.round(withWaste * 10) / 10,
    squares_with_waste: salesSquares(withWaste / 100),
    perimeter_ft: edges.drip_ft,
    incomplete: null,
    eaves_ft: edges.eaves_ft,
    rakes_ft: edges.rakes_ft,
    ridges_ft: edges.ridges_ft,
    hips_ft: edges.hips_ft,
    valleys_ft: edges.valleys_ft,
    steps_ft: edges.steps_ft,
    ridges_hips_ft: edges.ridges_hips_ft,
    drip_ft: edges.drip_ft,
    shared_edges: 0,
    edges: [],
    steep_squares: next.steepSquares,
  };
}

async function fetchOsmPlanSqft(
  lat: number,
  lng: number,
): Promise<{ planSqft: number | null; status: "ok" | "overpass" | "empty" }> {
  const body = `[out:json][timeout:12];way["building"](around:40,${lat},${lng});out geom;`;
  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: {
      "Content-Type": "text/plain",
      "User-Agent": "FlipFixerRoof/1.0 (https://theflipfixer.com; jon@theflipfixer.com)",
    },
    body,
  });
  if (!res.ok) return { planSqft: null, status: "overpass" };
  const text = await res.text();
  if (!text.trim().startsWith("{")) return { planSqft: null, status: "overpass" };
  const json = JSON.parse(text) as {
    elements?: Array<{ geometry?: Array<{ lat: number; lon: number }> }>;
  };
  const planSqft = pickLargestBuildingPlanSqft(json.elements ?? []);
  return { planSqft, status: planSqft ? "ok" : "empty" };
}

export function pickLargestBuildingPlanSqft(
  elements: Array<{ geometry?: Array<{ lat: number; lon: number }> }>,
): number | null {
  let best = 0;
  for (const row of elements) {
    if ((row.geometry?.length ?? 0) < 4 || !row.geometry) continue;
    const ring = row.geometry.map((pt) => [pt.lat, pt.lon] as [number, number]);
    const plan = geodesicRingAreaSqft(ring);
    if (plan > best) best = plan;
  }
  return best > 0 ? Math.round(best) : null;
}

export async function fetchAutoRoofQuote(
  lat: number,
  lng: number,
  pitch = "5/12",
): Promise<{ quote: AutoRoofQuote | null; error: string | null }> {
  try {
    const osm = await fetchOsmPlanSqft(lat, lng);
    if (osm.status === "overpass") {
      return {
        quote: null,
        error: "Map footprint is busy. Search again in a minute, or draw a plane.",
      };
    }
    const quote = osm.planSqft ? quoteFromPlanSqft(osm.planSqft, pitch) : null;
    if (quote && quote.squares > 0) return { quote, error: null };
  } catch {
    /* no footprint */
  }
  return {
    quote: null,
    error: "No auto quote on this house. Draw a plane, or tap the right roof.",
  };
}
