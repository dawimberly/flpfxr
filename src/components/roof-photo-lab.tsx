import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Camera, Hammer, ImagePlus, Trash2, Undo2 } from "lucide-react";
import { RoofOrbitControls } from "@/components/roof-orbit-controls";
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
import { RoofDimFields } from "@/components/roof-ev-chrome";
import { BLUE_QUAIL, BLUE_QUAIL_LENGTH_SCALE } from "@/lib/blue-quail";
import { useEstimatorStore } from "@/lib/estimator-store";
import { clientToImagePx, coverScale, imageFit, pointerAngle, wrapDeg } from "@/lib/photo-view";
import {
  DEFAULT_WASTE_PCT,
  PITCH_OPTIONS,
  ftPerPxFromScale,
  gableRoofFt,
  measureLengthFt,
  photoEdges,
  summarizePhotoFacets,
  type PhotoFacet,
  type PhotoMeasure,
  type Px,
} from "@/lib/roof-math";
import { EV_EDGE_COLOR, EV_FILL, EV_LEGEND, evLengthLabel, evStrokeDash } from "@/lib/roof-style";
import { cn } from "@/lib/utils";

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

const ROLES = ["front", "right", "back", "left", "plan", "extra"] as const;
type PhotoRole = (typeof ROLES)[number];

const WALK: { role: PhotoRole; prompt: string; hint: string }[] = [
  { role: "front", prompt: "Front of the house", hint: "Street side. Whole face if you can." },
  { role: "right", prompt: "Right elevation", hint: "Walk clockwise." },
  { role: "back", prompt: "Back of the house", hint: "Rear elevation." },
  { role: "left", prompt: "Left elevation", hint: "Last side, then a known length." },
];

const ROLE_LABEL: Record<PhotoRole, string> = {
  front: "Front",
  right: "Right",
  back: "Back",
  left: "Left",
  plan: "Plan / top",
  extra: "Extra",
};

type Shot = {
  id: string;
  name: string;
  url: string;
  role: PhotoRole;
  width: number;
  height: number;
};

function nextWalkStep(shots: Pick<Shot, "role">[]): (typeof WALK)[number] | null {
  for (const step of WALK) {
    if (!shots.some((shot) => shot.role === step.role)) return step;
  }
  return null;
}

type Tool = "scale" | "plane" | "line";
type LineKind = NonNullable<PhotoMeasure["kind"]>;

const SNAP_SCREEN_PX = 10;
const SAME_KIND_SNAP_SCREEN_PX = 4;

function imageSnapRadius(view: HTMLElement, img: HTMLImageElement, screenPx: number): number {
  const { fit } = imageFit(view.clientWidth, view.clientHeight, img.naturalWidth, img.naturalHeight);
  return fit > 0 ? screenPx / fit : screenPx;
}

function nearPx(a: Px, b: Px, tol = 4): boolean {
  return Math.hypot(a[0] - b[0], a[1] - b[1]) < tol;
}

function snapPoint(pt: Px, anchors: { pt: Px; radius: number }[]): Px {
  let best = pt;
  let bestD = Infinity;
  for (const anchor of anchors) {
    const d = Math.hypot(pt[0] - anchor.pt[0], pt[1] - anchor.pt[1]);
    if (d <= anchor.radius && d < bestD) {
      bestD = d;
      best = anchor.pt;
    }
  }
  return best;
}

function lineSnapAnchors(
  measures: PhotoMeasure[],
  facets: PhotoFacet[],
  lineKind: LineKind,
  sameRadius: number,
  otherRadius: number,
  draftA: Px | null,
): { pt: Px; radius: number }[] {
  const blocked = new Set<string>();
  const key = (pt: Px) => `${Math.round(pt[0])},${Math.round(pt[1])}`;
  if (draftA) {
    for (const row of measures) {
      if (row.kind !== lineKind) continue;
      if (nearPx(draftA, row.a)) blocked.add(key(row.b));
      if (nearPx(draftA, row.b)) blocked.add(key(row.a));
    }
  }
  const anchors: { pt: Px; radius: number }[] = [];
  for (const row of measures) {
    const same = row.kind === lineKind;
    const radius = same ? sameRadius : otherRadius;
    for (const end of [row.a, row.b] as Px[]) {
      if (same && blocked.has(key(end))) continue;
      anchors.push({ pt: end, radius });
    }
  }
  for (const facet of facets) {
    for (const pt of facet.points) anchors.push({ pt, radius: otherRadius });
  }
  return anchors;
}

