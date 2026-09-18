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

export function streetFileSlug(address: string): string {
  const m = address.trim().match(/(\d+)\s+([A-Za-z0-9]+)/);
  if (m) return `${m[1]}-${m[2].toLowerCase()}`;
  return address
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "job";
}
