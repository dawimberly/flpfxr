import { useEffect, useRef, useState } from "react";
import { RoofGoogleMap, type RoofGoogleMapProps } from "@/components/roof-google-map";
import { RoofMap } from "@/components/roof-map";
import { RoofOrbitControls } from "@/components/roof-orbit-controls";
import { wrapDeg } from "@/lib/photo-view";
import { googleMapsApiKey, loadMaps3d, roofMapBasemap } from "@/lib/roof-basemap";
import { extraMap3dPinElements, parseGmpClick, roof3dHouseCamera, writeRoof3dCamera } from "@/lib/roof-3d";
import { EV_EDGE_COLOR, EV_FILL } from "@/lib/roof-style";

type OverlayEl = HTMLElement & {
  path?: unknown;
  coordinates?: unknown;
  outerCoordinates?: unknown;
  position?: unknown;
  label?: unknown;
};

type Map3D = HTMLElement & {
  center?: unknown;
  range?: unknown;
  tilt?: unknown;
  heading?: unknown;
  mode?: unknown;
  flyCameraTo?: (opts: { endCamera: unknown; durationMillis?: number }) => void;
  stopCameraAnimation?: () => void;
};

type Maps3dLib = {
  Map3DElement: new (opts: Record<string, unknown>) => Map3D;
  Polygon3DElement?: new (opts: Record<string, unknown>) => OverlayEl;
  Polygon3DInteractiveElement?: new (opts: Record<string, unknown>) => OverlayEl;
  Polyline3DElement?: new (opts: Record<string, unknown>) => OverlayEl;
  Marker3DElement?: new (opts: Record<string, unknown>) => OverlayEl;
  Marker3DInteractiveElement?: new (opts: Record<string, unknown>) => OverlayEl;
};

function asNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value && typeof value === "object" && "valueOf" in value) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function setPath(el: OverlayEl, pts: Array<{ lat: number; lng: number; altitude?: number }>) {
  el.path = pts;
  el.coordinates = pts;
  el.outerCoordinates = pts;
}

function applyCamera(map: Map3D, cam: ReturnType<typeof roof3dHouseCamera>, durationMillis: number) {
  writeRoof3dCamera(map, cam, durationMillis);
}

function stripStrayPins(map: Map3D) {
  for (const el of extraMap3dPinElements(map)) {
    try {
      el.remove();
    } catch {
      /* web component already gone */
    }
  }
}

function vertexTick(
  lat: number,
  lng: number,
  altitude = 0.6,
): Array<{ lat: number; lng: number; altitude: number }>[] {
  const d = 0.000008;
  return [
    [
      { lat: lat - d, lng, altitude },
      { lat: lat + d, lng, altitude },
    ],
    [
      { lat, lng: lng - d, altitude },
      { lat, lng: lng + d, altitude },
    ],
  ];
}

export type RoofGoogle3DMapProps = RoofGoogleMapProps & {
  pinSeq?: number;
};

