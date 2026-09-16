import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ExternalLink, Hammer, RotateCcw, Trash2, Undo2 } from "lucide-react";
import { EvLegend, RoofDimFields } from "@/components/roof-ev-chrome";
import { RoofMap } from "@/components/roof-map";
import { RoofPhotoLab } from "@/components/roof-photo-lab";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BLUE_QUAIL } from "@/lib/blue-quail";
import {
  availableBasemaps,
  esriWaybackAppUrl,
  googleEarthNadirUrl,
  googleMapsSatelliteUrl,
  openTopographyUrl,
  parseWaybackConfig,
  roofMapBasemap,
  WAYBACK_CONFIG_URL,
  type BasemapId,
  type WaybackRelease,
} from "@/lib/roof-basemap";
import { COMPANY } from "@/lib/estimator";
import { geocodeAddress } from "@/lib/geocode";
import {
  DEFAULT_WASTE_PCT,
  PITCH_OPTIONS,
  summarizeFacets,
  type LatLng,
  type RoofFacet,
} from "@/lib/roof-math";
import { useEstimatorStore } from "@/lib/estimator-store";
import { cn } from "@/lib/utils";

const TRACE_KEY = "flipfixer.roof-trace.v1";

const DRAINS = [
  { value: "__none", label: "none" },
  { value: "0", label: "N" },
  { value: "45", label: "NE" },
  { value: "90", label: "E" },
  { value: "135", label: "SE" },
  { value: "180", label: "S" },
  { value: "225", label: "SW" },
  { value: "270", label: "W" },
  { value: "315", label: "NW" },
];

type SavedTrace = {
  address: string;
  center: { lat: number; lng: number };
  facets: RoofFacet[];
  garageWidth?: string;
  eaveOverhang?: string;
  rakeOverhang?: string;
};

function newFacetId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `facet-${Math.random().toString(36).slice(2, 10)}`;
}

