import { useEffect, useRef } from "react";
import { esriAerialUrl, type RoofMapBasemap } from "@/lib/roof-basemap";
import type { LatLng, NamedEdge, RoofFacet } from "@/lib/roof-math";
import { EV_EDGE_COLOR, EV_FILL, evLengthLabel } from "@/lib/roof-style";
import "leaflet/dist/leaflet.css";

const DEFAULT_BASEMAP: RoofMapBasemap = {
  url: esriAerialUrl(),
  attribution: "Tiles \u00a9 Esri",
  maxZoom: 20,
  maxNativeZoom: 19,
};

export type RoofMapProps = {
  center: { lat: number; lng: number };
  zoom: number;
  facets: RoofFacet[];
  draft: LatLng[];
  selectedId: string | null;
  drawing: boolean;
  edges: NamedEdge[];
  basemap?: RoofMapBasemap;
  onReady?: (map: { invalidate: () => void }) => void;
  onClick: (latlng: LatLng) => void;
  onSelect: (id: string | null) => void;
  onMoveVertex: (id: string, index: number, latlng: LatLng) => void;
};

export function RoofMap({
  center,
  zoom,
  facets,
  draft,
  selectedId,
  drawing,
  edges,
  basemap = DEFAULT_BASEMAP,
  onReady,
  onClick,
  onSelect,
  onMoveVertex,
}: RoofMapProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const tilesRef = useRef<import("leaflet").TileLayer | null>(null);
  const layersRef = useRef<import("leaflet").LayerGroup | null>(null);
  const centerRef = useRef(center);
  const zoomRef = useRef(zoom);
  const clickRef = useRef(onClick);
  const selectRef = useRef(onSelect);
  const moveRef = useRef(onMoveVertex);
  const basemapRef = useRef(basemap);
  centerRef.current = center;
  zoomRef.current = zoom;
  clickRef.current = onClick;
  selectRef.current = onSelect;
  moveRef.current = onMoveVertex;
  basemapRef.current = basemap;

  useEffect(() => {
    if (!hostRef.current || mapRef.current) return;
    let cancelled = false;
    void (async () => {
      const L = await import("leaflet");
      if (cancelled || !hostRef.current) return;
      const start = basemapRef.current;
      const map = L.map(hostRef.current, {
        zoomControl: true,
        attributionControl: true,
        maxZoom: start.maxZoom,
      }).setView([centerRef.current.lat, centerRef.current.lng], zoomRef.current);
      const tiles = L.tileLayer(start.url, {
        maxZoom: start.maxZoom,
        maxNativeZoom: start.maxNativeZoom,
        attribution: start.attribution,
        ...(start.subdomains ? { subdomains: start.subdomains } : {}),
      }).addTo(map);
      tilesRef.current = tiles;
      const layers = L.layerGroup().addTo(map);
      map.on("click", (event) => {
        clickRef.current([event.latlng.lat, event.latlng.lng]);
      });
      mapRef.current = map;
      layersRef.current = layers;
      onReady?.({ invalidate: () => map.invalidateSize() });
      requestAnimationFrame(() => map.invalidateSize());
      window.setTimeout(() => map.invalidateSize(), 250);
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      layersRef.current = null;
      tilesRef.current = null;
    };
    // Center/zoom after first mount are handled in the next effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    let cancelled = false;
    void (async () => {
      const L = await import("leaflet");
      if (cancelled || !mapRef.current) return;
      tilesRef.current?.remove();
      map.setMaxZoom(basemap.maxZoom);
      const tiles = L.tileLayer(basemap.url, {
        maxZoom: basemap.maxZoom,
        maxNativeZoom: basemap.maxNativeZoom,
        attribution: basemap.attribution,
        ...(basemap.subdomains ? { subdomains: basemap.subdomains } : {}),
      }).addTo(map);
      tiles.bringToBack();
      tilesRef.current = tiles;
      if (map.getZoom() > basemap.maxNativeZoom) {
        map.setZoom(basemap.maxNativeZoom);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [basemap.attribution, basemap.maxNativeZoom, basemap.maxZoom, basemap.subdomains, basemap.url]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const current = map.getCenter();
    const moved =
      Math.abs(current.lat - center.lat) > 0.00005 || Math.abs(current.lng - center.lng) > 0.00005;
    if (moved) map.setView([center.lat, center.lng], Math.max(zoom, map.getZoom()));
  }, [center.lat, center.lng, zoom]);

  useEffect(() => {
    const map = mapRef.current;
    const layers = layersRef.current;
    if (!map || !layers) return;
    let cancelled = false;
    void (async () => {
      const L = await import("leaflet");
      if (cancelled) return;
      layers.clearLayers();
      facets.forEach((facet) => {
        if (facet.latlngs.length < 2) return;
        const poly = L.polygon(
          facet.latlngs.map(([lat, lng]) => [lat, lng] as [number, number]),
          {
            color: EV_FILL,
            weight: 0,
            fillColor: EV_FILL,
            fillOpacity: facet.id === selectedId ? 0.4 : 0.26,
          },
        );
        poly.on("click", (event) => {
          L.DomEvent.stopPropagation(event);
          selectRef.current(facet.id);
        });
        poly.addTo(layers);
        if (!edges.length && facet.latlngs.length >= 2) {
          const ring = [...facet.latlngs, facet.latlngs[0]].map(
            ([lat, lng]) => [lat, lng] as [number, number],
          );
          L.polyline(ring, { color: EV_EDGE_COLOR.eave, weight: 2.5, opacity: 0.9 }).addTo(layers);
        }
        if (facet.id === selectedId) {
          facet.latlngs.forEach((pt, vertexIndex) => {
            const marker = L.circleMarker([pt[0], pt[1]], {
              radius: 6,
              color: "#fff",
              weight: 2,
              fillColor: "#111",
              fillOpacity: 1,
            });
            marker.addTo(layers);
            marker.on("mousedown", (down) => {
              L.DomEvent.stopPropagation(down);
              const onMove = (move: import("leaflet").LeafletMouseEvent) => {
                moveRef.current(facet.id, vertexIndex, [move.latlng.lat, move.latlng.lng]);
              };
              const onUp = () => {
                map.off("mousemove", onMove);
                map.off("mouseup", onUp);
                map.dragging.enable();
              };
              map.dragging.disable();
              map.on("mousemove", onMove);
              map.on("mouseup", onUp);
            });
          });
        }
      });
      if (draft.length) {
        const latlngs = draft.map(([lat, lng]) => [lat, lng] as [number, number]);
        L.polyline(latlngs, { color: "#111", weight: 2, dashArray: "6 4" }).addTo(layers);
        draft.forEach((pt) => {
          L.circleMarker([pt[0], pt[1]], {
            radius: 6,
            color: "#fff",
            weight: 2,
            fillColor: "#111",
            fillOpacity: 1,
          }).addTo(layers);
        });
      }
      for (const edge of edges) {
        if (edge.latlngs.length < 2) continue;
        const color = EV_EDGE_COLOR[edge.kind] ?? EV_EDGE_COLOR.unclassified;
        const pts = edge.latlngs.map(([lat, lng]) => [lat, lng] as [number, number]);
        L.polyline(pts, {
          color,
          weight: 3.25,
          opacity: 0.95,
        }).addTo(layers);
        const label = evLengthLabel(edge.length_ft);
        if (label) {
          const mid: [number, number] = [
            (pts[0][0] + pts[1][0]) / 2,
            (pts[0][1] + pts[1][1]) / 2,
          ];
          L.marker(mid, {
            interactive: false,
            icon: L.divIcon({
              className: "",
              iconSize: [32, 18],
              iconAnchor: [16, 9],
              html: `<span style="display:inline-block;padding:0 3px;font:700 12px Arial,Helvetica,sans-serif;color:${color};background:#fff;line-height:16px;border-radius:2px">${label}</span>`,
            }),
          }).addTo(layers);
        }
      }
      if (hostRef.current) {
        hostRef.current.style.cursor = drawing ? "crosshair" : "";
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [draft, drawing, edges, facets, selectedId]);

  return <div ref={hostRef} className="h-full min-h-[22rem] w-full bg-ink" />;
}
