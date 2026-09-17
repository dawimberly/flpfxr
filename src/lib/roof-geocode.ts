import { googleMapsApiKey, loadGoogleMaps } from "./roof-basemap.ts";
import { geocodeAddress, type GeocodeHit } from "./geocode.ts";

type GLatLng = { lat: () => number; lng: () => number };
type GGeocoder = {
  geocode: (req: Record<string, unknown>) => Promise<{
    results?: Array<{
      formatted_address?: string;
      geometry?: { location?: GLatLng; location_type?: string };
    }>;
  }>;
};

const LOCATION_RANK: Record<string, number> = {
  ROOFTOP: 0,
  RANGE_INTERPOLATED: 1,
  GEOMETRIC_CENTER: 2,
  APPROXIMATE: 3,
};

function readLatLng(loc: unknown): { lat: number; lng: number } | null {
  if (!loc || typeof loc !== "object") return null;
  const rec = loc as { lat?: unknown; lng?: unknown };
  const lat = typeof rec.lat === "function" ? rec.lat() : rec.lat;
  const lng = typeof rec.lng === "function" ? rec.lng() : rec.lng;
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

/** Prefer a rooftop hit over a street-center guess. */
export function pickHouseGeocode(
  results: Array<{
    formatted_address?: string;
    geometry?: { location?: unknown; location_type?: string };
  }>,
): GeocodeHit | null {
  const ranked = results
    .map((row) => {
      const loc = readLatLng(row.geometry?.location);
      if (!loc) return null;
      return {
        hit: { lat: loc.lat, lng: loc.lng, label: row.formatted_address || "" },
        rank: LOCATION_RANK[row.geometry?.location_type || ""] ?? 4,
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
    .sort((a, b) => a.rank - b.rank);
  const best = ranked[0]?.hit;
  return best ?? null;
}

async function geocodeWithGoogle(query: string): Promise<GeocodeHit | null> {
  await loadGoogleMaps();
  const Geocoder = (window as unknown as { google?: { maps?: { Geocoder?: new () => GGeocoder } } })
    .google?.maps?.Geocoder;
  if (!Geocoder) return null;
  const response = await new Geocoder().geocode({
    address: query,
    componentRestrictions: { country: "US" },
  });
  const hit = pickHouseGeocode(response.results ?? []);
  if (!hit) return null;
  return { ...hit, label: hit.label || query };
}

export async function geocodeHouseAddress(
  query: string,
): Promise<{ hit: GeocodeHit | null; error: string | null }> {
  const q = query.trim();
  if (q.length < 5) return { hit: null, error: "Enter a fuller street address." };
  try {
    if (googleMapsApiKey()) {
      const hit = await geocodeWithGoogle(q);
      if (hit) return { hit, error: null };
    }
  } catch {
    /* Google key missing or Geocoder blocked; try OSM next. */
  }
  try {
    return await geocodeAddress({ data: { query: q } });
  } catch {
    return {
      hit: null,
      error: "Address lookup failed. Check the street and city, then Search again.",
    };
  }
}
