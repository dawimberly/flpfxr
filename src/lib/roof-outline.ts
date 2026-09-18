import { geodesicRingAreaSqft, geodesicSegmentFt, type LatLng } from "./roof-math.ts";

export type GeoJsonPosition = number[];
export type GeoJsonRing = GeoJsonPosition[];
export type GeoJsonPolygon = GeoJsonRing[];
export type GeoJsonGeometry = {
  type?: string;
  coordinates?: GeoJsonPolygon | GeoJsonPolygon[];
};
export type GeoJsonFeature = {
  geometry?: GeoJsonGeometry | null;
  properties?: Record<string, unknown> | null;
};
export type GeoJsonFeatureCollection = {
  type?: string;
  features?: GeoJsonFeature[];
};

/** Ray-cast. Ring is GeoJSON [lng, lat]. */
export function ringContainsLngLat(ring: GeoJsonRing, lng: number, lat: number): boolean {
  if (ring.length < 4) return false;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i]?.[0];
    const yi = ring[i]?.[1];
    const xj = ring[j]?.[0];
    const yj = ring[j]?.[1];
    if (xi == null || yi == null || xj == null || yj == null) continue;
    const intersect =
      yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi + 0.0) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function geojsonRingToLatLngs(ring: GeoJsonRing): LatLng[] {
  const pts: LatLng[] = [];
  for (const coord of ring) {
    if (!coord || coord.length < 2) continue;
    const lng = Number(coord[0]);
    const lat = Number(coord[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    pts.push([lat, lng]);
  }
  if (
    pts.length >= 2 &&
    pts[0][0] === pts[pts.length - 1][0] &&
    pts[0][1] === pts[pts.length - 1][1]
  ) {
    pts.pop();
  }
  return pts;
}

export type FootprintValleyCandidate = {
  corner: LatLng;
  turnDeg: number;
};

/**
 * A concave footprint corner is a possible valley start.
 *
 * The footprint cannot prove the roof layout, so these are review candidates,
 * not measured valley lines and must never enter the bid without confirmation.
 */
export function footprintValleyCandidates(ring: LatLng[]): FootprintValleyCandidate[] {
  if (ring.length < 4) return [];
  const meanLat = ring.reduce((sum, [lat]) => sum + lat, 0) / ring.length;
  const xScale = Math.cos((meanLat * Math.PI) / 180);
  const points = ring.map(([lat, lng]) => ({ x: lng * xScale, y: lat }));
  let twiceArea = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    twiceArea += a.x * b.y - b.x * a.y;
  }
  if (Math.abs(twiceArea) < 1e-12) return [];
  const orientation = twiceArea > 0 ? 1 : -1;
  const candidates: FootprintValleyCandidate[] = [];

  for (let i = 0; i < ring.length; i += 1) {
    const prevIndex = (i - 1 + ring.length) % ring.length;
    const nextIndex = (i + 1) % ring.length;
    const prev = points[prevIndex];
    const point = points[i];
    const next = points[nextIndex];
    const ax = point.x - prev.x;
    const ay = point.y - prev.y;
    const bx = next.x - point.x;
    const by = next.y - point.y;
    const cross = ax * by - ay * bx;
    const lengths = Math.hypot(ax, ay) * Math.hypot(bx, by);
    if (!lengths || cross * orientation >= 0) continue;
    if (
      geodesicSegmentFt(ring[prevIndex], ring[i]) < 3 ||
      geodesicSegmentFt(ring[i], ring[nextIndex]) < 3
    ) {
      continue;
    }
    const turnDeg = (Math.asin(Math.min(1, Math.abs(cross) / lengths)) * 180) / Math.PI;
    if (turnDeg < 20) continue;
    candidates.push({ corner: ring[i], turnDeg: Math.round(turnDeg) });
  }
  return candidates;
}

function polygonRings(geometry: GeoJsonGeometry | null | undefined): GeoJsonRing[] {
  if (!geometry?.coordinates) return [];
  if (geometry.type === "Polygon") return geometry.coordinates as GeoJsonPolygon;
  if (geometry.type === "MultiPolygon") {
    return (geometry.coordinates as GeoJsonPolygon[]).map((poly) => poly[0]).filter(Boolean);
  }
  return [];
}

export function featureContainsRooftop(feature: GeoJsonFeature, lat: number, lng: number): boolean {
  const rings = polygonRings(feature.geometry);
  const exterior = rings[0];
  if (!exterior) return false;
  return ringContainsLngLat(exterior, lng, lat);
}

/**
 * Use the footprint that CONTAINS the rooftop pin.
 * Do not fall back to the nearest neighbor house.
 */
export function pickContainingBuilding(
  features: GeoJsonFeature[],
  lat: number,
  lng: number,
): { ring: LatLng[]; planSqft: number } | null {
  const hits: { ring: LatLng[]; planSqft: number }[] = [];
  for (const feature of features) {
    if (!featureContainsRooftop(feature, lat, lng)) continue;
    const exterior = polygonRings(feature.geometry)[0];
    if (!exterior) continue;
    const ring = geojsonRingToLatLngs(exterior);
    if (ring.length < 3) continue;
    const planSqft = geodesicRingAreaSqft(ring);
    if (planSqft < 100) continue;
    hits.push({ ring, planSqft: Math.round(planSqft * 10) / 10 });
  }
  if (!hits.length) return null;
  hits.sort((a, b) => a.planSqft - b.planSqft);
  return hits[0];
}

export const MSBFP2_URL =
  "https://services.arcgis.com/P3ePLMYs2RVChkJx/ArcGIS/rest/services/MSBFP2/FeatureServer/0/query";

export function msbFp2QueryUrl(lat: number, lng: number): string {
  const url = new URL(MSBFP2_URL);
  url.searchParams.set("geometry", `${lng},${lat}`);
  url.searchParams.set("geometryType", "esriGeometryPoint");
  url.searchParams.set("inSR", "4326");
  url.searchParams.set("spatialRel", "esriSpatialRelIntersects");
  url.searchParams.set("outFields", "OBJECTID");
  url.searchParams.set("returnGeometry", "true");
  url.searchParams.set("outSR", "4326");
  url.searchParams.set("f", "geojson");
  return url.toString();
}

export function outlineFromMsbFp2(
  geojson: GeoJsonFeatureCollection | null | undefined,
  lat: number,
  lng: number,
): { ring: LatLng[]; planSqft: number } | null {
  return pickContainingBuilding(geojson?.features ?? [], lat, lng);
}