export function RoofGoogle3DMap(props: RoofGoogle3DMapProps) {
  const {
    center,
    facets,
    draft,
    selectedId,
    drawing,
    edges,
    onReady,
    onClick,
    onSelect,
    pinSeq = 0,
  } = props;
  const hostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map3D | null>(null);
  const lookRef = useRef<{ lat: number; lng: number } | null>(null);
  const libRef = useRef<Maps3dLib | null>(null);
  const overlaysRef = useRef<OverlayEl[]>([]);
  const pinRef = useRef<OverlayEl | null>(null);
  const clickRef = useRef(onClick);
  const selectRef = useRef(onSelect);
  const drawingRef = useRef(drawing);
  clickRef.current = onClick;
  selectRef.current = onSelect;
  drawingRef.current = drawing;
  const missingKey = !googleMapsApiKey();
  const [mode, setMode] = useState<"loading" | "3d" | "2d" | "tiles">(missingKey ? "tiles" : "loading");
  const [error, setError] = useState<string | null>(
    missingKey
      ? "Photorealistic 3D needs VITE_GOOGLE_MAPS_API_KEY (Maps JavaScript API + Map Tiles API)."
      : null,
  );
  const [heading, setHeading] = useState(0);
  const [tilt, setTilt] = useState(8);

  function currentCam(opts: { top?: boolean; heading?: number } = {}) {
    return roof3dHouseCamera(center.lat, center.lng, {
      heading: opts.heading ?? heading,
      top: opts.top,
    });
  }

  useEffect(() => {
    if (!hostRef.current || mapRef.current) return;
    let cancelled = false;
    void (async () => {
      try {
        if (!googleMapsApiKey()) {
          setError(
            "Photorealistic 3D needs VITE_GOOGLE_MAPS_API_KEY (Maps JavaScript API + Map Tiles API).",
          );
          setMode("tiles");
          return;
        }
        const lib = await loadMaps3d();
        if (cancelled || !hostRef.current) return;
        if (!lib?.Map3DElement) throw new Error("3D Maps is not available on this key.");
        libRef.current = lib;
        const cam = roof3dHouseCamera(center.lat, center.lng, { top: true });
        const map = new lib.Map3DElement({
          ...cam,
          mode: "SATELLITE",
          gestureHandling: "GREEDY",
          defaultUIHidden: true,
        });
        map.style.cssText = "display:block;width:100%;height:100%;min-height:100%;border:0;";
        map.addEventListener("gmp-error", () => {
          setError("Google 3D failed to start. Photorealistic 3D Maps (Map Tiles API) must be on this key.");
          setMode("2d");
        });
        map.addEventListener("gmp-click", (event: Event) => {
          event.preventDefault();
        }, true);
        map.addEventListener("gmp-click", (event: Event) => {
          stripStrayPins(map);
          if ((map as Map3D & { isSteady?: boolean }).isSteady === false) return;
          const pt = parseGmpClick(event);
          if (!pt) return;
          clickRef.current(pt);
          window.requestAnimationFrame(() => stripStrayPins(map));
        });
        map.addEventListener("gmp-headingchange", () => setHeading(wrapDeg(asNumber(map.heading))));
        map.addEventListener("gmp-tiltchange", () => setTilt(asNumber(map.tilt)));
        hostRef.current.innerHTML = "";
        hostRef.current.append(map);
        mapRef.current = map;
        lookRef.current = { lat: cam.center.lat, lng: cam.center.lng };
        setHeading(cam.heading);
        setTilt(cam.tilt);
        setMode("3d");
        applyCamera(map, cam, 0);
        onReady?.({
          invalidate: () => {
            const live = mapRef.current;
            if (!live || asNumber(live.range) >= 50) return;
            applyCamera(live, currentCam({ top: asNumber(live.tilt) < 20 }), 0);
          },
        });
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Google 3D failed to load.");
        setMode(googleMapsApiKey() ? "2d" : "tiles");
      }
    })();
    return () => {
      cancelled = true;
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || mode !== "3d") return;
    if (pinSeq === 0) return;
    const cam = roof3dHouseCamera(center.lat, center.lng, {
      heading: asNumber(map.heading),
      top: true,
    });
    lookRef.current = { lat: center.lat, lng: center.lng };
    applyCamera(map, cam, 0);
    setHeading(cam.heading);
    setTilt(cam.tilt);
    // Search bumps pinSeq. Zoom/orbit/tap must not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinSeq, mode]);

  useEffect(() => {
    const map = mapRef.current;
    if (map) map.style.cursor = drawing ? "crosshair" : "";
  }, [drawing]);

  useEffect(() => {
    const map = mapRef.current;
    const lib = libRef.current;
    if (!map || !lib || mode !== "3d") return;
    const Marker = lib.Marker3DElement;
    if (!Marker) return;
    let pin = pinRef.current;
    if (!pin || pin.parentElement !== map) {
      pin?.remove();
      pin = new Marker({
        altitudeMode: "RELATIVE_TO_MESH",
        extruded: false,
        drawsWhenOccluded: true,
        position: { lat: center.lat, lng: center.lng, altitude: 0.5 },
      });
      pin.dataset.ffPin = "1";
      map.append(pin);
      pinRef.current = pin;
    } else {
      pin.position = { lat: center.lat, lng: center.lng, altitude: 0.5 };
    }
    stripStrayPins(map);
  }, [center.lat, center.lng, mode]);

  useEffect(() => {
    const map = mapRef.current;
    const lib = libRef.current;
    if (!map || !lib || mode !== "3d") return;
    for (const layer of overlaysRef.current) layer.remove();
    overlaysRef.current = [];
    map.querySelectorAll("[data-ff-overlay]").forEach((el) => el.remove());
    stripStrayPins(map);

    const Poly = lib.Polygon3DInteractiveElement ?? lib.Polygon3DElement;
    const Line = lib.Polyline3DElement;
    const clamp = { altitudeMode: "RELATIVE_TO_MESH" };

    const add = (el: OverlayEl | undefined) => {
      if (!el) return null;
      el.dataset.ffOverlay = "1";
      overlaysRef.current.push(el);
      map.append(el);
      return el;
    };

    facets.forEach((facet) => {
      if (facet.latlngs.length < 2 || !Poly) return;
      const path = facet.latlngs.map(([lat, lng]) => ({ lat, lng, altitude: 0.4 }));
      const poly = add(
        new Poly({
          ...clamp,
          strokeColor: "#11111100",
          strokeWidth: 0,
          fillColor: facet.id === selectedId ? `${EV_FILL}66` : `${EV_FILL}42`,
          drawsOccludedSegments: true,
        }),
      );
      if (!poly) return;
      setPath(poly, path);
      poly.addEventListener("gmp-click", (event: Event) => {
        event.stopPropagation();
        event.preventDefault();
        if (drawingRef.current) return;
        selectRef.current(facet.id);
      });
      if (!edges.length && Line) {
        const outline = add(
          new Line({
            ...clamp,
            strokeColor: EV_EDGE_COLOR.eave,
            strokeWidth: 3,
            drawsOccludedSegments: true,
          }),
        );
        if (outline) setPath(outline, [...path, path[0]]);
      }
    });

    if (draft.length && Line) {
      if (draft.length >= 2) {
        const line = add(
          new Line({
            ...clamp,
            strokeColor: "#111111",
            strokeWidth: 3,
            drawsOccludedSegments: true,
          }),
        );
        if (line) setPath(line, draft.map(([lat, lng]) => ({ lat, lng, altitude: 0.5 })));
      }
      for (const [lat, lng] of draft) {
        for (const tick of vertexTick(lat, lng)) {
          const mark = add(
            new Line({
              ...clamp,
              strokeColor: "#111111",
              strokeWidth: 3,
              drawsOccludedSegments: true,
            }),
          );
          if (mark) setPath(mark, tick);
        }
      }
    }

    for (const edge of edges) {
      if (edge.latlngs.length < 2 || !Line) continue;
      const color = EV_EDGE_COLOR[edge.kind] ?? EV_EDGE_COLOR.unclassified;
      const pts = edge.latlngs.map(([lat, lng]) => ({ lat, lng, altitude: 0.5 }));
      const line = add(
        new Line({
          ...clamp,
          strokeColor: color,
          strokeWidth: 4,
          drawsOccludedSegments: true,
        }),
      );
      if (line) setPath(line, pts);
    }

    return () => {
      for (const layer of overlaysRef.current) layer.remove();
      overlaysRef.current = [];
    };
  }, [draft, drawing, edges, facets, selectedId, mode]);

  if (mode === "2d" || mode === "tiles") {
    return (
      <div className="relative h-full min-h-0 w-full">
        {mode === "tiles" ? (
          <RoofMap {...props} basemap={roofMapBasemap("esri")} />
        ) : (
          <RoofGoogleMap {...props} />
        )}
        {error ? (
          <p className="pointer-events-none absolute inset-x-3 top-3 z-[1200] rounded-md bg-white/95 px-3 py-2 text-xs text-primary">
            {error} Search still flies this aerial. Add the Google key for the turnable 3D house.
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-0 w-full overflow-hidden bg-ink">
      <div ref={hostRef} className="h-full min-h-0 w-full" />
      {mode === "loading" ? (
        <p className="pointer-events-none absolute inset-0 z-[1100] flex items-center justify-center text-sm text-white/80">
          Loading 3D house...
        </p>
      ) : null}
      <RoofOrbitControls
        className="absolute right-3 top-14 z-[1100]"
        heading={heading}
        tilt={tilt}
        onRotate={(delta) => {
          const map = mapRef.current;
          if (!map) return;
          const next = wrapDeg(asNumber(map.heading) + delta);
          map.heading = next;
          setHeading(next);
        }}
        onNorth={() => {
          const map = mapRef.current;
          if (!map) return;
          map.heading = 0;
          setHeading(0);
        }}
        onTilt={() => {
          const map = mapRef.current;
          if (!map) return;
          const top = asNumber(map.tilt) >= 20;
          const cam = roof3dHouseCamera(center.lat, center.lng, {
            heading: asNumber(map.heading),
            top,
          });
          applyCamera(map, cam, 700);
          setTilt(cam.tilt);
        }}
      />
      {error ? (
        <p className="absolute inset-x-3 bottom-3 z-[1100] rounded-md bg-white/95 px-3 py-2 text-xs text-primary">
          {error} Add VITE_GOOGLE_MAPS_API_KEY with Maps JavaScript API and Photorealistic 3D Maps.
        </p>
      ) : null}
    </div>
  );
}
