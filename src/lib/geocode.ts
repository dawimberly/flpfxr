import { createServerFn } from "@tanstack/react-start";
import {
  houseNumberFrom,
  looksLikeStreetAddress,
  pickCensusHouse,
  pickEsriRooftop,
  pickNominatimHouse,
  type CensusMatch,
  type EsriCandidate,
  type GeocodeHit,
  type NominatimRow,
} from "./roof-address.ts";
import { msbFp2QueryUrl, outlineFromMsbFp2, type GeoJsonFeatureCollection } from "./roof-outline.ts";

export type { GeocodeHit } from "./roof-address.ts";

const UA = "TheFlipFixerRoofTracer/1.0 (jon@theflipfixer.com)";

async function geocodeEsri(query: string): Promise<GeocodeHit | null> {
  const url = new URL("https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates");
  url.searchParams.set("f", "json");
  url.searchParams.set("SingleLine", query);
  url.searchParams.set("outFields", "Addr_type,Match_addr,StAddr,AddNum,ShortLabel");
  url.searchParams.set("maxLocations", "6");
  url.searchParams.set("locationType", "rooftop");
  url.searchParams.set("countryCode", "USA");
  const res = await fetch(url, { headers: { Accept: "application/json", "User-Agent": UA } });
  if (!res.ok) return null;
  const json = (await res.json()) as { candidates?: EsriCandidate[] };
  return pickEsriRooftop(json.candidates ?? [], query);
}

async function geocodeCensus(query: string): Promise<GeocodeHit | null> {
  const url = new URL("https://geocoding.geo.census.gov/geocoder/locations/onelineaddress");
  url.searchParams.set("address", query);
  url.searchParams.set("benchmark", "Public_AR_Current");
  url.searchParams.set("vintage", "Current_Current");
  url.searchParams.set("format", "json");
  const res = await fetch(url, { headers: { Accept: "application/json", "User-Agent": UA } });
  if (!res.ok) return null;
  const json = (await res.json()) as { result?: { addressMatches?: CensusMatch[] } };
  return pickCensusHouse(json.result?.addressMatches ?? [], query);
}

async function geocodeNominatim(query: string): Promise<GeocodeHit | null> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "5");
  url.searchParams.set("countrycodes", "us");
  url.searchParams.set("addressdetails", "1");
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": UA },
  });
  if (!res.ok) return null;
  const rows = (await res.json()) as NominatimRow[];
  return pickNominatimHouse(rows, query);
}

/**
 * Esri rooftop PointAddress first (must include the house number), then Census, then Nominatim.
 * Street-name centroids are rejected. OSM has no Stonehaven — Nominatim-only is not enough.
 */
export const geocodeAddress = createServerFn({ method: "POST" })
  .validator((data: { query: string }) => data)
  .handler(async ({ data }): Promise<{ hit: GeocodeHit | null; error: string | null }> => {
    const query = data.query.trim();
    if (!looksLikeStreetAddress(query) || !houseNumberFrom(query)) {
      return {
        hit: null,
        error: "Enter a house number and street, like 3407 Stonehaven Dr, San Antonio, TX 78230.",
      };
    }
    try {
      const esri = await geocodeEsri(query);
      if (esri) return { hit: esri, error: null };
    } catch {
      /* try Census */
    }
    try {
      const census = await geocodeCensus(query);
      if (census) return { hit: census, error: null };
    } catch {
      /* try Nominatim */
    }
    try {
      const osm = await geocodeNominatim(query);
      if (osm) return { hit: osm, error: null };
    } catch {
      /* none */
    }
    return { hit: null, error: "No rooftop match. Check the street number and city." };
  });

export const fetchBuildingOutline = createServerFn({ method: "POST" })
  .validator((data: { lat: number; lng: number }) => data)
  .handler(
    async ({
      data,
    }): Promise<{ ring: [number, number][] | null; planSqft: number | null; error: string | null }> => {
      const { lat, lng } = data;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return { ring: null, planSqft: null, error: "No pin to measure." };
      }
      try {
        const res = await fetch(msbFp2QueryUrl(lat, lng), {
          headers: { Accept: "application/json", "User-Agent": UA },
        });
        if (!res.ok) {
          return { ring: null, planSqft: null, error: "Building outline lookup failed. Try again." };
        }
        const geojson = (await res.json()) as GeoJsonFeatureCollection;
        const outline = outlineFromMsbFp2(geojson, lat, lng);
        if (!outline) {
          return {
            ring: null,
            planSqft: null,
            error: "No building outline at this rooftop. Click the house, not the street.",
          };
        }
        return { ring: outline.ring, planSqft: outline.planSqft, error: null };
      } catch {
        return { ring: null, planSqft: null, error: "Building outline lookup failed. Try again." };
      }
    },
  );
