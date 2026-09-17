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

const EMPTY_EDGES = {
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

export function quoteFromPlanSqft(planSqft: number, pitch = "5/12"): AutoRoofQuote | null {
  if (!Number.isFinite(planSqft) || planSqft < 200) return null;
  const roofSqft = slopedAreaSqft(planSqft, pitch);
  return {
    squares: salesSquares(roofSqft / 100),
    roofSqft: Math.round(roofSqft),
    planSqft: Math.round(planSqft),
    pitch,
    steepSquares: 0,
    source: "osm-footprint",
  };
}

export function autoRoofSummary(quote: AutoRoofQuote): RoofSummary {
  const ev = eagleViewWaste({
    pitch: quote.pitch,
    rakeCount: 2,
    valleyCount: 0,
  });
  const withWaste = quote.roofSqft * (1 + ev.totalPct / 100);
  return {
    facet_count: 0,
    total_flat_area_sqft: quote.planSqft,
    total_area_with_pitch_multiplier_sqft: quote.roofSqft,
    total_squares: Math.round((quote.roofSqft / 100) * 100) / 100,
    waste_factor_pct: ev.totalPct,
    final_area_sqft_with_waste: Math.round(withWaste * 10) / 10,
    squares_with_waste: salesSquares(withWaste / 100),
    perimeter_ft: 0,
    incomplete: null,
    ...EMPTY_EDGES,
    steep_squares: quote.steepSquares,
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
    const quote = plan ? quoteFromPlanSqft(plan) : null;
    if (quote && quote.squares > 0) return { quote, error: null };
  } catch {
    /* no footprint */
  }
  return {
    quote: null,
    error: "No auto quote on this house. Draw a plane, or tap the right roof.",
  };
}
