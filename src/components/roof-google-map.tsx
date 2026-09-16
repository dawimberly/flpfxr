import { useEffect, useRef, useState } from "react";
import { RoofOrbitControls } from "@/components/roof-orbit-controls";
import { pointerAngle, wrapDeg, coverScale } from "@/lib/photo-view";
import { loadGoogleMaps } from "@/lib/roof-basemap";
import type { LatLng, NamedEdge, RoofFacet } from "@/lib/roof-math";
import { EV_EDGE_COLOR, EV_FILL, evLengthLabel } from "@/lib/roof-style";

type GLatLng = { lat: () => number; lng: () => number };
type GMaps = {
  Map: new (el: HTMLElement, opts: Record<string, unknown>) => GMap;
  Polygon: new (opts: Record<string, unknown>) => GOverlay;
  Polyline: new (opts: Record<string, unknown>) => GOverlay;
  Marker: new (opts: Record<string, unknown>) => GMarker;
  ControlPosition: { RIGHT_TOP: unknown; RIGHT_BOTTOM: unknown };
  MapTypeId: { SATELLITE: string };
  RenderingType?: { VECTOR: unknown };
  event: {
    addListener: (target: object, name: string, fn: (e?: GMouse) => void) => unknown;
    clearInstanceListeners: (target: object) => void;
    trigger: (target: object, name: string) => void;
  };
};

type GMap = {
  setCenter: (c: { lat: number; lng: number }) => void;
  setZoom: (z: number) => void;
  setTilt: (t: number) => void;
  setHeading: (h: number) => void;
  getTilt: () => number;
  getHeading: () => number;
  getDiv: () => HTMLElement;
  setOptions: (opts: Record<string, unknown>) => void;
};

type GOverlay = {
  setMap: (map: GMap | null) => void;
};

type GMarker = GOverlay & {
  getPosition: () => GLatLng | null;
};

type GMouse = {
  latLng?: GLatLng | null;
  stop?: () => void;
  domEvent?: Event;
};

function mapsApi(): GMaps {
  return (window as unknown as { google: { maps: GMaps } }).google.maps;
}

export type RoofGoogleMapProps = {
  center: { lat: number; lng: number };
  zoom: number;
  facets: RoofFacet[];
  draft: LatLng[];
  selectedId: string | null;
  drawing: boolean;
  edges: NamedEdge[];
  onReady?: (map: { invalidate: () => void }) => void;
  onClick: (latlng: LatLng) => void;
  onSelect: (id: string | null) => void;
  onMoveVertex: (id: string, index: number, latlng: LatLng) => void;
};

