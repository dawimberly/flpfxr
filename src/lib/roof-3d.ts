export type Roof3dCamera = {
  center: { lat: number; lng: number; altitude?: number };
  range: number;
  tilt: number;
  heading: number;
};

type Roof3dMapCamera = {
  center?: unknown;
  range?: unknown;
  tilt?: unknown;
  heading?: unknown;
  flyCameraTo?: (opts: { endCamera: Roof3dCamera; durationMillis?: number }) => void;
  stopCameraAnimation?: () => void;
  setAttribute?: (name: string, value: string) => void;
  removeAttribute?: (name: string) => void;
};

/** Close house view: orbitable photorealistic camera, not a locked nadir. */
export function roof3dHouseCamera(
  lat: number,
  lng: number,
  opts: { heading?: number; top?: boolean } = {},
): Roof3dCamera {
  const top = Boolean(opts.top);
  return {
    // Lat/lng only. Do not set altitude 0 -- that is sea level, not the roof.
    center: { lat, lng },
    range: top ? 550 : 480,
    tilt: top ? 8 : 52,
    heading: opts.heading ?? 0,
  };
}

/**
 * Map3D links center and cameraPosition. flyCameraTo and HTML attributes often
 * leave range at 0 or tear the photorealistic mesh. Set properties only; range last.
 */
export function writeRoof3dCamera(map: Roof3dMapCamera, cam: Roof3dCamera, _durationMillis = 0) {
  const endCamera: Roof3dCamera = {
    center: { lat: cam.center.lat, lng: cam.center.lng },
    range: cam.range,
    tilt: cam.tilt,
    heading: cam.heading,
  };
  try {
    map.stopCameraAnimation?.();
  } catch {
    /* not flying */
  }
  map.center = endCamera.center;
  map.heading = endCamera.heading;
  map.tilt = endCamera.tilt;
  map.range = endCamera.range;
}

export function roof3dMovedMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const dlat = (a.lat - b.lat) * 111_111;
  const dlng = (a.lng - b.lng) * 111_111 * Math.cos((a.lat * Math.PI) / 180);
  return Math.hypot(dlat, dlng);
}

function readCoord(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "function") {
    try {
      const next = (value as () => unknown)();
      return typeof next === "number" && Number.isFinite(next) ? next : null;
    } catch {
      return null;
    }
  }
  return null;
}

/** Map3D `gmp-click` position (LatLngAltitude or lat()/lng() objects). */
export function parseGmpClick(event: unknown): [number, number] | null {
  if (!event || typeof event !== "object") return null;
  const rec = event as { position?: unknown; latLng?: unknown };
  const position = rec.position ?? rec.latLng;
  if (!position || typeof position !== "object") return null;
  const loc = position as { lat?: unknown; lng?: unknown };
  const lat = readCoord(loc.lat);
  const lng = readCoord(loc.lng);
  if (lat == null || lng == null) return null;
  return [lat, lng];
}

/** Google click popovers plus leftover Marker3D nodes. Keep `data-ff-pin="1"`. */
export const MAP3D_STRAY_PIN_SELECTOR =
  "gmp-marker-3d, gmp-marker-3d-interactive, gmp-popover, gmp-marker-3d-label";

export function extraMap3dPinElements(root: {
  querySelectorAll: (selector: string) => ArrayLike<Element>;
  shadowRoot?: { querySelectorAll: (selector: string) => ArrayLike<Element> } | null;
}): Element[] {
  const from = (node: { querySelectorAll: (selector: string) => ArrayLike<Element> } | null | undefined) =>
    node ? [...node.querySelectorAll(MAP3D_STRAY_PIN_SELECTOR)] : [];
  return [...from(root), ...from(root.shadowRoot)].filter(
    (el) => (el as HTMLElement).dataset?.ffPin !== "1",
  );
}
