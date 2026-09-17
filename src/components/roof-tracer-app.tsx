import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Clock, ExternalLink, FileUp, Hammer, RotateCcw, Search, Trash2, Undo2 } from "lucide-react";
import { EvLinePalette, RoofDimFields } from "@/components/roof-ev-chrome";
import { RoofPenetrationPicker } from "@/components/roof-penetration-picker";
import { RoofGoogle3DMap } from "@/components/roof-google-3d-map";
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
import { BLUE_QUAIL, blueQuailMapTrace } from "@/lib/blue-quail";
import {
  availableBasemaps,
  esriWaybackAppUrl,
  googleEarthNadirUrl,
  googleMapsSatelliteUrl,
  openTopographyUrl,
  parseWaybackConfig,
  pickWinterWayback,
  roofMapBasemap,
  waybackDateLabel,
  winterWaybackRank,
  WAYBACK_CONFIG_URL,
  type BasemapId,
  type WaybackRelease,
} from "@/lib/roof-basemap";
import { COMPANY } from "@/lib/estimator";
import { autoRoofSummary, fetchAutoRoofQuote, type AutoRoofQuote } from "@/lib/roof-auto";
import { roofCodeNote, zipFromAddress } from "@/lib/roof-code";
import {
  mergeRoofPenetrations,
  parseRoofQty,
  roofBallpark,
  type RoofLineItem,
} from "@/lib/roof-line-items";
import { geocodeHouseAddress } from "@/lib/roof-geocode";
import { parseEagleViewText, type EagleViewReport } from "@/lib/eagleview-parse";
import { extractPdfText } from "@/lib/pdf-text";
import { parseXactimateRoof, xactimateRoofPenetrations } from "@/lib/xactimate-roof";
import {
  PITCH_OPTIONS,
  ROOF_VERTEX_SNAP_FT,
  SEARCH_QUOTE_LINE,
  alignRingToAnchors,
  closeRoofRing,
  geodesicSegmentFt,
  roofSnapAnchors,
  salesSquares,
  snapRoofLatLng,
  summarizeFacets,
  type LatLng,
  type NamedEdge,
  type RoofFacet,
} from "@/lib/roof-math";
import { EV_LEGEND } from "@/lib/roof-style";
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
  corniceStrip?: string;
  corniceReturn?: string;
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
  const [tool, setTool] = useState<"plane" | "line">("line");
  const [lineKind, setLineKind] = useState("eave");
  const [mapLines, setMapLines] = useState<NamedEdge[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [pinHint, setPinHint] = useState<string | null>(null);
  const [looking, setLooking] = useState(false);
  const [pinSeq, setPinSeq] = useState(0);
  const [autoQuote, setAutoQuote] = useState<AutoRoofQuote | null>(null);
  const [evReport, setEvReport] = useState<EagleViewReport | null>(null);
  const [readingPdf, setReadingPdf] = useState(false);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const [penetrations, setPenetrations] = useState<RoofLineItem[]>([]);
  const [twoStory, setTwoStory] = useState(false);
  const [classPitch, setClassPitch] = useState("5/12");
  const [cutUp, setCutUp] = useState(false);
  const [valleyCount, setValleyCount] = useState("0");
  const [sent, setSent] = useState(false);
  const [mode, setMode] = useState<"map" | "photos">("map");
  const [mapSeen, setMapSeen] = useState(true);
  const mapApiRef = useRef<{ invalidate: () => void } | null>(null);
  const [corniceStrip, setCorniceStrip] = useState(BLUE_QUAIL.corniceStripLf);
  const [corniceReturn, setCorniceReturn] = useState(BLUE_QUAIL.corniceReturnEa);
  const [traceReady, setTraceReady] = useState(false);
  const [photoClearTick, setPhotoClearTick] = useState(0);
  const maptilerKey = import.meta.env.VITE_MAPTILER_KEY as string | undefined;
  const basemapChoices = availableBasemaps(maptilerKey);
  const [basemapId, setBasemapId] = useState<BasemapId>("google");
  const [waybackRelease, setWaybackRelease] = useState("64001");
  const [waybackDates, setWaybackDates] = useState<WaybackRelease[]>([]);
  const waybackPickedRef = useRef(false);
  const mapBasemap = useMemo(
    () => roofMapBasemap(basemapId, { waybackRelease, maptilerKey }),
    [basemapId, maptilerKey, waybackRelease],
  );
  const waybackChoices = useMemo(() => {
    const rows = waybackDates.length
      ? waybackDates
      : [{ release: waybackRelease, date: "2026-02-26", title: "Wayback" }];
    return [...rows].sort((a, b) => {
      const rank = winterWaybackRank(b.date) - winterWaybackRank(a.date);
      if (rank) return rank;
      return a.date < b.date ? 1 : a.date > b.date ? -1 : 0;
    });
  }, [waybackDates, waybackRelease]);

  useEffect(() => {
    hydrate();
    const saved = loadTrace();
    if (saved?.facets?.length) {
      setAddress(saved.address);
      setCenter(saved.center);
      setFacets(saved.facets);
      setCorniceStrip(saved.corniceStrip ?? "");
      setCorniceReturn(saved.corniceReturn ?? "");
      setZoom(19);
    } else {
      setAddress(BLUE_QUAIL.address);
      setCenter(BLUE_QUAIL.center);
      setFacets(blueQuailMapTrace());
      setCorniceStrip(BLUE_QUAIL.corniceStripLf);
      setCorniceReturn(BLUE_QUAIL.corniceReturnEa);
      setZoom(19);
      setPinSeq((n) => n + 1);
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
        setWaybackRelease((current) => {
          if (waybackPickedRef.current && rows.some((row) => row.release === current)) {
            return current;
          }
          return pickWinterWayback(rows)?.release ?? rows[0].release;
        });
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
    saveTrace({
      address,
      center,
      facets,
      corniceStrip,
      corniceReturn,
    });
  }, [traceReady, address, center, facets, corniceStrip, corniceReturn]);

  const summary = useMemo(() => summarizeFacets(facets), [facets]);
  const quoteSummary = useMemo(() => {
    if (facets.length) return summary;
    if (evReport) return evReport.summary;
    if (autoQuote) {
      return autoRoofSummary(autoQuote, {
        pitch: classPitch,
        rakeCount: cutUp ? 4 : 2,
        valleyCount: Number(valleyCount) || 0,
      });
    }
    return summary;
  }, [autoQuote, classPitch, cutUp, evReport, facets.length, summary, valleyCount]);
  const estimateReady = Boolean(
    evReport || (facets.length && !summary.incomplete && summary.eaves_ft != null),
  );
  const roofExtras = {
    corniceStripLf: parseRoofQty(corniceStrip),
    corniceReturnEa: parseRoofQty(corniceReturn),
    turtleVents: null,
    turbineVents: null,
    pipeJacks: null,
    solarPanels: null,
    solarHardware: null,
    highRoofSquares: twoStory ? quoteSummary.total_squares : null,
    penetrations,
  };
  const ballpark = roofBallpark(quoteSummary, roofExtras);
  const codeNote = roofCodeNote(zipFromAddress(address));
  const mapEdges = mapLines.length ? mapLines : summary.edges;
  const selected = facets.find((facet) => facet.id === selectedId) ?? null;

  function startLine(kind: string) {
    setTool("line");
    setLineKind(kind);
    setDrawing(true);
    setSelectedId(null);
    setDraft([]);
  }

  function startPlane() {
    setTool("plane");
    setDrawing(true);
    setSelectedId(null);
    setDraft([]);
  }

  function loadBlueQuailEv() {
    setAddress(BLUE_QUAIL.address);
    setCenter(BLUE_QUAIL.center);
    setFacets(blueQuailMapTrace());
    setMapLines([]);
    setDraft([]);
    setDrawing(false);
    setSelectedId("bq-sw");
    setCorniceStrip(BLUE_QUAIL.corniceStripLf);
    setCorniceReturn(BLUE_QUAIL.corniceReturnEa);
    setPinSeq((n) => n + 1);
    setSent(false);
    setAutoQuote(null);
    setLookupError(null);
    setPinHint("EagleView first-pass on 2519 Blue Quail: 5 of 9 planes at 5/12. Nudge a corner if a slope is off.");
  }

  function setLine() {
    if (draft.length < 2) return;
    const [a, b] = draft;
    const plan = geodesicSegmentFt(a, b);
    const length = Math.round(plan * 10) / 10;
    setMapLines((current) => [
      ...current,
      {
        kind: lineKind,
        length_ft: length,
        plan_ft: length,
        rise_ft: 0,
        level: true,
        latlngs: [a, b],
      },
    ]);
    setDraft([]);
    setSent(false);
  }

  function patchFacet(id: string, patch: Partial<RoofFacet>) {
    setFacets((current) => current.map((facet) => (facet.id === id ? { ...facet, ...patch } : facet)));
  }

  async function quoteAt(lat: number, lng: number) {
    try {
      const result = await fetchAutoRoofQuote(lat, lng, classPitch);
      if (result.quote) {
        setAutoQuote(result.quote);
        setPinHint(SEARCH_QUOTE_LINE);
        return;
      }
      setAutoQuote(null);
      setPinHint(result.error ?? "No auto quote. Draw a plane.");
    } catch {
      setAutoQuote(null);
      setPinHint("No auto quote. Draw a plane.");
    }
  }

  async function onSearch(event: React.FormEvent) {
    event.preventDefault();
    setLooking(true);
    setLookupError(null);
    try {
      const result = await geocodeHouseAddress(address);
      if (result.error || !result.hit) {
        setLookupError(result.error ?? "No match. Check the street and city.");
        return;
      }
      setCenter({ lat: result.hit.lat, lng: result.hit.lng });
      setZoom(19);
      setPinSeq((n) => n + 1);
      setFacets([]);
      setMapLines([]);
      setDraft([]);
      setAutoQuote(null);
      setEvReport(null);
      setPinHint("Quoting the roof…");
      await quoteAt(result.hit.lat, result.hit.lng);
    } catch {
      setLookupError("Address lookup failed. Try Search again.");
    } finally {
      setLooking(false);
    }
  }

  function onMapClick(latlng: LatLng) {
    if (tool === "line" && drawing) {
      const snapped = snapRoofLatLng(latlng, roofSnapAnchors(facets, draft));
      setDraft((current) => (current.length >= 2 ? [snapped] : [...current, snapped]));
      return;
    }
    if (drawing) {
      const snapped = snapRoofLatLng(latlng, roofSnapAnchors(facets, draft));
      if (draft.length >= 3 && geodesicSegmentFt(snapped, draft[0]) <= ROOF_VERTEX_SNAP_FT) {
        commitPlane(draft);
        return;
      }
      setDraft((current) => [...current, snapped]);
      return;
    }
    setCenter({ lat: latlng[0], lng: latlng[1] });
    setLookupError(null);
    setPinHint("Quoting the roof…");
    void quoteAt(latlng[0], latlng[1]);
  }

  function commitPlane(ring: LatLng[]) {
    const closed = closeRoofRing(ring);
    if (closed.length < 3) return;
    const latlngs = alignRingToAnchors(closed, roofSnapAnchors(facets));
    const facet: RoofFacet = {
      id: newFacetId(),
      latlngs,
      pitch: selected?.pitch || facets[facets.length - 1]?.pitch || "",
      slopeDeg: null,
    };
    setFacets((current) => [...current, facet]);
    setSelectedId(facet.id);
    setDraft([]);
    setDrawing(false);
    setSent(false);
  }

  function closeDraft() {
    commitPlane(draft);
  }

  function moveVertex(id: string, index: number, latlng: LatLng) {
    setFacets((current) => {
      const anchors = current.flatMap((facet) =>
        facet.latlngs.filter((_, i) => facet.id !== id || i !== index),
      );
      const snapped = snapRoofLatLng(latlng, anchors);
      return current.map((facet) =>
        facet.id === id
          ? { ...facet, latlngs: facet.latlngs.map((pt, i) => (i === index ? snapped : pt)) }
          : facet,
      );
    });
    setSent(false);
  }

  async function onRoofPdf(file: File | undefined) {
    if (!file) return;
    setReadingPdf(true);
    setLookupError(null);
    try {
      const text = await extractPdfText(await file.arrayBuffer());
      const ev = parseEagleViewText(text);
      const xact = parseXactimateRoof(text);
      if (!ev && !xact) {
        setLookupError("That PDF is not an EagleView or a Xactimate roof.");
        return;
      }
      if (ev) {
        setEvReport(ev);
        setAutoQuote(null);
        setFacets([]);
        setMapLines([]);
        setTwoStory(ev.storiesOverOne);
        if (ev.address) setAddress(ev.address);
        setPinHint(
          `EagleView ${ev.summary.total_squares} SQ · ${ev.pitch} · ${ev.wastePct}% waste. Estimate lines are ready.`,
        );
        const query = ev.address || address;
        if (query.trim().length >= 5) {
          const geo = await geocodeHouseAddress(query);
          if (geo.hit) {
            setCenter({ lat: geo.hit.lat, lng: geo.hit.lng });
            setZoom(19);
            setPinSeq((n) => n + 1);
          }
        }
      }
      if (xact) {
        const extras = xactimateRoofPenetrations(xact);
        if (extras.length) setPenetrations((current) => mergeRoofPenetrations(current, extras));
        if (!ev && xact.address) setAddress(xact.address);
        if (!ev) {
          setPinHint(
            xact.solarPanels
              ? `Xactimate extras: ${xact.solarPanels} solar panels. Drop the EagleView for squares and lengths.`
              : "Xactimate extras loaded. Drop the EagleView for squares and lengths.",
          );
        }
      }
    } catch {
      setLookupError("Could not read that PDF.");
    } finally {
      setReadingPdf(false);
      if (pdfInputRef.current) pdfInputRef.current.value = "";
    }
  }

  function sendToEstimator() {
    if (quoteSummary.incomplete) return;
    const quoteOnly = !estimateReady;
    applyRoofTrace(
      address,
      {
        ...quoteSummary,
        squares_with_waste: quoteOnly
          ? salesSquares(quoteSummary.squares_with_waste)
          : quoteSummary.squares_with_waste,
      },
      roofExtras,
    );
    setSent(true);
    void navigate({ to: "/estimator" });
  }

  return (
    <div className="estimator-shell flex min-h-dvh flex-col bg-bg">
      <header className="sticky top-0 z-30 border-b border-border/80 bg-bg/90 pt-[env(safe-area-inset-top)] backdrop-blur-md">
        <div className="mx-auto flex w-full min-w-0 items-center justify-between gap-3 px-3 py-2.5 sm:px-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-ink font-display text-sm font-medium text-ink-foreground">
              {COMPANY.mark}
            </span>
            <div className="min-w-0">
              <p className="truncate font-display text-base font-medium tracking-tight sm:text-lg">
                Roof trace
              </p>
                  <p className="truncate text-xs text-muted">{SEARCH_QUOTE_LINE}</p>
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
                setMapLines([]);
                setSelectedId(null);
                setDrawing(false);
                setTool("line");
                setSent(false);
                setAutoQuote(null);
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
          "flex w-full min-w-0 flex-col",
          mode === "map" ? "" : "hidden",
        )}
      >
        <section className="flex min-w-0 flex-col overflow-hidden bg-card shadow-border">
          <form onSubmit={onSearch} className="shrink-0 border-b border-border px-3 py-2 sm:px-4">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-end">
              <div className="min-w-0 flex-1 space-y-1">
                <Label htmlFor="roof-address">Address</Label>
                <Input
                  id="roof-address"
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  placeholder="2519 Blue Quail St, San Antonio, TX"
                  autoComplete="street-address"
                />
              </div>
              <Button type="submit" disabled={looking} className="min-w-[8.75rem]">
                <Search className="size-4" />
                {looking ? "Quoting…" : "Search"}
              </Button>
              <input
                ref={pdfInputRef}
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(event) => void onRoofPdf(event.target.files?.[0])}
              />
              <Button
                type="button"
                variant="outline"
                className="min-w-[8.75rem]"
                disabled={readingPdf}
                onClick={() => pdfInputRef.current?.click()}
              >
                <FileUp className="size-4" />
                {readingPdf ? "Reading…" : "EagleView PDF"}
              </Button>
              <Button asChild type="button" variant="outline" className="min-w-[8.75rem]">
                <a
                  href={googleEarthNadirUrl(center.lat, center.lng, address)}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Clock className="size-4" />
                  Earth time
                </a>
              </Button>
              <div className="min-w-[12rem] space-y-1 lg:w-56 lg:shrink-0">
                <Label>Imagery</Label>
                <Select
                  value={basemapId}
                  onValueChange={(value) => {
                    const next = value as BasemapId;
                    setBasemapId(next);
                    if (next === "wayback" && !waybackPickedRef.current && waybackDates.length) {
                      const winter = pickWinterWayback(waybackDates);
                      if (winter) setWaybackRelease(winter.release);
                    }
                  }}
                >
                  <SelectTrigger className="h-10" aria-label="Imagery source">
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
                <div className="min-w-[12rem] space-y-1 lg:w-52 lg:shrink-0">
                  <Label>Leaf-off date</Label>
                  <Select
                    value={waybackRelease}
                    onValueChange={(value) => {
                      waybackPickedRef.current = true;
                      setWaybackRelease(value);
                    }}
                  >
                    <SelectTrigger className="h-10" aria-label="Winter aerial date">
                      <SelectValue placeholder="Date" />
                    </SelectTrigger>
                    <SelectContent>
                      {waybackChoices.map((row) => (
                        <SelectItem key={row.release} value={row.release}>
                          {waybackDateLabel(row.date)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
            </div>
            <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
              <a
                className="inline-flex items-center gap-1 underline-offset-2 hover:underline"
                href={googleEarthNadirUrl(center.lat, center.lng, address)}
                target="_blank"
                rel="noreferrer"
              >
                Earth historical <ExternalLink className="size-3" />
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
          {lookupError ? <p className="shrink-0 px-4 py-1 text-xs text-primary">{lookupError}</p> : null}
          {pinHint && !lookupError ? <p className="shrink-0 px-4 py-1 text-xs text-muted">{pinHint}</p> : null}
          <div className="relative h-[calc(100dvh-9.5rem)] min-h-[28rem] w-full">
            {basemapId === "google" ? (
              <RoofGoogle3DMap
                center={center}
                zoom={zoom}
                pinSeq={pinSeq}
                facets={facets}
                draft={draft}
                selectedId={selectedId}
                drawing={drawing}
                edges={mapEdges}
                onReady={(api) => {
                  mapApiRef.current = api;
                }}
                onClick={onMapClick}
                onSelect={(id) => {
                  if (drawing) return;
                  setSelectedId(id);
                }}
                onMoveVertex={moveVertex}
              />
            ) : (
              <RoofMap
                center={center}
                zoom={zoom}
                facets={facets}
                draft={draft}
                selectedId={selectedId}
                drawing={drawing}
                edges={mapEdges}
                basemap={mapBasemap}
                onReady={(api) => {
                  mapApiRef.current = api;
                }}
                onClick={onMapClick}
                onSelect={(id) => {
                  if (drawing) return;
                  setSelectedId(id);
                }}
                onMoveVertex={moveVertex}
              />
            )}
            <EvLinePalette
              className="absolute left-3 top-3 z-[1100]"
              value={tool === "line" && drawing ? lineKind : undefined}
              onChange={startLine}
            />
            <div className="absolute bottom-3 left-3 right-3 z-[1100] flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={loadBlueQuailEv}>
                Blue Quail EV
              </Button>
              <Button
                type="button"
                size="sm"
                variant={tool === "plane" && drawing ? "default" : "outline"}
                onClick={startPlane}
              >
                Draw plane
              </Button>
              <Button
                type="button"
                size="sm"
                variant={tool === "line" && draft.length >= 2 ? "default" : "outline"}
                disabled={tool !== "line" || draft.length < 2}
                onClick={setLine}
              >
                Set line
              </Button>
              <Button type="button" size="sm" variant="outline" disabled={draft.length < 3} onClick={closeDraft}>
                Close plane
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={!draft.length && !mapLines.length}
                onClick={() => {
                  if (draft.length) {
                    setDraft((current) => current.slice(0, -1));
                    return;
                  }
                  setMapLines((current) => current.slice(0, -1));
                }}
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
              {tool === "line" && drawing ? (
                <span className="self-center text-xs text-white drop-shadow">
                  {draft.length >= 2
                    ? `Set line to save this ${EV_LEGEND.find((row) => row.kind === lineKind)?.label ?? "line"}.`
                    : draft.length === 1
                      ? "Tap the other end, then Set line."
                      : `Tap both ends. ${EV_LEGEND.find((row) => row.kind === lineKind)?.label ?? "Eaves"} is on.`}
                </span>
              ) : null}
            </div>
          </div>
        </section>

        <aside className="grid gap-4 px-3 py-4 sm:px-4 lg:grid-cols-2">
          <div className="rounded-xl bg-ink p-5 text-ink-foreground shadow-border">
            <p className="text-[11px] font-medium tracking-[0.18em] text-ink-foreground/60 uppercase">
              This roof
            </p>
            <p className="mt-2 font-display text-4xl font-medium tracking-tight tabular-nums">
              {salesSquares(quoteSummary.squares_with_waste)}
            </p>
            <p className="mt-1 text-sm text-ink-foreground/70">
              {quoteSummary.waste_factor_pct}% waste
              (8% gable / 10% cut-up + 1%/valley; extra at 7/12+)
            </p>
            {ballpark.mid > 0 ? (
              <p className="mt-1 font-mono text-sm tabular-nums text-ink-foreground/85">
                ${ballpark.low.toLocaleString()} – ${ballpark.high.toLocaleString()}
                <span className="text-ink-foreground/55"> ±2.5% of this quote, not of EagleView</span>
              </p>
            ) : null}
            {autoQuote && !facets.length && !evReport ? (
              <p className="mt-1 text-xs text-ink-foreground/55">
                Auto quote. {SEARCH_QUOTE_LINE}
              </p>
            ) : null}
            {evReport ? (
              <p className="mt-1 text-xs text-ink-foreground/55">
                EagleView {evReport.facets} facets · {evReport.rakeCount} rakes · {evReport.valleyCount} valleys
              </p>
            ) : null}
            <p className="mt-3 text-[11px] leading-snug text-ink-foreground/55">{codeNote}</p>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-ink-foreground/55">Plan</dt>
                <dd className="font-mono tabular-nums">{quoteSummary.total_flat_area_sqft.toFixed(0)} sf</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-ink-foreground/55">Sloped</dt>
                <dd className="font-mono tabular-nums">
                  {quoteSummary.total_area_with_pitch_multiplier_sqft.toFixed(0)} sf
                </dd>
              </div>
              {quoteSummary.eaves_ft != null ? (
                <>
                  <div>
                    <dt className="text-[11px] uppercase tracking-wide text-ink-foreground/55">Eave</dt>
                    <dd className="font-mono tabular-nums">{quoteSummary.eaves_ft} ft</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase tracking-wide text-ink-foreground/55">Ridge</dt>
                    <dd className="font-mono tabular-nums">{quoteSummary.ridges_ft} ft</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase tracking-wide text-ink-foreground/55">Rake</dt>
                    <dd className="font-mono tabular-nums">{quoteSummary.rakes_ft} ft</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase tracking-wide text-ink-foreground/55">Hip / valley</dt>
                    <dd className="font-mono tabular-nums">
                      {quoteSummary.hips_ft} / {quoteSummary.valleys_ft} ft
                    </dd>
                  </div>
                  {quoteSummary.steps_ft ? (
                    <div>
                      <dt className="text-[11px] uppercase tracking-wide text-ink-foreground/55">Wall</dt>
                      <dd className="font-mono tabular-nums">{quoteSummary.steps_ft} ft</dd>
                    </div>
                  ) : null}
                </>
              ) : (
                <p className="col-span-2 text-xs text-ink-foreground/60">
                  {autoQuote && !facets.length && !evReport
                    ? "Lengths stay off until you draw. Squares are enough for the sales quote."
                    : "Add a drain direction on each plane. Roof into a wall is headwall, not a ridge."}
                </p>
              )}
            </dl>
            <div className="mt-4">
              <RoofDimFields
                variant="ink"
                corniceStrip={corniceStrip}
                corniceReturn={corniceReturn}
                onCorniceStrip={setCorniceStrip}
                onCorniceReturn={setCorniceReturn}
              />
              <div className="mt-3">
                <RoofPenetrationPicker variant="ink" value={penetrations} onChange={setPenetrations} />
              </div>
              <label className="mt-2 flex items-center gap-2 text-xs text-ink-foreground/80">
                <input
                  type="checkbox"
                  checked={cutUp}
                  onChange={(event) => setCutUp(event.target.checked)}
                />
                Cut-up roof (4+ rakes / 10% waste)
              </label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-ink-foreground/60">Pitch</Label>
                  <Select value={classPitch} onValueChange={setClassPitch}>
                    <SelectTrigger className="h-10 bg-ink-foreground/10 text-ink-foreground shadow-none ring-1 ring-ink-foreground/15">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["4/12", "5/12", "7/12", "9/12", "12/12"].map((pitch) => (
                        <SelectItem key={pitch} value={pitch}>
                          {pitch}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-ink-foreground/60">Valleys</Label>
                  <Select value={valleyCount} onValueChange={setValleyCount}>
                    <SelectTrigger className="h-10 bg-ink-foreground/10 text-ink-foreground shadow-none ring-1 ring-ink-foreground/15">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["0", "2", "4", "6"].map((n) => (
                        <SelectItem key={n} value={n}>
                          {n}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <label className="mt-2 flex items-center gap-2 text-xs text-ink-foreground/80">
                <input
                  type="checkbox"
                  checked={twoStory}
                  onChange={(event) => setTwoStory(event.target.checked)}
                />
                Two stories or higher (high-roof charge)
              </label>
            </div>
            {quoteSummary.incomplete ? (
              <p className="mt-4 text-sm text-primary">{quoteSummary.incomplete}</p>
            ) : null}
            <Button
              type="button"
              className="mt-5 w-full"
              disabled={Boolean(quoteSummary.incomplete)}
              onClick={sendToEstimator}
            >
              <Hammer className="size-4" />
              {estimateReady ? "Send estimate to estimator" : "Send quote to estimator"}
            </Button>
            {sent ? <p className="mt-2 text-xs text-ink-foreground/70">Wrote a Roof room on this job.</p> : null}
          </div>

          <div className="rounded-xl bg-card p-4 shadow-border">
            <p className="text-[11px] font-medium tracking-[0.18em] text-muted uppercase">Planes</p>
            {facets.length === 0 ? (
              <p className="mt-3 text-sm text-muted">{SEARCH_QUOTE_LINE}</p>
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
              {evReport
                ? "EagleView lengths are on the estimate. Draw only if you need to move a plane."
                : SEARCH_QUOTE_LINE}
            </p>
          </div>
        </aside>
      </main>
      ) : null}
    </div>
  );
}
