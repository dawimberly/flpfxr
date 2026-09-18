import { geocodeAddress, suggestAddresses, type GeocodeHit } from "./geocode.ts";
import { looksLikeStreetAddress, type AddressSuggestion } from "./roof-address.ts";

export {
  looksLikeStreetAddress,
  houseNumberFrom,
  pickEsriRooftop,
  pickEsriSuggestions,
  suggestionLabel,
  streetFileSlug,
} from "./roof-address.ts";
export type { AddressSuggestion, GeocodeHit };

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

/** Prefer a rooftop hit over a street-center guess (Google Geocoder results). */
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

export async function geocodeHouseAddress(
  query: string,
): Promise<{ hit: GeocodeHit | null; error: string | null }> {
  const q = query.trim();
  if (!looksLikeStreetAddress(q)) {
    return {
      hit: null,
      error: "Enter a house number and street, like 3407 Stonehaven Dr, San Antonio, TX 78230.",
    };
  }
  try {
    return await geocodeAddress({ data: { query: q } });
  } catch {
    return {
      hit: null,
      error: "Address lookup failed. Check the street and city, then Measure this roof again.",
    };
  }
}

export async function suggestHouseAddresses(query: string): Promise<AddressSuggestion[]> {
  const q = query.trim();
  if (q.length < 5) return [];
  try {
    const result = await suggestAddresses({ data: { query: q } });
    return result.suggestions ?? [];
  } catch {
    return [];
  }
}
