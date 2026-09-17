/** Roof tracer imagery: Google photorealistic 3D first, then nadir tiles. */

export const WAYBACK_CONFIG_URL =
  "https://s3-us-west-2.amazonaws.com/config.maptiles.arcgis.com/waybackconfig.json";

export type BasemapId = "google" | "esri" | "wayback" | "usgs" | "opentopo" | "maptiler";

export type BasemapDef = {
  id: BasemapId;
  label: string;
  hint: string;
  attribution: string;
  maxZoom: number;
  maxNativeZoom: number;
  subdomains?: string;
};

export type RoofMapBasemap = {
  url: string;
  attribution: string;
  maxZoom: number;
  maxNativeZoom: number;
  subdomains?: string;
};

export type WaybackRelease = {
  release: string;
  date: string;
  title: string;
};

const TITLE_DATE = /Wayback (\d{4}-\d{2}-\d{2})/;

export const BASEMAPS: BasemapDef[] = [
  {
    id: "google",
    label: "Google 3D",
    hint: "Google 3D. Type an address, orbit, draw.",
    attribution: "Google",
    maxZoom: 22,
    maxNativeZoom: 22,
  },
  {
    id: "esri",
    label: "Esri aerial",
    hint: "Current nadir satellite",
    attribution: "Tiles \u00a9 Esri",
    maxZoom: 20,
    maxNativeZoom: 19,
  },
  {
    id: "wayback",
    label: "Esri Wayback",
    hint: "Dated nadir. Often softer than Google.",
    attribution: "Esri World Imagery Wayback",
    maxZoom: 20,
    maxNativeZoom: 19,
  },
  {
    id: "usgs",
    label: "USGS imagery",
    hint: "National Map nadir",
    attribution: "USGS The National Map",
    maxZoom: 20,
    maxNativeZoom: 16,
  },
  {
    id: "opentopo",
    label: "OpenTopoMap",
    hint: "Topo map. Not sharp enough to trace a roof.",
    attribution: "Map data \u00a9 OpenStreetMap, SRTM | Map style \u00a9 OpenTopoMap (CC-BY-SA)",
    maxZoom: 19,
    maxNativeZoom: 17,
    subdomains: "abc",
  },
  {
    id: "maptiler",
    label: "MapTiler satellite",
    hint: "Needs VITE_MAPTILER_KEY",
    attribution: "\u00a9 MapTiler \u00a9 OpenStreetMap contributors",
    maxZoom: 22,
    maxNativeZoom: 22,
  },
];

export function esriAerialUrl() {
  return "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
}

export function usgsImageryUrl() {
  return "https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}";
}

export function openTopoMapUrl() {
  return "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png";
}

export function maptilerSatelliteUrl(key: string) {
  return `https://api.maptiler.com/maps/satellite/{z}/{x}/{y}.jpg?key=${encodeURIComponent(key)}`;
}

export function waybackTileUrl(release: string) {
  return `https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/WMTS/1.0.0/default028mm/MapServer/tile/${release}/{z}/{y}/{x}`;
}

export function parseWaybackConfig(
  raw: Record<string, { itemTitle?: string }>,
): WaybackRelease[] {
  const rows: WaybackRelease[] = [];
  for (const [release, item] of Object.entries(raw)) {
    const title = item.itemTitle ?? "";
    const date = TITLE_DATE.exec(title)?.[1] ?? "";
    if (!date) continue;
    rows.push({ release, date, title });
  }
  rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return rows;
}

export function waybackMonth(date: string) {
  const month = Number(date.slice(5, 7));
  return Number.isFinite(month) ? month : 0;
}

/** Dec-Feb first (defoliated), then Nov/Mar. Summer ranks 0. */
export function winterWaybackRank(date: string) {
  const month = waybackMonth(date);
  if (month === 12 || month === 1 || month === 2) return 2;
  if (month === 11 || month === 3) return 1;
  return 0;
}

export function pickWinterWayback(rows: WaybackRelease[]): WaybackRelease | null {
  if (!rows.length) return null;
  return [...rows].sort((a, b) => {
    const rank = winterWaybackRank(b.date) - winterWaybackRank(a.date);
    if (rank) return rank;
    return a.date < b.date ? 1 : a.date > b.date ? -1 : 0;
  })[0];
}

export function waybackDateLabel(date: string) {
  const rank = winterWaybackRank(date);
  if (rank === 2) return `${date} - leaf-off`;
  if (rank === 1) return `${date} - late leaf`;
  return date;
}

export function availableBasemaps(maptilerKey?: string): BasemapDef[] {
  return BASEMAPS.filter((row) => row.id !== "maptiler" || Boolean(maptilerKey));
}

const GOOGLE_MAPS_CALLBACK = "__ffGoogleMapsReady";

export function googleMapsApiKey() {
  try {
    const env = (import.meta as { env?: { VITE_GOOGLE_MAPS_API_KEY?: string } }).env;
    return env?.VITE_GOOGLE_MAPS_API_KEY?.trim() || "";
  } catch {
    return "";
  }
}

