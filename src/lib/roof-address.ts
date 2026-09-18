export type GeocodeHit = {
  lat: number;
  lng: number;
  label: string;
};

/** House number plus a street name - not a city, ZIP, or street-only centroid. */
export function looksLikeStreetAddress(query: string): boolean {
  const t = query.trim();
  if (t.length < 8) return false;
  return /^\d+[A-Za-z]?\s+\S*[A-Za-z]/.test(t);
}

export function houseNumberFrom(query: string): string | null {
  const m = query.trim().match(/^(\d+[A-Za-z]?)/);
  return m?.[1] ?? null;
}

function matchHasHouseNumber(text: string, num: string): boolean {
  return new RegExp(`(^|\\s|,)${num}\\b`, "i").test(text);
}

const ROOFTOP_TYPES = new Set(["PointAddress", "SubAddress"]);
const CENTROID_TYPES = new Set([
  "StreetName",
  "StreetInt",
  "Locality",
  "Postal",
  "PostalExt",
  "POI",
  "DistanceMarker",
  "Neighborhood",
  "Admin",
]);

export type EsriCandidate = {
  address?: string;
  location?: { x?: number; y?: number };
  attributes?: {
    Addr_type?: string;
    Match_addr?: string;
    AddNum?: string;
    StAddr?: string;
    ShortLabel?: string;
  };
};

/** Esri rooftop PointAddress / SubAddress only. Street-name centroids are rejected. */
export function pickEsriRooftop(candidates: EsriCandidate[], query: string): GeocodeHit | null {
  const num = houseNumberFrom(query);
  if (!num) return null;
  for (const row of candidates) {
    const type = row.attributes?.Addr_type || "";
    if (CENTROID_TYPES.has(type)) continue;
    if (!ROOFTOP_TYPES.has(type)) continue;
    const hay = [
      row.address,
      row.attributes?.Match_addr,
      row.attributes?.ShortLabel,
      row.attributes?.StAddr,
      row.attributes?.AddNum,
    ]
      .filter(Boolean)
      .join(" ");
    if (!matchHasHouseNumber(hay, num)) continue;
    const lat = row.location?.y;
    const lng = row.location?.x;
    if (typeof lat !== "number" || typeof lng !== "number") continue;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    return { lat, lng, label: row.address || row.attributes?.Match_addr || query };
  }
  return null;
}

export type CensusMatch = {
  matchedAddress?: string;
  coordinates?: { x?: number; y?: number };
};

export function pickCensusHouse(matches: CensusMatch[], query: string): GeocodeHit | null {
  const num = houseNumberFrom(query);
  if (!num) return null;
  for (const row of matches) {
    const label = row.matchedAddress || "";
    if (!matchHasHouseNumber(label, num)) continue;
    const lat = row.coordinates?.y;
    const lng = row.coordinates?.x;
    if (typeof lat !== "number" || typeof lng !== "number") continue;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    return { lat, lng, label: label || query };
  }
  return null;
}

export type NominatimRow = {
  lat?: string;
  lon?: string;
  display_name?: string;
  class?: string;
  type?: string;
  addresstype?: string;
  address?: { house_number?: string; road?: string };
};

export function pickNominatimHouse(rows: NominatimRow[], query: string): GeocodeHit | null {
  const num = houseNumberFrom(query);
  if (!num) return null;
  for (const row of rows) {
    const house = row.address?.house_number || "";
    const label = row.display_name || "";
    const roadOnly =
      row.addresstype === "road" ||
      row.type === "residential" && row.class === "highway" ||
      (row.class === "highway" && !house);
    if (roadOnly && !matchHasHouseNumber(label, num)) continue;
    if (!matchHasHouseNumber(`${house} ${label}`, num)) continue;
    const lat = Number(row.lat);
    const lng = Number(row.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    return { lat, lng, label: label || query };
  }
  return null;
}

export type EsriSuggestRow = {
  text?: string;
  magicKey?: string;
  isCollection?: boolean;
};

export type AddressSuggestion = {
  text: string;
  magicKey: string;
};

function localHintRank(text: string): number {
  const t = text.toLowerCase();
  if (t.includes("san antonio")) return 0;
  if (
    /kerrville|boerne|helotes|fair oaks|shavano|alamo heights|terrell hills|olmos park|stone oak|hollywood park/.test(
      t,
    )
  ) {
    return 1;
  }
  if (/, tx\b|, texas\b/.test(t)) return 2;
  return 3;
}

/** House-number suggestions only. Street-name collections stay out. */
export function pickEsriSuggestions(rows: EsriSuggestRow[]): AddressSuggestion[] {
  const seen = new Set<string>();
  const out: AddressSuggestion[] = [];
  const ranked = [...rows].sort(
    (a, b) => localHintRank(a.text || "") - localHintRank(b.text || ""),
  );
  for (const row of ranked) {
    if (row.isCollection) continue;
    const text = (row.text || "").trim();
    if (!text || !row.magicKey) continue;
    if (!looksLikeStreetAddress(text) || !houseNumberFrom(text)) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ text, magicKey: row.magicKey });
    if (out.length >= 6) break;
  }
  return out;
}

export function suggestionLabel(text: string): string {
  return text.replace(/,\s*USA$/i, "");
}

export function streetFileSlug(address: string): string {
  const m = address.trim().match(/(\d+)\s+([A-Za-z0-9]+)/);
  if (m) return `${m[1]}-${m[2].toLowerCase()}`;
  return address
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "job";
}
