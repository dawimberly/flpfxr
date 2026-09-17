import { googleMapsApiKey } from "./roof-basemap.ts";
import {
  eagleViewWaste,
  geodesicRingAreaSqft,
  salesSquares,
  slopedAreaSqft,
  SQFT_PER_SQM,
  type RoofSummary,
} from "./roof-math.ts";

export type AutoRoofQuote = {
  squares: number;
  roofSqft: number;
  planSqft: number;
  pitch: string | null;
  steepSquares: number;
  source: "google-solar" | "osm-footprint";
};

type SizeStats = {
  areaMeters2?: number;
  groundAreaMeters2?: number;
};

type SolarInsights = {
  solarPotential?: {
    wholeRoofStats?: SizeStats;
    buildingStats?: SizeStats;
    roofSegmentStats?: Array<{
      pitchDegrees?: number;
      stats?: SizeStats;
    }>;
  };
};

export function pitchLabelFromDegrees(deg: number) {
  if (!Number.isFinite(deg) || deg < 0) return "0/12";
  const rise = Math.round(Math.tan((deg * Math.PI) / 180) * 12);
  return `${Math.min(12, Math.max(0, rise))}/12`;
}

function sqftFromM2(m2: number) {
  return m2 * SQFT_PER_SQM;
}

/** Google: scale segmented roof area by whole-building ground coverage. */
export function quoteFromSolarInsights(raw: SolarInsights): AutoRoofQuote | null {
  const potential = raw.solarPotential;
  const whole = potential?.wholeRoofStats;
  const building = potential?.buildingStats;
  if (!whole?.areaMeters2 || whole.areaMeters2 < 20) return null;
  let roofM2 = whole.areaMeters2;
  if (
    building?.groundAreaMeters2 &&
    whole.groundAreaMeters2 &&
    whole.groundAreaMeters2 > 0
  ) {
    const ratio = building.groundAreaMeters2 / whole.groundAreaMeters2;
    if (ratio > 1 && ratio <= 1.4) roofM2 *= ratio;
  }
  const planM2 = building?.groundAreaMeters2 || whole.groundAreaMeters2 || roofM2;
  const roofSqft = sqftFromM2(roofM2);
  const segments = potential?.roofSegmentStats ?? [];
  let pitchArea = 0;
  let pitchWeight = 0;
  let steepM2 = 0;
  for (const seg of segments) {
    const area = seg.stats?.areaMeters2 ?? 0;
    const pitch = seg.pitchDegrees ?? 0;
    if (area <= 0) continue;
    pitchArea += pitch * area;
    pitchWeight += area;
    if (pitch >= 30.26) steepM2 += area;
  }
  const pitch = pitchWeight ? pitchLabelFromDegrees(pitchArea / pitchWeight) : null;
  return {
    squares: salesSquares(roofSqft / 100),
    roofSqft: Math.round(roofSqft),
    planSqft: Math.round(sqftFromM2(planM2)),
    pitch,
    steepSquares: salesSquares(sqftFromM2(steepM2) / 100),
    source: "google-solar",
  };
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
  if (quote.source === "osm-footprint") {
    return quoteFromPlanSqft(quote.planSqft, pitch) ?? quote;
  }
  return {
    ...quote,
    pitch,
    steepSquares: steepFromPitch(pitch, quote.squares) || quote.steepSquares,
  };
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

async function fetchSolarInsights(lat: number, lng: number, key: string): Promise<SolarInsights | null> {
  const url = new URL("https://solar.googleapis.com/v1/buildingInsights:findClosest");
  url.searchParams.set("location.latitude", String(lat));
  url.searchParams.set("location.longitude", String(lng));
  url.searchParams.set("requiredQuality", "MEDIUM");
  url.searchParams.set("key", key);
  const res = await fetch(url);
  if (!res.ok) return null;
  const json = (await res.json()) as SolarInsights & { error?: { status?: string } };
  if (json.error) return null;
  return json;
}

async function fetchOsmPlanSqft(lat: number, lng: number): Promise<number | null> {
  const body = `[out:json][timeout:12];way["building"](around:40,${lat},${lng});out geom;`;
  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body,
  });
  if (!res.ok) return null;
  const text = await res.text();
  if (!text.trim().startsWith("{")) return null;
  const json = JSON.parse(text) as {
    elements?: Array<{ geometry?: Array<{ lat: number; lon: number }> }>;
  };
  const way = json.elements?.find((row) => (row.geometry?.length ?? 0) >= 4);
  if (!way?.geometry) return null;
  const ring = way.geometry.map((pt) => [pt.lat, pt.lon] as [number, number]);
  const plan = geodesicRingAreaSqft(ring);
  return plan > 0 ? plan : null;
}

export async function fetchAutoRoofQuote(
  lat: number,
  lng: number,
  pitch = "5/12",
): Promise<{ quote: AutoRoofQuote | null; error: string | null }> {
  const key = googleMapsApiKey();
  if (key) {
    try {
      const solar = await fetchSolarInsights(lat, lng, key);
      const quote = solar ? quoteFromSolarInsights(solar) : null;
      if (quote && quote.squares > 0) return { quote, error: null };
    } catch {
      /* OSM next */
    }
  }
  try {
    const plan = await fetchOsmPlanSqft(lat, lng);
    const quote = plan ? quoteFromPlanSqft(plan, pitch) : null;
    if (quote && quote.squares > 0) return { quote, error: null };
  } catch {
    /* no footprint */
  }
  return {
    quote: null,
    error: "No auto quote on this house. Draw a plane, or tap the right roof.",
  };
}