export function googleMapsScriptUrl(key = googleMapsApiKey()) {
  const query = new URLSearchParams({
    v: "weekly",
    callback: GOOGLE_MAPS_CALLBACK,
    libraries: "maps3d",
    loading: "async",
  });
  if (key) query.set("key", key);
  return `https://maps.googleapis.com/maps/api/js?${query}`;
}

type GmapsWindow = Window & {
  google?: { maps?: { Map?: unknown } };
  [GOOGLE_MAPS_CALLBACK]?: () => void;
};

let googleMapsLoad: Promise<void> | null = null;

export function loadGoogleMaps(key = googleMapsApiKey()): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Maps is browser-only."));
  }
  const host = window as GmapsWindow;
  if (host.google?.maps?.Map) return Promise.resolve();
  if (googleMapsLoad) return googleMapsLoad;
  googleMapsLoad = new Promise((resolve, reject) => {
    const finish = () => {
      const start = Date.now();
      const wait = () => {
        if (host.google?.maps?.Map) {
          resolve();
          return;
        }
        if (Date.now() - start > 8000) {
          googleMapsLoad = null;
          reject(new Error("Google Maps loaded without a Map constructor."));
          return;
        }
        window.setTimeout(wait, 50);
      };
      wait();
    };
    host[GOOGLE_MAPS_CALLBACK] = finish;
    const existing = document.querySelector("script[data-ff-gmaps]");
    if (existing) return;
    const script = document.createElement("script");
    script.dataset.ffGmaps = "1";
    script.async = true;
    script.defer = true;
    script.src = googleMapsScriptUrl(key);
    script.onerror = () => {
      googleMapsLoad = null;
      reject(new Error("Google Maps script failed to load."));
    };
    document.head.appendChild(script);
  });
  return googleMapsLoad;
}

type Maps3dLib = {
  Map3DElement: new (opts: Record<string, unknown>) => HTMLElement & Record<string, unknown>;
  Polygon3DElement?: new (opts: Record<string, unknown>) => HTMLElement & { path?: unknown };
  Polygon3DInteractiveElement?: new (opts: Record<string, unknown>) => HTMLElement & {
    path?: unknown;
    addEventListener: (name: string, fn: (e?: unknown) => void) => void;
  };
  Polyline3DElement?: new (opts: Record<string, unknown>) => HTMLElement & { path?: unknown };
  Marker3DElement?: new (opts: Record<string, unknown>) => HTMLElement & { position?: unknown };
  AltitudeMode?: { CLAMP_TO_GROUND?: string };
};

export async function loadMaps3d(): Promise<Maps3dLib> {
  await loadGoogleMaps();
  const maps = (window as unknown as { google?: { maps?: { importLibrary?: (name: string) => Promise<Maps3dLib> } } })
    .google?.maps;
  if (!maps?.importLibrary) {
    throw new Error("This Maps build has no 3D library.");
  }
  let timer = 0;
  const pending = maps.importLibrary("maps3d");
  const timeout = new Promise<never>((_, reject) => {
    timer = window.setTimeout(() => reject(new Error("3D Maps timed out.")), 12000);
  });
  try {
    return await Promise.race([pending, timeout]);
  } finally {
    window.clearTimeout(timer);
  }
}

export function roofMapBasemap(
  id: BasemapId,
  opts: { waybackRelease?: string; maptilerKey?: string } = {},
): RoofMapBasemap {
  const def = BASEMAPS.find((row) => row.id === id) ?? BASEMAPS[0];
  let url = esriAerialUrl();
  if (id === "google") url = "";
  else if (id === "wayback") url = waybackTileUrl(opts.waybackRelease || "64001");
  else if (id === "usgs") url = usgsImageryUrl();
  else if (id === "opentopo") url = openTopoMapUrl();
  else if (id === "maptiler" && opts.maptilerKey) url = maptilerSatelliteUrl(opts.maptilerKey);
  return {
    url,
    attribution: def.attribution,
    maxZoom: def.maxZoom,
    maxNativeZoom: def.maxNativeZoom,
    subdomains: def.subdomains,
  };
}

export function googleEarthNadirUrl(lat: number, lng: number, address = "") {
  const look = `@${lat},${lng},250a,350d,35y,0h,0t,0r`;
  const q = address.trim();
  if (q) {
    return `https://earth.google.com/web/search/${encodeURIComponent(q)}/${look}`;
  }
  return `https://earth.google.com/web/${look}`;
}

export function googleMapsSatelliteUrl(lat: number, lng: number) {
  return `https://www.google.com/maps/@${lat},${lng},20z/data=!3m1!1e3`;
}

export function esriWaybackAppUrl(lat: number, lng: number, zoom = 19) {
  return `https://livingatlas.arcgis.com/wayback/#mapCenter=${lng}%2C${lat}%2C${zoom}`;
}

export function openTopographyUrl(lat: number, lng: number, pad = 0.004) {
  const minX = lng - pad;
  const maxX = lng + pad;
  const minY = lat - pad;
  const maxY = lat + pad;
  return `https://portal.opentopography.org/datasets?minX=${minX}&minY=${minY}&maxX=${maxX}&maxY=${maxY}`;
}