function loadTrace(): SavedTrace | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(TRACE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedTrace;
    if (!parsed?.facets || !parsed.center) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveTrace(trace: SavedTrace) {
  if (typeof window === "undefined") return;
  localStorage.setItem(TRACE_KEY, JSON.stringify(trace));
}

export function RoofTracerApp() {
  const navigate = useNavigate();
  const applyRoofTrace = useEstimatorStore((s) => s.applyRoofTrace);
  const hydrate = useEstimatorStore((s) => s.hydrate);
  const [address, setAddress] = useState(BLUE_QUAIL.address);
  const [center, setCenter] = useState(BLUE_QUAIL.center);
  const [zoom, setZoom] = useState(19);
  const [facets, setFacets] = useState<RoofFacet[]>([]);
  const [draft, setDraft] = useState<LatLng[]>([]);
  const [drawing, setDrawing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [looking, setLooking] = useState(false);
  const [sent, setSent] = useState(false);
  const [mode, setMode] = useState<"map" | "photos">("photos");
  const [mapSeen, setMapSeen] = useState(false);
  const mapApiRef = useRef<{ invalidate: () => void } | null>(null);
  const [garageWidth, setGarageWidth] = useState(BLUE_QUAIL.garageWidthFt);
  const [eaveOverhang, setEaveOverhang] = useState(BLUE_QUAIL.eaveOverhangIn);
  const [rakeOverhang, setRakeOverhang] = useState(BLUE_QUAIL.rakeOverhangIn);
  const [traceReady, setTraceReady] = useState(false);
  const [photoClearTick, setPhotoClearTick] = useState(0);
  const maptilerKey = import.meta.env.VITE_MAPTILER_KEY as string | undefined;
  const basemapChoices = availableBasemaps(maptilerKey);
  const [basemapId, setBasemapId] = useState<BasemapId>("esri");
  const [waybackRelease, setWaybackRelease] = useState("26334");
  const [waybackDates, setWaybackDates] = useState<WaybackRelease[]>([]);
  const mapBasemap = useMemo(
    () => roofMapBasemap(basemapId, { waybackRelease, maptilerKey }),
    [basemapId, maptilerKey, waybackRelease],
  );

  useEffect(() => {
    hydrate();
    const saved = loadTrace();
    if (saved?.facets?.length || saved?.garageWidth) {
      setAddress(saved.address);
      setCenter(saved.center);
      setFacets(saved.facets);
      setGarageWidth(saved.garageWidth ?? "");
      setEaveOverhang(saved.eaveOverhang ?? "");
      setRakeOverhang(saved.rakeOverhang ?? "");
      setZoom(20);
    } else {
      setAddress(BLUE_QUAIL.address);
      setCenter(BLUE_QUAIL.center);
      setGarageWidth(BLUE_QUAIL.garageWidthFt);
      setEaveOverhang(BLUE_QUAIL.eaveOverhangIn);
      setRakeOverhang(BLUE_QUAIL.rakeOverhangIn);
      setZoom(20);
    }
    setTraceReady(true);
  }, [hydrate]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(WAYBACK_CONFIG_URL);
        if (!res.ok) return;
        const raw = (await res.json()) as Record<string, { itemTitle?: string }>;
        if (cancelled) return;
        const rows = parseWaybackConfig(raw);
        if (!rows.length) return;
        setWaybackDates(rows);
        setWaybackRelease((current) =>
          rows.some((row) => row.release === current) ? current : rows[0].release,
        );
      } catch {
        /* Esri aerial still works without the date list. */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (mode !== "map") return;
    setMapSeen(true);
    const t = window.setTimeout(() => mapApiRef.current?.invalidate(), 80);
    const t2 = window.setTimeout(() => mapApiRef.current?.invalidate(), 280);
    return () => {
      window.clearTimeout(t);
      window.clearTimeout(t2);
    };
  }, [mode]);

  useEffect(() => {
    if (!traceReady) return;
    saveTrace({ address, center, facets, garageWidth, eaveOverhang, rakeOverhang });
  }, [traceReady, address, center, facets, garageWidth, eaveOverhang, rakeOverhang]);

  const summary = useMemo(() => summarizeFacets(facets), [facets]);
  const selected = facets.find((facet) => facet.id === selectedId) ?? null;

  function patchFacet(id: string, patch: Partial<RoofFacet>) {
    setFacets((current) => current.map((facet) => (facet.id === id ? { ...facet, ...patch } : facet)));
  }

  async function onPin(event: React.FormEvent) {
    event.preventDefault();
    setLooking(true);
    setLookupError(null);
    try {
      const result = await geocodeAddress({ data: { query: address } });
      if (result.error || !result.hit) {
        setLookupError(result.error ?? "No match.");
        return;
      }
      setCenter({ lat: result.hit.lat, lng: result.hit.lng });
      setZoom(20);
      setAddress(result.hit.label);
    } catch {
      setLookupError("Address lookup failed.");
    } finally {
      setLooking(false);
    }
  }

  function onMapClick(latlng: LatLng) {
    if (!drawing) return;
    setDraft((current) => [...current, latlng]);
  }

  function closeDraft() {
    if (draft.length < 3) return;
    const facet: RoofFacet = {
      id: newFacetId(),
      latlngs: draft,
      pitch: selected?.pitch || facets[facets.length - 1]?.pitch || "",
      slopeDeg: null,
    };
    setFacets((current) => [...current, facet]);
    setSelectedId(facet.id);
    setDraft([]);
    setDrawing(false);
    setSent(false);
  }

  function sendToEstimator() {
    if (summary.incomplete) return;
    applyRoofTrace(address, summary);
    setSent(true);
    void navigate({ to: "/estimator" });
  }

  return (
    <div className="estimator-shell flex min-h-dvh flex-col bg-bg">
      <header className="sticky top-0 z-30 border-b border-border/80 bg-bg/90 pt-[env(safe-area-inset-top)] backdrop-blur-md">
        <div className="mx-auto flex w-full min-w-0 max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-ink font-display text-sm font-medium text-ink-foreground">
              {COMPANY.mark}
            </span>
            <div className="min-w-0">
              <p className="truncate font-display text-base font-medium tracking-tight sm:text-lg">
                Roof trace
              </p>
                  <p className="truncate text-xs text-muted">Front, right, back, left, then pitch</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div className="flex rounded-full bg-surface p-1">
              <button
                type="button"
                onClick={() => setMode("photos")}
                className={cn(
                  "h-8 rounded-full px-3 text-xs",
                  mode === "photos" ? "bg-ink text-ink-foreground" : "text-muted",
                )}
              >
                Pictures
              </button>
              <button
                type="button"
                onClick={() => {
                  setMapSeen(true);
                  setMode("map");
                }}
                className={cn(
                  "h-8 rounded-full px-3 text-xs",
                  mode === "map" ? "bg-ink text-ink-foreground" : "text-muted",
                )}
              >
                Map
              </button>
            </div>
            <Button asChild type="button" variant="ghost" size="sm">
              <Link to="/estimator">Estimator</Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setFacets([]);
                setDraft([]);
                setSelectedId(null);
                setDrawing(false);
                setSent(false);
                setPhotoClearTick((n) => n + 1);
              }}
            >
              <RotateCcw className="size-4" />
              Clear
            </Button>
          </div>
        </div>
      </header>

      <main
        className={cn(
          "mx-auto flex min-h-0 w-full min-w-0 max-w-6xl flex-1 px-4 py-4 sm:px-6",
          mode === "photos" ? "" : "hidden",
        )}
      >
        <RoofPhotoLab clearTick={photoClearTick} />
      </main>
      {mapSeen ? (
      <main
        className={cn(
          "mx-auto grid w-full min-w-0 max-w-6xl flex-1 gap-4 px-4 py-4 sm:px-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,22rem)]",
          mode === "map" ? "" : "hidden",
        )}
      >
        <section className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl bg-card shadow-border">
          <form onSubmit={onPin} className="flex flex-col gap-2 border-b border-border px-4 py-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1 space-y-1.5">
                <Label htmlFor="roof-address">Address</Label>
                <Input
                  id="roof-address"
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  placeholder="2519 Blue Quail St, San Antonio, TX"
                  autoComplete="street-address"
                />
              </div>
              <Button type="submit" disabled={looking}>
                {looking ? "Finding-" : "Pin house"}
              </Button>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1 space-y-1.5">
                <Label>Top view</Label>
                <Select
                  value={basemapId}
                  onValueChange={(value) => setBasemapId(value as BasemapId)}
                >
                  <SelectTrigger className="h-10" aria-label="Top view source">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {basemapChoices.map((row) => (
                      <SelectItem key={row.id} value={row.id}>
                        {row.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {basemapId === "wayback" ? (
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Label>Wayback date</Label>
                  <Select value={waybackRelease} onValueChange={setWaybackRelease}>
                    <SelectTrigger className="h-10" aria-label="Wayback imagery date">
                      <SelectValue placeholder="Date" />
                    </SelectTrigger>
                    <SelectContent>
                      {(waybackDates.length
                        ? waybackDates
                        : [{ release: waybackRelease, date: "2026-08-05", title: "Wayback" }]
                      ).map((row) => (
                        <SelectItem key={row.release} value={row.release}>
                          {row.date}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
            </div>
            <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
              <a
                className="inline-flex items-center gap-1 underline-offset-2 hover:underline"
                href={googleEarthNadirUrl(center.lat, center.lng)}
                target="_blank"
                rel="noreferrer"
              >
                Google Earth <ExternalLink className="size-3" />
              </a>
              <a
                className="inline-flex items-center gap-1 underline-offset-2 hover:underline"
                href={googleMapsSatelliteUrl(center.lat, center.lng)}
                target="_blank"
                rel="noreferrer"
              >
                Maps satellite <ExternalLink className="size-3" />
              </a>
              <a
                className="inline-flex items-center gap-1 underline-offset-2 hover:underline"
                href={esriWaybackAppUrl(center.lat, center.lng)}
                target="_blank"
                rel="noreferrer"
              >
                Esri Wayback <ExternalLink className="size-3" />
              </a>
              <a
                className="inline-flex items-center gap-1 underline-offset-2 hover:underline"
                href={openTopographyUrl(center.lat, center.lng)}
                target="_blank"
                rel="noreferrer"
              >
                OpenTopography <ExternalLink className="size-3" />
              </a>
            </p>
          </form>
          {lookupError ? <p className="px-4 pt-2 text-xs text-primary">{lookupError}</p> : null}
          <div className="relative min-h-[22rem] flex-1">
            <RoofMap
              center={center}
              zoom={zoom}
              facets={facets}
              draft={draft}
              selectedId={selectedId}
              drawing={drawing}
              edges={summary.edges}
              basemap={mapBasemap}
              onReady={(api) => {
                mapApiRef.current = api;
              }}
              onClick={onMapClick}
              onSelect={(id) => {
                if (drawing) return;
                setSelectedId(id);
              }}
              onMoveVertex={(id, index, latlng) => {
                setFacets((current) =>
                  current.map((facet) =>
                    facet.id === id
                      ? {
                          ...facet,
                          latlngs: facet.latlngs.map((pt, i) => (i === index ? latlng : pt)),
                        }
                      : facet,
                  ),
                );
                setSent(false);
              }}
            />
            <EvLegend className="absolute left-3 top-3 z-[1100]" />
            <div className="absolute bottom-3 left-3 right-3 z-[1100] flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  setDrawing(true);
                  setSelectedId(null);
                }}
              >
                Draw plane
              </Button>
              <Button type="button" size="sm" variant="outline" disabled={draft.length < 3} onClick={closeDraft}>
                Close plane
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={!draft.length}
                onClick={() => setDraft((current) => current.slice(0, -1))}
              >
                <Undo2 className="size-4" />
                Undo tap
              </Button>
              {drawing ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setDrawing(false);
                    setDraft([]);
                  }}
                >
                  Cancel
                </Button>
              ) : null}
            </div>
          </div>
          <p className="px-4 py-2 text-xs text-muted">
            Top view is nadir aerial, not Google 3D. Esri and USGS are current overhead. Wayback is
            the same imagery on older dates. OpenTopoMap is a topo map. Tap the roof edge, not the
            slab. Pitch still comes from the house or a gauge.
          </p>
        </section>

        <aside className="space-y-4">
          <div className="rounded-xl bg-ink p-5 text-ink-foreground shadow-border">
            <p className="text-[11px] font-medium tracking-[0.18em] text-ink-foreground/60 uppercase">
              This roof
            </p>
            <p className="mt-2 font-display text-4xl font-medium tracking-tight tabular-nums">
              {summary.squares_with_waste.toFixed(2)}
            </p>
            <p className="mt-1 text-sm text-ink-foreground/70">
              squares with {summary.waste_factor_pct}% waste
            </p>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-ink-foreground/55">Plan</dt>
                <dd className="font-mono tabular-nums">{summary.total_flat_area_sqft.toFixed(0)} sf</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-ink-foreground/55">Sloped</dt>
                <dd className="font-mono tabular-nums">
                  {summary.total_area_with_pitch_multiplier_sqft.toFixed(0)} sf
                </dd>
              </div>
              {summary.eaves_ft != null ? (
                <>
                  <div>
                    <dt className="text-[11px] uppercase tracking-wide text-ink-foreground/55">Eave</dt>
                    <dd className="font-mono tabular-nums">{summary.eaves_ft} ft</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase tracking-wide text-ink-foreground/55">Ridge</dt>
                    <dd className="font-mono tabular-nums">{summary.ridges_ft} ft</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase tracking-wide text-ink-foreground/55">Rake</dt>
                    <dd className="font-mono tabular-nums">{summary.rakes_ft} ft</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase tracking-wide text-ink-foreground/55">Hip / valley</dt>
                    <dd className="font-mono tabular-nums">
                      {summary.hips_ft} / {summary.valleys_ft} ft
                    </dd>
                  </div>
                </>
              ) : (
                <p className="col-span-2 text-xs text-ink-foreground/60">
                  Add a drain direction on each plane to name ridge, eave, rake, hip, and valley.
                </p>
              )}
            </dl>
            <div className="mt-4">
              <RoofDimFields
                variant="ink"
                garageWidth={garageWidth}
                eaveOverhang={eaveOverhang}
                rakeOverhang={rakeOverhang}
                onGarageWidth={setGarageWidth}
                onEaveOverhang={setEaveOverhang}
                onRakeOverhang={setRakeOverhang}
              />
            </div>
            {summary.incomplete ? (
              <p className="mt-4 text-sm text-primary">{summary.incomplete}</p>
            ) : null}
            <Button
              type="button"
              className="mt-5 w-full"
              disabled={Boolean(summary.incomplete)}
              onClick={sendToEstimator}
            >
              <Hammer className="size-4" />
              Send squares to estimator
            </Button>
            {sent ? <p className="mt-2 text-xs text-ink-foreground/70">Wrote a Roof room on this job.</p> : null}
          </div>

          <div className="rounded-xl bg-card p-4 shadow-border">
            <p className="text-[11px] font-medium tracking-[0.18em] text-muted uppercase">Planes</p>
            {facets.length === 0 ? (
              <p className="mt-3 text-sm text-muted">
                Draw one plane per roof slope. A two-gable needs two polygons even if the pitch matches.
              </p>
            ) : (
              <ul className="mt-3 space-y-3">
                {facets.map((facet, index) => {
                  const on = facet.id === selectedId;
                  return (
                    <li
                      key={facet.id}
                      className={cn("rounded-lg p-3", on ? "bg-wash" : "bg-surface")}
                    >
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-2 text-left"
                        onClick={() => setSelectedId(facet.id)}
                      >
                        <span className="text-sm font-medium">Plane {index + 1}</span>
                        <span className="font-mono text-xs text-muted">{facet.pitch || "no pitch"}</span>
                      </button>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Pitch</Label>
                          <Select
                            value={facet.pitch || "__none"}
                            onValueChange={(value) =>
                              patchFacet(facet.id, { pitch: value === "__none" ? "" : value })
                            }
                          >
                            <SelectTrigger className="h-10" aria-label={`Pitch for plane ${index + 1}`}>
                              <SelectValue placeholder="Pitch" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none">- pick -</SelectItem>
                              {PITCH_OPTIONS.map((pitch) => (
                                <SelectItem key={pitch} value={pitch}>
                                  {pitch}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Drain</Label>
                          <Select
                            value={facet.slopeDeg == null ? "__none" : String(facet.slopeDeg)}
                            onValueChange={(value) =>
                              patchFacet(facet.id, { slopeDeg: value === "__none" ? null : Number(value) })
                            }
                          >
                            <SelectTrigger className="h-10" aria-label={`Drain for plane ${index + 1}`}>
                              <SelectValue placeholder="Drain" />
                            </SelectTrigger>
                            <SelectContent>
                              {DRAINS.map((drain) => (
                                <SelectItem key={drain.label} value={drain.value}>
                                  {drain.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="mt-2"
                        onClick={() => {
                          setFacets((current) => current.filter((item) => item.id !== facet.id));
                          if (selectedId === facet.id) setSelectedId(null);
                        }}
                      >
                        <Trash2 className="size-4" />
                        Remove plane
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="mt-3 text-xs text-muted">
              Waste is {DEFAULT_WASTE_PCT}%. This is a sales measure, not an EagleView report.
            </p>
          </div>
        </aside>
      </main>
      ) : null}
    </div>
  );
}