function newId(prefix: string) {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function clientToImage(
  event: { clientX: number; clientY: number },
  view: HTMLElement,
  img: HTMLImageElement,
  deg: number,
): Px | null {
  return clientToImagePx(
    event.clientX,
    event.clientY,
    view.getBoundingClientRect(),
    img.naturalWidth,
    img.naturalHeight,
    deg,
  );
}

export function RoofPhotoLab({ clearTick = 0 }: { clearTick?: number }) {
  const navigate = useNavigate();
  const applyRoofTrace = useEstimatorStore((s) => s.applyRoofTrace);
  const hydrate = useEstimatorStore((s) => s.hydrate);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const viewRef = useRef<HTMLDivElement | null>(null);
  const cameraRef = useRef<HTMLInputElement | null>(null);
  const rollRef = useRef<HTMLInputElement | null>(null);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const rotatingRef = useRef(false);
  const rotateOriginRef = useRef({ angle: 0, deg: 0 });
  const skipClickRef = useRef(false);
  const [shots, setShots] = useState<Shot[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>("line");
  const [lineKind, setLineKind] = useState<LineKind>("eave");
  const [roofPitch, setRoofPitch] = useState(BLUE_QUAIL.ev.pitch);
  const [draft, setDraft] = useState<Px[]>([]);
  const [scaleA, setScaleA] = useState<Px | null>(null);
  const [scaleB, setScaleB] = useState<Px | null>(null);
  const [scaleFeet, setScaleFeet] = useState("");
  const [garageWidth, setGarageWidth] = useState(BLUE_QUAIL.garageWidthFt);
  const [eaveOverhang, setEaveOverhang] = useState(BLUE_QUAIL.eaveOverhangIn);
  const [rakeOverhang, setRakeOverhang] = useState(BLUE_QUAIL.rakeOverhangIn);
  const [facets, setFacets] = useState<PhotoFacet[]>([]);
  const [measures, setMeasures] = useState<PhotoMeasure[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [address, setAddress] = useState(BLUE_QUAIL.address);
  const [frame, setFrame] = useState(0);
  const [photoDeg, setPhotoDeg] = useState<Record<string, number>>({});
  const [sampleReady, setSampleReady] = useState(false);
  const sampleOnce = useRef(false);
  const lastClearTick = useRef(clearTick);
  const loadGen = useRef(0);

  async function addShotUrls(
    items: { name: string; url: string; role?: PhotoRole }[],
    replace = false,
  ) {
    const next: Shot[] = [];
    for (const item of items) {
      const size = await new Promise<{ width: number; height: number }>((resolve, reject) => {
        const probe = new Image();
        probe.onload = () => resolve({ width: probe.naturalWidth, height: probe.naturalHeight });
        probe.onerror = () => reject(new Error(item.name));
        probe.src = item.url;
      });
      const role = (item.role as PhotoRole | undefined) ?? nextWalkStep([...shots, ...next])?.role ?? "extra";
      next.push({
        id: newId("shot"),
        name: item.name,
        url: item.url,
        role,
        width: size.width,
        height: size.height,
      });
    }
    setShots((current) => (replace ? next : [...current, ...next]));
    const preferred = next.find((shot) => shot.role === "plan") ?? next[next.length - 1];
    setActiveId(preferred?.id ?? null);
    return next.length;
  }

  async function loadBlueQuailSample(force = false) {
    const gen = ++loadGen.current;
    const res = await fetch("/blue-quail-local/manifest.json");
    if (!res.ok || gen !== loadGen.current) return false;
    const data = (await res.json()) as {
      address?: string;
      shots: { name: string; url: string; role?: PhotoRole }[];
    };
    if (gen !== loadGen.current) return false;
    await addShotUrls(data.shots, true);
    if (gen !== loadGen.current) return false;
    setAddress(data.address || BLUE_QUAIL.address);
    setGarageWidth(BLUE_QUAIL.garageWidthFt);
    setEaveOverhang(BLUE_QUAIL.eaveOverhangIn);
    setRakeOverhang(BLUE_QUAIL.rakeOverhangIn);
    setRoofPitch(BLUE_QUAIL.ev.pitch);
    setScaleFeet(String(BLUE_QUAIL_LENGTH_SCALE.feet));
    setScaleA(BLUE_QUAIL_LENGTH_SCALE.a);
    setScaleB(BLUE_QUAIL_LENGTH_SCALE.b);
    setFacets([]);
    setSelectedId(null);
    setMeasures([]);
    setDraft([]);
    setTool("line");
    setLineKind("eave");
    setSampleReady(true);
    return true;
  }

  useEffect(() => {
    hydrate();
    return () => {
      for (const shot of shots) URL.revokeObjectURL(shot.url);
    };
    // shots captured at unmount via closure of latest state is unreliable;
    // revoke as files are removed instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrate]);

  useEffect(() => {
    const host = window as Window & {
      __ffRoofSim?: (raw: {
        address?: string;
        scaleFeet?: string;
        scaleA?: Px;
        scaleB?: Px;
        facets?: PhotoFacet[];
        garageWidth?: string;
        eaveOverhang?: string;
        rakeOverhang?: string;
      }) => void;
      __ffRoofAddShots?: (
        items: { name: string; url: string; role?: PhotoRole }[],
      ) => Promise<number>;
    };
    host.__ffRoofSim = (raw) => {
      if (raw.address) setAddress(raw.address);
      if (raw.garageWidth) setGarageWidth(raw.garageWidth);
      if (raw.eaveOverhang) setEaveOverhang(raw.eaveOverhang);
      if (raw.rakeOverhang) setRakeOverhang(raw.rakeOverhang);
      if (raw.scaleFeet) setScaleFeet(raw.scaleFeet);
      if (raw.scaleA) setScaleA(raw.scaleA);
      if (raw.scaleB) setScaleB(raw.scaleB);
      if (raw.facets?.length) {
        setFacets(raw.facets);
        setSelectedId(raw.facets[0].id);
      }
      setShots((current) => {
        const last = current[current.length - 1];
        if (!last || last.role === "plan") return current;
        return current.map((shot, index) => {
          if (index === current.length - 1) return { ...shot, role: "plan" as PhotoRole };
          return shot.role === "plan" ? { ...shot, role: "extra" as PhotoRole } : shot;
        });
      });
      setTool("scale");
    };
    host.__ffRoofAddShots = addShotUrls;
    return () => {
      delete host.__ffRoofSim;
      delete host.__ffRoofAddShots;
    };
  }, []);

  useEffect(() => {
    if (sampleOnce.current) return;
    sampleOnce.current = true;
    void loadBlueQuailSample();
  }, []);

  useLayoutEffect(() => {
    if (clearTick === lastClearTick.current) return;
    lastClearTick.current = clearTick;
    loadGen.current += 1;
    setFacets([]);
    setDraft([]);
    setMeasures([]);
    setSelectedId(null);
    setTool("line");
    setLineKind("eave");
  }, [clearTick]);

  const active = shots.find((shot) => shot.id === activeId) ?? shots[0] ?? null;
  const planShot = shots.find((shot) => shot.role === "plan") ?? null;
  const walkStep = nextWalkStep(shots);
  const gableFt = gableRoofFt(Number(garageWidth), Number(rakeOverhang));
  const typedScale = Number(scaleFeet);
  const scaleLen = typedScale > 0 ? typedScale : gableFt;
  const ftPerPx = scaleA && scaleB ? ftPerPxFromScale(scaleA, scaleB, scaleLen) : null;
  const selected = facets.find((facet) => facet.id === selectedId) ?? null;
  const linePitch = roofPitch;
  const summary = useMemo(
    () => summarizePhotoFacets(facets, ftPerPx, DEFAULT_WASTE_PCT, measures, linePitch),
    [facets, ftPerPx, measures, linePitch],
  );
  const drawingOnPlan = active?.role === "plan";

  async function addFiles(list: FileList | null, forcedRole?: PhotoRole) {
    if (!list?.length) return;
    const incoming = [...list].filter((file) => file.type.startsWith("image/"));
    if (!incoming.length) return;
    const next: Shot[] = [];
    for (const file of incoming) {
      const url = URL.createObjectURL(file);
      const size = await new Promise<{ width: number; height: number }>((resolve) => {
        const probe = new Image();
        probe.onload = () => resolve({ width: probe.naturalWidth, height: probe.naturalHeight });
        probe.src = url;
      });
      const role =
        next.length === 0 && forcedRole
          ? forcedRole
          : (nextWalkStep([...shots, ...next])?.role ?? "extra");
      next.push({
        id: newId("shot"),
        name: file.name.replace(/\.[^.]+$/, "") || ROLE_LABEL[role],
        url,
        role,
        width: size.width,
        height: size.height,
      });
    }
    setShots((current) => [...current, ...next]);
    setActiveId(next[next.length - 1]?.id ?? null);
    if (!scaleA) setTool("scale");
  }

  function onImageClick(event: { clientX: number; clientY: number; button?: number; target: EventTarget | null }) {
    if ((event.button ?? 0) !== 0) return;
    if ((event.target as HTMLElement | null)?.closest("button")) return;
    const img = imgRef.current;
    const view = viewRef.current;
    if (!img || !view || !active) return;
    const deg = photoDeg[active.id] ?? 0;
    const pt = clientToImage(event, view, img, deg);
    if (!pt) return;
    if (!drawingOnPlan) return;
    if (tool === "scale") {
      if (!scaleA || (scaleA && scaleB)) {
        setScaleA(pt);
        setScaleB(null);
        return;
      }
      setScaleB(pt);
      return;
    }
    const otherR = imageSnapRadius(view, img, SNAP_SCREEN_PX);
    const sameR = imageSnapRadius(view, img, SAME_KIND_SNAP_SCREEN_PX);
    if (tool === "line") {
      const firstAnchors = lineSnapAnchors(measures, facets, lineKind, sameR, otherR, null);
      if (draft.length === 0) {
        setDraft([snapPoint(pt, firstAnchors)]);
        return;
      }
      const a = draft[0];
      const b = snapPoint(pt, lineSnapAnchors(measures, facets, lineKind, sameR, otherR, a));
      if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 4) return;
      setDraft([a, b]);
      return;
    }
    const snapped = snapPoint(
      pt,
      lineSnapAnchors(measures, facets, lineKind, otherR, otherR, null),
    );
    if (tool === "plane" && draft.length >= 3 && nearPx(snapped, draft[0], imageSnapRadius(view, img, SNAP_SCREEN_PX))) {
      finishPlane(draft);
      return;
    }
    setDraft((current) => [...current, snapped]);
  }

  function setPhotoHeading(next: number, shotId = active?.id) {
    if (!shotId) return;
    const deg = wrapDeg(next);
    setPhotoDeg((current) => ({ ...current, [shotId]: deg }));
  }

  function stepPhotoHeading(delta: number) {
    if (!active) return;
    const shotId = active.id;
    setPhotoDeg((current) => ({ ...current, [shotId]: wrapDeg((current[shotId] ?? 0) + delta) }));
  }

  function onViewPointerDown(event: React.PointerEvent<HTMLElement>) {
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointersRef.current.size >= 2) {
      rotatingRef.current = true;
      skipClickRef.current = true;
      const [a, b] = [...pointersRef.current.values()];
      rotateOriginRef.current = { angle: pointerAngle(a, b), deg: photoDeg[active?.id ?? ""] ?? 0 };
    }
  }

  function onViewPointerMove(event: React.PointerEvent<HTMLElement>) {
    if (!pointersRef.current.has(event.pointerId)) return;
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (!rotatingRef.current || pointersRef.current.size < 2 || !active) return;
    const [a, b] = [...pointersRef.current.values()];
    setPhotoHeading(rotateOriginRef.current.deg + (pointerAngle(a, b) - rotateOriginRef.current.angle));
  }

  function onViewPointerUp(event: React.PointerEvent<HTMLElement>) {
    pointersRef.current.delete(event.pointerId);
    if (pointersRef.current.size < 2) rotatingRef.current = false;
    if (pointersRef.current.size === 0) {
      if (!skipClickRef.current) onImageClick(event);
      skipClickRef.current = false;
    }
  }

  function setLine() {
    if (draft.length < 2) return;
    const a = draft[0];
    const b = draft[1];
    if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 4) return;
    const label = EV_LEGEND.find((row) => row.kind === lineKind)?.label ?? "Line";
    setMeasures((rows) => [
      ...rows,
      { id: newId("m"), a, b, name: `${label} ${rows.length + 1}`, kind: lineKind },
    ]);
    setDraft([]);
  }

  function finishPlane(points: Px[]) {
    if (points.length < 3) return;
    const facet: PhotoFacet = {
      id: newId("facet"),
      points,
      pitch: selected?.pitch || facets[facets.length - 1]?.pitch || roofPitch,
      slopeDeg: selected?.slopeDeg ?? facets[facets.length - 1]?.slopeDeg ?? null,
    };
    setFacets((current) => [...current, facet]);
    setSelectedId(facet.id);
    setDraft([]);
  }

  function closePlane() {
    if (tool !== "plane") {
      setTool("plane");
      setDraft([]);
      return;
    }
    finishPlane(draft);
  }

  function send() {
    if (summary.incomplete) return;
    applyRoofTrace(address.trim() || "Photo roof", summary);
    void navigate({ to: "/estimator" });
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 lg:flex-row">
      <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl bg-card shadow-border">
        <div className="flex flex-wrap items-end gap-2 border-b border-border px-4 py-3">
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(event) => {
              const role = walkStep?.role ?? (planShot ? "extra" : "plan");
              void addFiles(event.target.files, role);
              event.target.value = "";
            }}
          />
          <input
            ref={rollRef}
            id="photo-files"
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            onChange={(event) => {
              void addFiles(event.target.files);
              event.target.value = "";
            }}
          />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Label htmlFor="photo-job">Job / address</Label>
            <Input
              id="photo-job"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              placeholder="2519 Blue Quail St, San Antonio, TX"
            />
          </div>
          <Button type="button" onClick={() => cameraRef.current?.click()}>
            <Camera className="size-4" />
            {walkStep
              ? `Take ${walkStep.prompt.toLowerCase()}`
              : planShot
                ? "Take another photo"
                : "Take plan / top"}
          </Button>
          <Button type="button" variant="outline" onClick={() => rollRef.current?.click()}>
            <ImagePlus className="size-4" />
            From roll
          </Button>
          <Button type="button" variant="outline" onClick={() => void loadBlueQuailSample(true)}>
            Reload Blue Quail
          </Button>
        </div>
        <div className="flex gap-2 overflow-x-auto border-b border-border px-3 py-2">
          {shots
            .filter((shot) => shot.role === "plan")
            .map((shot) => (
              <button
                key={shot.id}
                type="button"
                onClick={() => setActiveId(shot.id)}
                className={cn(
                  "flex h-16 w-28 shrink-0 flex-col overflow-hidden rounded-md border",
                  shot.id === active?.id ? "border-primary" : "border-border",
                )}
              >
                <img src={shot.url} alt="" className="h-10 w-full bg-white object-contain" />
                <span className="truncate px-1 text-[10px] uppercase tracking-wide text-muted">
                  Draw here
                </span>
              </button>
            ))}
          {WALK.map((step) => {
            const shot = shots.find((item) => item.role === step.role);
            const isNext = walkStep?.role === step.role;
            return (
              <button
                key={step.role}
                type="button"
                onClick={() => (shot ? setActiveId(shot.id) : cameraRef.current?.click())}
                className={cn(
                  "flex h-16 w-24 shrink-0 flex-col overflow-hidden rounded-md border",
                  shot?.id === active?.id
                    ? "border-primary"
                    : isNext
                      ? "border-primary/60"
                      : "border-border",
                )}
              >
                {shot ? (
                  <img src={shot.url} alt="" className="h-10 w-full object-cover" />
                ) : (
                  <span className="grid h-10 place-items-center text-[10px] text-muted">
                    {isNext ? "next" : ""}
                  </span>
                )}
                <span className="truncate px-1 text-[10px] uppercase tracking-wide text-muted">
                  {ROLE_LABEL[step.role]}
                </span>
              </button>
            );
          })}
          {shots
            .filter((shot) => shot.role === "extra")
            .map((shot) => (
              <button
                key={shot.id}
                type="button"
                onClick={() => setActiveId(shot.id)}
                className={cn(
                  "flex h-16 w-24 shrink-0 flex-col overflow-hidden rounded-md border",
                  shot.id === active?.id ? "border-primary" : "border-border",
                )}
              >
                <img src={shot.url} alt="" className="h-10 w-full object-cover" />
                <span className="truncate px-1 text-[10px] uppercase tracking-wide text-muted">
                  {ROLE_LABEL[shot.role]}
                </span>
              </button>
            ))}
        </div>
        {active ? (
          <div className="sticky top-0 z-20 space-y-2 border-b border-border bg-card px-3 py-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {EV_LEGEND.map((row) => {
                const on = tool === "line" && lineKind === row.kind;
                return (
                  <button
                    key={row.kind}
                    type="button"
                    disabled={!drawingOnPlan}
                    onClick={() => {
                      setTool("line");
                      setLineKind(row.kind as LineKind);
                    }}
                    className={cn(
                      "flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-xs",
                      on ? "border-ink bg-wash" : "border-border bg-card",
                      !drawingOnPlan && "opacity-50",
                    )}
                  >
                    <span
                      className="inline-block h-0 w-4"
                      style={{
                        borderTopWidth: 3,
                        borderTopStyle: row.dash ? "dashed" : "solid",
                        borderTopColor: row.color,
                      }}
                    />
                    {row.label}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant={tool === "scale" ? "default" : "outline"}
                disabled={!drawingOnPlan}
                onClick={() => {
                  setTool("scale");
                  setDraft([]);
                }}
              >
                {gableFt ? "Garage gable" : "Label length"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant={tool === "plane" ? "default" : "outline"}
                disabled={!drawingOnPlan}
                onClick={() => {
                  setTool("plane");
                  if (tool !== "plane") setDraft([]);
                }}
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
              <Button
                type="button"
                size="sm"
                variant={tool === "plane" && draft.length >= 3 ? "default" : "outline"}
                disabled={!drawingOnPlan}
                onClick={closePlane}
              >
                Close plane
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={!draft.length && !measures.length}
                onClick={() => {
                  if (draft.length) {
                    setDraft((current) => current.slice(0, -1));
                    return;
                  }
                  setMeasures((current) => current.slice(0, -1));
                }}
              >
                <Undo2 className="size-4" />
                Undo
              </Button>
              {tool === "line" && draft.length >= 2 ? (
                <span className="text-xs text-muted">Set line to save it</span>
              ) : tool === "line" && draft.length === 1 ? (
                <span className="text-xs text-muted">Tap the other end</span>
              ) : draft.length ? (
                <span className="text-xs text-muted">
                  {draft.length} corner{draft.length === 1 ? "" : "s"}
                </span>
              ) : null}
            </div>
          </div>
        ) : null}
        <div
          ref={viewRef}
          className="relative min-h-0 flex-1 touch-none overflow-hidden bg-zinc-200"
          onPointerDown={onViewPointerDown}
          onPointerMove={onViewPointerMove}
          onPointerUp={onViewPointerUp}
          onPointerCancel={onViewPointerUp}
        >
          {active ? (
            <div
              className="absolute inset-0"
              style={{
                transform: `rotate(${photoDeg[active.id] ?? 0}deg) scale(${coverScale(
                  viewRef.current?.clientWidth ?? 400,
                  viewRef.current?.clientHeight ?? 400,
                  photoDeg[active.id] ?? 0,
                )})`,
              }}
            >
              <img
                ref={imgRef}
                src={active.url}
                alt={active.name}
                draggable={false}
                className="h-full w-full cursor-crosshair bg-white object-contain"
                onLoad={() => setFrame((n) => n + 1)}
              />
              <svg className="pointer-events-none absolute inset-0 h-full w-full">
                <PhotoOverlay
                  key={frame}
                  img={imgRef.current}
                  shot={active}
                  plan={drawingOnPlan}
                  scaleA={scaleA}
                  scaleB={scaleB}
                  scaleLabel={ftPerPx && scaleLen ? `${Math.round(scaleLen)}` : ""}
                  draft={draft}
                  draftColor={EV_EDGE_COLOR[lineKind] ?? "#f59e0b"}
                  facets={drawingOnPlan ? facets : []}
                  measures={drawingOnPlan ? measures : []}
                  selectedId={selectedId}
                  ftPerPx={ftPerPx}
                  pitch={linePitch}
                />
              </svg>
            </div>
          ) : (
            <div className="grid h-full place-items-center px-6 text-center">
              <div className="max-w-sm space-y-3 text-ink-foreground/80">
                <p className="text-sm font-medium text-ink-foreground">
                  {walkStep ? walkStep.prompt : "Walk is in."}
                </p>
                <p className="text-sm text-ink-foreground/70">
                  {walkStep
                    ? walkStep.hint
                    : "Add a plan or top if you have one. Label a known length, then draw slopes."}
                </p>
                <p className="text-xs text-ink-foreground/55">
                  Front, right, back, left. Same order as the Xactimate.
                </p>
              </div>
            </div>
          )}
          {active ? (
            <RoofOrbitControls
              className="absolute right-3 top-3 z-10"
              heading={photoDeg[active.id] ?? 0}
              onRotate={stepPhotoHeading}
              onNorth={() => setPhotoHeading(0)}
            />
          ) : null}
        </div>
        <p className="px-4 py-2 text-xs text-muted">
          {drawingOnPlan
            ? tool === "line"
              ? draft.length >= 2
                ? `Both ends are marked. Tap Set line to save this ${lineKind}.`
                : draft.length === 1
                  ? `Tap the other end of this ${lineKind}, then Set line.`
                  : `Pick a color, tap both ends, then Set line. ${EV_LEGEND.find((row) => row.kind === lineKind)?.label ?? "Eaves"} is on.`
              : draft.length >= 3
                ? `${draft.length} corners on this plane. Tap Close plane, or tap the first corner again.`
                : draft.length
                  ? `${draft.length} corner${draft.length === 1 ? "" : "s"} on this plane. Tap the rest, then Close plane.`
                  : "Tap each corner of a slope, then Close plane. Draw plane is on."
            : planShot
              ? "Tap Draw here (the line drawing) to trace. Yard photos are only for pitch and drain."
              : "Walk is in. Add or mark a plan / top to draw squares. Rotate the photo like Maps."}
        </p>
      </section>

      <aside className="w-full space-y-4 lg:w-[22rem] lg:shrink-0">
        {active ? (
          <div className="rounded-xl bg-card p-4 shadow-border">
            <Label>This picture is</Label>
            <Select
              value={active.role}
              onValueChange={(role) =>
                setShots((current) =>
                  current.map((shot) => {
                    if (shot.id !== active.id) {
                      return role === "plan" && shot.role === "plan" ? { ...shot, role: "extra" } : shot;
                    }
                    return { ...shot, role: role as PhotoRole };
                  }),
                )
              }
            >
              <SelectTrigger className="mt-2" aria-label="Photo role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((role) => (
                  <SelectItem key={role} value={role}>
                    {ROLE_LABEL[role]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

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
            {summary.drip_ft != null || summary.steps_ft ? (
              <>
                <div>
                  <dt className="text-[11px] uppercase tracking-wide text-ink-foreground/55">Eave / rake</dt>
                  <dd className="font-mono tabular-nums">
                    {summary.eaves_ft} / {summary.rakes_ft} ft
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wide text-ink-foreground/55">Ridge / hip / valley</dt>
                  <dd className="font-mono tabular-nums">
                    {summary.ridges_ft} / {summary.hips_ft} / {summary.valleys_ft} ft
                  </dd>
                </div>
                {summary.steps_ft ? (
                  <div>
                    <dt className="text-[11px] uppercase tracking-wide text-ink-foreground/55">Wall</dt>
                    <dd className="font-mono tabular-nums">{summary.steps_ft} ft</dd>
                  </div>
                ) : null}
              </>
            ) : (
              <p className="col-span-2 text-xs text-ink-foreground/60">
                Pick a line color and tap both ends. Headwall is roof into a wall, not a ridge.
              </p>
            )}
          </dl>
          <div className="mt-4 space-y-3">
            <RoofDimFields
              variant="ink"
              garageWidth={garageWidth}
              eaveOverhang={eaveOverhang}
              rakeOverhang={rakeOverhang}
              onGarageWidth={setGarageWidth}
              onEaveOverhang={setEaveOverhang}
              onRakeOverhang={setRakeOverhang}
            />
            {gableFt && typedScale <= 0 ? null : (
              <div className="space-y-1.5">
                <Label className="text-ink-foreground/60">Known length (ft)</Label>
                <Input
                  inputMode="decimal"
                  value={scaleFeet}
                  onChange={(event) => setScaleFeet(event.target.value)}
                  className="bg-ink-foreground/10 font-mono tabular-nums text-ink-foreground shadow-none ring-1 ring-ink-foreground/15"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-ink-foreground/60">Pitch</Label>
              <Select value={roofPitch} onValueChange={setRoofPitch}>
                <SelectTrigger
                  className="h-10 bg-ink-foreground/10 font-mono tabular-nums text-ink-foreground shadow-none ring-1 ring-ink-foreground/15"
                  aria-label="Roof pitch"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PITCH_OPTIONS.map((pitch) => (
                    <SelectItem key={pitch} value={pitch}>
                      {pitch}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-ink-foreground/60">
              {ftPerPx
                ? `${(1 / ftPerPx).toFixed(1)} px = 1 ft. Scale is the 41 ft ridge. Rakes, hips, and valleys use ${linePitch} so they match EagleView’s 3D lengths.`
                : gableFt
                  ? "Tap both ends of the garage gable, drip to drip."
                  : "Tap two ends of something you know, then type the feet."}
            </p>
          </div>
          {summary.incomplete ? <p className="mt-3 text-sm text-primary">{summary.incomplete}</p> : null}
          <Button type="button" className="mt-5 w-full" disabled={Boolean(summary.incomplete)} onClick={send}>
            <Hammer className="size-4" />
            Send squares to estimator
          </Button>
        </div>

        {measures.length ? (
          <div className="rounded-xl bg-card p-4 shadow-border">
            <p className="text-[11px] font-medium tracking-[0.18em] text-muted uppercase">Lines</p>
            <ul className="mt-3 space-y-2">
              {measures.map((row) => (
                <li key={row.id} className="flex items-center justify-between gap-2 text-sm">
                  <span
                    className="inline-block h-0 w-4 shrink-0"
                    style={{
                      borderTopWidth: 3,
                      borderTopStyle: evStrokeDash(row.kind ?? "") ? "dashed" : "solid",
                      borderTopColor: (row.kind && EV_EDGE_COLOR[row.kind]) || "#111",
                    }}
                  />
                  <span className="min-w-0 flex-1 truncate">{row.name}</span>
                  <span className="shrink-0 font-mono tabular-nums text-muted">
                    {measureLengthFt(row, ftPerPx, linePitch) ?? "-"} ft
                  </span>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label={`Remove ${row.name}`}
                    onClick={() => setMeasures((current) => current.filter((item) => item.id !== row.id))}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="rounded-xl bg-card p-4 shadow-border">
          <p className="text-[11px] font-medium tracking-[0.18em] text-muted uppercase">Planes / pitch</p>
          {facets.length === 0 ? (
            <p className="mt-3 text-sm text-muted">
              {planShot
                ? "On the plan photo, draw one polygon per slope, then pick 4/12, 6/12, and so on."
                : "Finish the walk, then add a plan / top (or mark one picture as plan) before drawing slopes."}
            </p>
          ) : (
            <ul className="mt-3 space-y-3">
              {facets.map((facet, index) => (
                <li key={facet.id} className={cn("rounded-lg p-3", facet.id === selectedId ? "bg-wash" : "bg-surface")}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between text-left"
                    onClick={() => setSelectedId(facet.id)}
                  >
                    <span className="text-sm font-medium">Plane {index + 1}</span>
                    <span className="font-mono text-xs text-muted">{facet.pitch || "no pitch"}</span>
                  </button>
                  <Select
                    value={facet.pitch || "__none"}
                    onValueChange={(value) =>
                      setFacets((current) =>
                        current.map((item) =>
                          item.id === facet.id ? { ...item, pitch: value === "__none" ? "" : value } : item,
                        ),
                      )
                    }
                  >
                    <SelectTrigger className="mt-2 h-10" aria-label={`Pitch for plane ${index + 1}`}>
                      <SelectValue placeholder="Pitch" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">pick pitch</SelectItem>
                      {PITCH_OPTIONS.map((pitch) => (
                        <SelectItem key={pitch} value={pitch}>
                          {pitch}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={facet.slopeDeg == null ? "__none" : String(facet.slopeDeg)}
                    onValueChange={(value) =>
                      setFacets((current) =>
                        current.map((item) =>
                          item.id === facet.id
                            ? { ...item, slopeDeg: value === "__none" ? null : Number(value) }
                            : item,
                        ),
                      )
                    }
                  >
                    <SelectTrigger className="mt-2 h-10" aria-label={`Drain for plane ${index + 1}`}>
                      <SelectValue placeholder="Drain" />
                    </SelectTrigger>
                    <SelectContent>
                      {DRAINS.map((drain) => (
                        <SelectItem key={drain.label} value={drain.value}>
                          Drain {drain.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mt-2"
                    onClick={() => setFacets((current) => current.filter((item) => item.id !== facet.id))}
                  >
                    <Trash2 className="size-4" />
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-muted">Waste is {DEFAULT_WASTE_PCT}%. Not an EagleView report.</p>
        </div>
      </aside>
    </div>
  );
}

function PhotoOverlay({
  img,
  shot,
  plan,
  scaleA,
  scaleB,
  scaleLabel,
  draft,
  draftColor,
  facets,
  measures,
  selectedId,
  ftPerPx,
  pitch,
}: {
  img: HTMLImageElement | null;
  shot: Shot;
  plan: boolean;
  scaleA: Px | null;
  scaleB: Px | null;
  scaleLabel: string;
  draft: Px[];
  draftColor: string;
  facets: PhotoFacet[];
  measures: PhotoMeasure[];
  selectedId: string | null;
  ftPerPx: number | null;
  pitch: string;
}) {
  if (!img || !img.clientWidth) return null;
  const parent = img.parentElement;
  if (!parent) return null;
  const { fit, ox, oy } = imageFit(parent.clientWidth, parent.clientHeight, shot.width, shot.height);
  const xy = (pt: Px) => [ox + pt[0] * fit, oy + pt[1] * fit] as const;
  const to = (pt: Px) => `${xy(pt)[0]},${xy(pt)[1]}`;
  const edges = plan ? photoEdges(facets, ftPerPx) : [];
  return (
    <g>
      {plan
        ? facets.map((facet) => (
            <polygon
              key={facet.id}
              points={facet.points.map(to).join(" ")}
              fill={EV_FILL}
              fillOpacity={facet.id === selectedId ? 0.42 : 0.28}
              stroke="none"
            />
          ))
        : null}
      {edges.map((edge, index) => {
        const [x1, y1] = xy(edge.a);
        const [x2, y2] = xy(edge.b);
        const color = EV_EDGE_COLOR[edge.kind] ?? EV_EDGE_COLOR.unclassified;
        const label = evLengthLabel(edge.length_ft);
        const dx = x2 - x1;
        const dy = y2 - y1;
        const len = Math.hypot(dx, dy) || 1;
        const lx = (x1 + x2) / 2 - (dy / len) * 10;
        const ly = (y1 + y2) / 2 + (dx / len) * 10;
        return (
          <g key={`${edge.kind}-${index}`}>
            <line
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={color}
              strokeWidth={3.25}
              strokeLinecap="round"
            />
            {label ? (
              <text
                x={lx}
                y={ly}
                fill={color}
                stroke="#fff"
                strokeWidth={3.5}
                paintOrder="stroke"
                fontSize="13"
                fontWeight="700"
                fontFamily="Arial, Helvetica, sans-serif"
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {label}
              </text>
            ) : null}
          </g>
        );
      })}
      {plan && selectedId
        ? facets
            .find((facet) => facet.id === selectedId)
            ?.points.map((pt, index) => {
              const [cx, cy] = xy(pt);
              return (
                <circle key={`v-${index}`} cx={cx} cy={cy} r={5} fill="#fff" stroke="#111" strokeWidth={1.5} />
              );
            })
        : null}
      {draft.length ? (
        <>
          <polyline
            points={draft.map(to).join(" ")}
            fill="none"
            stroke={draftColor}
            strokeWidth={2}
            strokeDasharray="6 4"
          />
          {draft.map((pt, index) => {
            const [cx, cy] = xy(pt);
            return (
              <circle
                key={`draft-${index}`}
                cx={cx}
                cy={cy}
                r={6}
                fill={draftColor}
                stroke="#111"
                strokeWidth={1.5}
              />
            );
          })}
        </>
      ) : null}
      {scaleA && !edges.length ? <circle cx={xy(scaleA)[0]} cy={xy(scaleA)[1]} r={5} fill="#111" stroke="#fff" /> : null}
      {scaleA && scaleB && !edges.length ? (
        <>
          <line
            x1={xy(scaleA)[0]}
            y1={xy(scaleA)[1]}
            x2={xy(scaleB)[0]}
            y2={xy(scaleB)[1]}
            stroke="#fff"
            strokeWidth={6}
          />
          <line
            x1={xy(scaleA)[0]}
            y1={xy(scaleA)[1]}
            x2={xy(scaleB)[0]}
            y2={xy(scaleB)[1]}
            stroke="#111"
            strokeWidth={2.5}
          />
          <circle cx={xy(scaleB)[0]} cy={xy(scaleB)[1]} r={5} fill="#111" stroke="#fff" />
          {scaleLabel ? (
            <text
              x={(xy(scaleA)[0] + xy(scaleB)[0]) / 2}
              y={(xy(scaleA)[1] + xy(scaleB)[1]) / 2 - 10}
              fill="#111"
              stroke="#fff"
              strokeWidth={3.5}
              paintOrder="stroke"
              fontSize="13"
              fontWeight="700"
              fontFamily="Arial, Helvetica, sans-serif"
              textAnchor="middle"
            >
              {scaleLabel}
            </text>
          ) : null}
        </>
      ) : null}
      {measures.map((row) => {
        const color = (row.kind && EV_EDGE_COLOR[row.kind]) || "#111";
        const dash = row.kind ? evStrokeDash(row.kind) : undefined;
        const [x1, y1] = xy(row.a);
        const [x2, y2] = xy(row.b);
        const length = measureLengthFt(row, ftPerPx, pitch);
        const label = length != null ? evLengthLabel(length) : "";
        const dx = x2 - x1;
        const dy = y2 - y1;
        const len = Math.hypot(dx, dy) || 1;
        return (
          <g key={row.id}>
            <line
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={color}
              strokeWidth={3.25}
              strokeLinecap="round"
              strokeDasharray={dash}
            />
            {label ? (
              <text
                x={(x1 + x2) / 2 - (dy / len) * 10}
                y={(y1 + y2) / 2 + (dx / len) * 10}
                fill={color}
                stroke="#fff"
                strokeWidth={3.5}
                paintOrder="stroke"
                fontSize="13"
                fontWeight="700"
                fontFamily="Arial, Helvetica, sans-serif"
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {label}
              </text>
            ) : null}
          </g>
        );
      })}
    </g>
  );
}
