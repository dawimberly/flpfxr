import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Camera, Hammer, ImagePlus, Trash2, Undo2 } from "lucide-react";
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
import { EvLegend, RoofDimFields } from "@/components/roof-ev-chrome";
import { useEstimatorStore } from "@/lib/estimator-store";
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
import { EV_EDGE_COLOR, EV_FILL, evLengthLabel } from "@/lib/roof-style";
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

type Tool = "scale" | "plane" | "measure";

function newId(prefix: string) {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function clientToImage(event: { clientX: number; clientY: number }, img: HTMLImageElement): Px | null {
  const rect = img.getBoundingClientRect();
  if (!img.naturalWidth || !img.naturalHeight || rect.width < 2 || rect.height < 2) return null;
  const fit = Math.min(rect.width / img.naturalWidth, rect.height / img.naturalHeight);
  const drawW = img.naturalWidth * fit;
  const drawH = img.naturalHeight * fit;
  const left = rect.left + (rect.width - drawW) / 2;
  const top = rect.top + (rect.height - drawH) / 2;
  const x = (event.clientX - left) / fit;
  const y = (event.clientY - top) / fit;
  if (x < -2 || y < -2 || x > img.naturalWidth + 2 || y > img.naturalHeight + 2) return null;
  return [
    Math.min(img.naturalWidth, Math.max(0, x)),
    Math.min(img.naturalHeight, Math.max(0, y)),
  ];
}

export function RoofPhotoLab() {
  const navigate = useNavigate();
  const applyRoofTrace = useEstimatorStore((s) => s.applyRoofTrace);
  const hydrate = useEstimatorStore((s) => s.hydrate);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const cameraRef = useRef<HTMLInputElement | null>(null);
  const rollRef = useRef<HTMLInputElement | null>(null);
  const [shots, setShots] = useState<Shot[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>("scale");
  const [draft, setDraft] = useState<Px[]>([]);
  const [scaleA, setScaleA] = useState<Px | null>(null);
  const [scaleB, setScaleB] = useState<Px | null>(null);
  const [scaleFeet, setScaleFeet] = useState("");
  const [garageWidth, setGarageWidth] = useState("");
  const [eaveOverhang, setEaveOverhang] = useState("");
  const [rakeOverhang, setRakeOverhang] = useState("");
  const [facets, setFacets] = useState<PhotoFacet[]>([]);
  const [measures, setMeasures] = useState<PhotoMeasure[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [address, setAddress] = useState("");
  const [frame, setFrame] = useState(0);

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
      }) => void;
      __ffRoofAddShots?: (
        items: { name: string; url: string; role?: PhotoRole }[],
      ) => Promise<number>;
    };
    host.__ffRoofSim = (raw) => {
      if (raw.address) setAddress(raw.address);
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
    host.__ffRoofAddShots = async (items) => {
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
      setShots((current) => [...current, ...next]);
      setActiveId(next[next.length - 1]?.id ?? null);
      return next.length;
    };
    return () => {
      delete host.__ffRoofSim;
      delete host.__ffRoofAddShots;
    };
  }, []);

  const active = shots.find((shot) => shot.id === activeId) ?? shots[0] ?? null;
  const planShot = shots.find((shot) => shot.role === "plan") ?? null;
  const walkStep = nextWalkStep(shots);
  const gableFt = gableRoofFt(Number(garageWidth), Number(rakeOverhang));
  const scaleLen = gableFt || Number(scaleFeet);
  const ftPerPx = scaleA && scaleB ? ftPerPxFromScale(scaleA, scaleB, scaleLen) : null;
  const summary = useMemo(() => summarizePhotoFacets(facets, ftPerPx), [facets, ftPerPx]);
  const selected = facets.find((facet) => facet.id === selectedId) ?? null;
  const drawingOnPlan = Boolean(active && planShot && active.id === planShot.id);

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

  function onImageClick(event: React.PointerEvent<HTMLImageElement>) {
    if (event.button !== 0) return;
    const img = imgRef.current;
    if (!img || !active) return;
    const pt = clientToImage(event, img);
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
    if (tool === "measure") {
      setDraft((current) => {
        if (current.length === 0) return [pt];
        const a = current[0];
        setMeasures((rows) => [
          ...rows,
          { id: newId("m"), a, b: pt, name: `Line ${rows.length + 1}` },
        ]);
        return [];
      });
      return;
    }
    setDraft((current) => [...current, pt]);
  }

  function closePlane() {
    if (draft.length < 3) return;
    const facet: PhotoFacet = {
      id: newId("facet"),
      points: draft,
      pitch: selected?.pitch || facets[facets.length - 1]?.pitch || "",
      slopeDeg: selected?.slopeDeg ?? facets[facets.length - 1]?.slopeDeg ?? null,
    };
    setFacets((current) => [...current, facet]);
    setSelectedId(facet.id);
    setDraft([]);
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
              placeholder="Optional"
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
        </div>
        <div className="flex gap-2 overflow-x-auto border-b border-border px-3 py-2">
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
            .filter((shot) => shot.role === "plan" || shot.role === "extra")
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
        <div className="relative min-h-[22rem] flex-1 bg-ink">
          {active ? (
            <img
              ref={imgRef}
              src={active.url}
              alt={active.name}
              className="h-full w-full cursor-crosshair object-contain"
              onLoad={() => setFrame((n) => n + 1)}
              onPointerUp={onImageClick}
            />
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
            <>
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
                  facets={drawingOnPlan ? facets : []}
                  measures={drawingOnPlan ? measures : []}
                  selectedId={selectedId}
                  ftPerPx={ftPerPx}
                />
              </svg>
              {drawingOnPlan ? <EvLegend className="absolute left-3 top-3" /> : null}
            </>
          ) : null}
          <div className="absolute bottom-3 left-3 right-3 flex flex-wrap gap-2">
      <Button
              type="button"
              size="sm"
              variant={tool === "scale" ? "default" : "outline"}
              disabled={!drawingOnPlan}
              onClick={() => setTool("scale")}
            >
              {gableFt ? "Garage gable" : "Label length"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={tool === "plane" ? "default" : "outline"}
              disabled={!drawingOnPlan}
              onClick={() => setTool("plane")}
            >
              Draw plane
            </Button>
            <Button
              type="button"
              size="sm"
              variant={tool === "measure" ? "default" : "outline"}
              disabled={!drawingOnPlan || !ftPerPx}
              onClick={() => setTool("measure")}
            >
              Measure
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={draft.length < 3} onClick={closePlane}>
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
              Undo
            </Button>
          </div>
        </div>
        <p className="px-4 py-2 text-xs text-muted">
          {walkStep
            ? `Next: ${walkStep.prompt}. Phone photos from the yard. No tile downloads.`
            : planShot
              ? "Enter garage width and overhangs, tap the garage gable drip to drip, draw each slope, pick pitch and drain."
              : "Walk is in. Add or mark a plan / top to draw squares. Elevations keep the job."}
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
            {summary.drip_ft != null ? (
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
              </>
            ) : (
              <p className="col-span-2 text-xs text-ink-foreground/60">
                Add a drain on each plane to name ridge, eave, rake, hip, and valley.
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
            {gableFt ? null : (
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
            <p className="text-xs text-ink-foreground/60">
              {ftPerPx
                ? `${(1 / ftPerPx).toFixed(1)} px = 1 ft`
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
            <p className="text-[11px] font-medium tracking-[0.18em] text-muted uppercase">Labeled lengths</p>
            <ul className="mt-3 space-y-2">
              {measures.map((row) => (
                <li key={row.id} className="flex items-center justify-between gap-2 text-sm">
                  <Input
                    value={row.name}
                    onChange={(event) =>
                      setMeasures((current) =>
                        current.map((item) => (item.id === row.id ? { ...item, name: event.target.value } : item)),
                      )
                    }
                  />
                  <span className="shrink-0 font-mono tabular-nums text-muted">
                    {measureLengthFt(row, ftPerPx) ?? "-"} ft
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
  facets,
  measures,
  selectedId,
  ftPerPx,
}: {
  img: HTMLImageElement | null;
  shot: Shot;
  plan: boolean;
  scaleA: Px | null;
  scaleB: Px | null;
  scaleLabel: string;
  draft: Px[];
  facets: PhotoFacet[];
  measures: PhotoMeasure[];
  selectedId: string | null;
  ftPerPx: number | null;
}) {
  if (!img || !img.clientWidth) return null;
  const rect = img.getBoundingClientRect();
  const parent = img.parentElement?.getBoundingClientRect();
  if (!parent) return null;
  const fit = Math.min(rect.width / shot.width, rect.height / shot.height);
  const drawW = shot.width * fit;
  const drawH = shot.height * fit;
  const ox = rect.left - parent.left + (rect.width - drawW) / 2;
  const oy = rect.top - parent.top + (rect.height - drawH) / 2;
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
        <polyline
          points={draft.map(to).join(" ")}
          fill="none"
          stroke="#111"
          strokeWidth={2}
          strokeDasharray="6 4"
        />
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
      {measures.map((row) => (
        <g key={row.id}>
          <line
            x1={xy(row.a)[0]}
            y1={xy(row.a)[1]}
            x2={xy(row.b)[0]}
            y2={xy(row.b)[1]}
            stroke="#111"
            strokeWidth={2}
          />
          <text
            x={(xy(row.a)[0] + xy(row.b)[0]) / 2}
            y={(xy(row.a)[1] + xy(row.b)[1]) / 2 - 8}
            fill="#111"
            stroke="#fff"
            strokeWidth={3}
            paintOrder="stroke"
            fontSize="12"
            fontWeight="700"
            fontFamily="Arial, Helvetica, sans-serif"
            textAnchor="middle"
          >
            {row.name}
            {ftPerPx ? ` ${measureLengthFt(row, ftPerPx)}` : ""}
          </text>
        </g>
      ))}
    </g>
  );
}