export function RoofGoogleMap({
  center,
  zoom,
  facets,
  draft,
  selectedId,
  drawing,
  edges,
  onReady,
  onClick,
  onSelect,
  onMoveVertex,
}: RoofGoogleMapProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<GMap | null>(null);
  const overlaysRef = useRef<GOverlay[]>([]);
  const clickRef = useRef(onClick);
  const selectRef = useRef(onSelect);
  const moveRef = useRef(onMoveVertex);
  const drawingRef = useRef(drawing);
  clickRef.current = onClick;
  selectRef.current = onSelect;
  moveRef.current = onMoveVertex;
  drawingRef.current = drawing;
  const [error, setError] = useState<string | null>(null);
  const [heading, setHeading] = useState(0);
  const [tilt, setTilt] = useState(0);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const rotateOriginRef = useRef({ angle: 0, deg: 0 });
  const headingRef = useRef(0);
  headingRef.current = heading;

  function applyHeading(next: number) {
    setHeading(wrapDeg(next));
  }

  function stepHeading(delta: number) {
    setHeading((current) => wrapDeg(current + delta));
  }

  useEffect(() => {
    if (!hostRef.current || mapRef.current) return;
    let cancelled = false;
    void (async () => {
      try {
        await loadGoogleMaps();
        if (cancelled || !hostRef.current) return;
        const maps = mapsApi();
        const mapOpts: Record<string, unknown> = {
          center,
          zoom,
          mapTypeId: maps.MapTypeId.SATELLITE,
          tilt: 0,
          heading: 0,
          disableDefaultUI: true,
          zoomControl: true,
          zoomControlOptions: { position: maps.ControlPosition.RIGHT_TOP },
          gestureHandling: "greedy",
          keyboardShortcuts: false,
          clickableIcons: false,
          streetViewControl: false,
          rotateControl: false,
          fullscreenControl: false,
          mapTypeControl: false,
          disableDoubleClickZoom: true,
          isFractionalZoomEnabled: true,
          maxZoom: 22,
        };
        const map = new maps.Map(hostRef.current, mapOpts);
        maps.event.addListener(map, "tilt_changed", () => setTilt(map.getTilt() || 0));
        maps.event.addListener(map, "click", (event?: GMouse) => {
          const pt = event?.latLng;
          if (!pt) return;
          clickRef.current([pt.lat(), pt.lng()]);
        });
        mapRef.current = map;
        const fit = () => {
          maps.event.trigger(map, "resize");
          map.setCenter(center);
        };
        window.setTimeout(fit, 50);
        window.setTimeout(fit, 250);
        onReady?.({ invalidate: fit });
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Google Maps failed to load.");
      }
    })();
    return () => {
      cancelled = true;
      if (mapRef.current) {
        try {
          mapsApi().event.clearInstanceListeners(mapRef.current);
        } catch {
          /* script may already be gone */
        }
      }
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setCenter(center);
    map.setZoom(zoom);
  }, [center.lat, center.lng, zoom]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setOptions({ draggableCursor: drawing ? "crosshair" : "" });
  }, [drawing]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !(window as unknown as { google?: { maps?: GMaps } }).google?.maps) return;
    const maps = mapsApi();
    for (const layer of overlaysRef.current) layer.setMap(null);
    overlaysRef.current = [];

    const add = (layer: GOverlay) => {
      overlaysRef.current.push(layer);
      return layer;
    };

    facets.forEach((facet) => {
      if (facet.latlngs.length < 2) return;
      const path = facet.latlngs.map(([lat, lng]) => ({ lat, lng }));
      const poly = add(
        new maps.Polygon({
          map,
          paths: path,
          strokeWeight: 0,
          fillColor: EV_FILL,
          fillOpacity: facet.id === selectedId ? 0.4 : 0.26,
          clickable: !drawing,
          zIndex: 2,
        }),
      );
      maps.event.addListener(poly, "click", (event?: GMouse) => {
        event?.stop?.();
        event?.domEvent?.preventDefault();
        if (drawingRef.current) return;
        selectRef.current(facet.id);
      });
      if (!edges.length) {
        add(
          new maps.Polyline({
            map,
            path: [...path, path[0]],
            strokeColor: EV_EDGE_COLOR.eave,
            strokeWeight: 2.5,
            strokeOpacity: 0.9,
            clickable: false,
            zIndex: 3,
          }),
        );
      }
      if (facet.id === selectedId) {
        facet.latlngs.forEach((pt, vertexIndex) => {
          const marker = add(
            new maps.Marker({
              map,
              position: { lat: pt[0], lng: pt[1] },
              draggable: true,
              cursor: "pointer",
              icon: {
                path: "M 0 0 m -6 0 a 6 6 0 1 0 12 0 a 6 6 0 1 0 -12 0",
                fillColor: "#111111",
                fillOpacity: 1,
                strokeColor: "#ffffff",
                strokeWeight: 2,
                scale: 1,
              },
              zIndex: 6,
            }),
          ) as GMarker;
          maps.event.addListener(marker, "drag", () => {
            const pos = marker.getPosition();
            if (!pos) return;
            moveRef.current(facet.id, vertexIndex, [pos.lat(), pos.lng()]);
          });
        });
      }
    });

    if (draft.length) {
      const path = draft.map(([lat, lng]) => ({ lat, lng }));
      add(
        new maps.Polyline({
          map,
          path,
          strokeColor: "#111111",
          strokeWeight: 2,
          strokeOpacity: 1,
          clickable: false,
          zIndex: 4,
        }),
      );
      draft.forEach((pt) => {
        add(
          new maps.Marker({
            map,
            position: { lat: pt[0], lng: pt[1] },
            clickable: false,
            icon: {
              path: "M 0 0 m -6 0 a 6 6 0 1 0 12 0 a 6 6 0 1 0 -12 0",
              fillColor: "#111111",
              fillOpacity: 1,
              strokeColor: "#ffffff",
              strokeWeight: 2,
              scale: 1,
            },
            zIndex: 5,
          }),
        );
      });
    }

    for (const edge of edges) {
      if (edge.latlngs.length < 2) continue;
      const color = EV_EDGE_COLOR[edge.kind] ?? EV_EDGE_COLOR.unclassified;
      const pts = edge.latlngs.map(([lat, lng]) => ({ lat, lng }));
      add(
        new maps.Polyline({
          map,
          path: pts,
          strokeColor: color,
          strokeWeight: 3.25,
          strokeOpacity: 0.95,
          clickable: false,
          zIndex: 4,
        }),
      );
      const label = evLengthLabel(edge.length_ft);
      if (label) {
        add(
          new maps.Marker({
            map,
            position: {
              lat: (pts[0].lat + pts[1].lat) / 2,
              lng: (pts[0].lng + pts[1].lng) / 2,
            },
            clickable: false,
            icon: {
              path: 0,
              scale: 0,
            },
            label: {
              text: label,
              color,
              fontSize: "12px",
              fontWeight: "700",
              className: "ff-ev-len",
            },
            zIndex: 5,
          }),
        );
      }
    }

    return () => {
      for (const layer of overlaysRef.current) layer.setMap(null);
      overlaysRef.current = [];
    };
  }, [draft, drawing, edges, facets, selectedId]);

  return (
    <div
      className="relative h-full min-h-[22rem] w-full overflow-hidden bg-ink"
      onPointerDown={(event) => {
        pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (pointersRef.current.size === 2) {
          const [a, b] = [...pointersRef.current.values()];
          rotateOriginRef.current = { angle: pointerAngle(a, b), deg: headingRef.current };
        }
      }}
      onPointerMove={(event) => {
        if (!pointersRef.current.has(event.pointerId)) return;
        pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (pointersRef.current.size < 2) return;
        const [a, b] = [...pointersRef.current.values()];
        applyHeading(rotateOriginRef.current.deg + (pointerAngle(a, b) - rotateOriginRef.current.angle));
      }}
      onPointerUp={(event) => {
        pointersRef.current.delete(event.pointerId);
      }}
      onPointerCancel={(event) => {
        pointersRef.current.delete(event.pointerId);
      }}
    >
      <div
        className="absolute inset-0 origin-center"
        style={{
          transform: `rotate(${heading}deg) scale(${coverScale(
            hostRef.current?.parentElement?.clientWidth ?? 400,
            hostRef.current?.parentElement?.clientHeight ?? 400,
            heading,
          )})`,
        }}
      >
        <div ref={hostRef} className="h-full min-h-[22rem] w-full" />
      </div>
      <RoofOrbitControls
        className="absolute right-3 top-14 z-[1100]"
        heading={heading}
        tilt={tilt}
        onRotate={stepHeading}
        onNorth={() => {
          const map = mapRef.current;
          map?.setTilt(0);
          setHeading(0);
          setTilt(0);
        }}
        onTilt={() => {
          const map = mapRef.current;
          if (!map) return;
          if (map.getTilt() >= 20) {
            map.setTilt(0);
            setTilt(0);
            return;
          }
          map.setTilt(45);
          setTilt(45);
        }}
      />
      {error ? (
        <p className="absolute inset-x-3 bottom-3 z-[1100] rounded-md bg-white/95 px-3 py-2 text-xs text-primary">
          {error} Add VITE_GOOGLE_MAPS_API_KEY for Google satellite tracing.
        </p>
      ) : null}
    </div>
  );
}
