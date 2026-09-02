import { useEffect, useMemo, useState } from "react";
import {
  AppWindow,
  Copy,
  DoorOpen,
  FileDown,
  FileText,
  Hammer,
  House,
  Minus,
  Plus,
  RotateCcw,
  Square,
  Trash2,
} from "lucide-react";
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
import { Separator } from "@/components/ui/separator";
import {
  COMPANY,
  PRICE_AS_OF,
  catalog,
  categoryDisplayName,
  canInferQuantity,
  estimateJob,
  inferredQuantity,
  lookupOption,
  parseScan,
  roomTypes,
  visibleCategoriesFor,
  type JobEstimate,
  type JobRoom,
  type Opening,
} from "@/lib/estimator";
import { downloadEstimatePdf, type EstimatePdfKind } from "@/lib/estimate-pdf";
import { useActiveRoom, useEstimatorStore } from "@/lib/estimator-store";
import { CabinetPicker } from "@/components/cabinet-picker";
import { EstimateLogButton, SaveEstimateButton } from "@/components/estimate-log";
import { isCabinetCategory } from "@/lib/cabinets";
import { cn, money, qtyLabel } from "@/lib/utils";

function Section({
  kicker,
  title,
  children,
}: {
  kicker: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="min-w-0 max-w-full rounded-xl bg-card p-4 shadow-border sm:p-6">
      <p className="text-[11px] font-medium tracking-[0.18em] text-muted uppercase">{kicker}</p>
      <h2 className="mt-1 font-display text-xl font-medium tracking-tight text-fg sm:text-2xl">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function NumberField({
  label,
  value,
  onChange,
  step = 0.5,
  min = 0,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  suffix?: string;
}) {
  return (
    <div className="min-w-0 space-y-1.5">
      <Label>{label}</Label>
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-md bg-card text-fg shadow-border transition-transform duration-150 ease-out active:scale-[0.96]"
          onClick={() => onChange(Math.max(min, roundStep(value - step)))}
          aria-label={`Decrease ${label}`}
        >
          <Minus className="size-4" />
        </button>
        <Input
          inputMode="decimal"
          value={Number.isFinite(value) ? String(value) : ""}
          onChange={(event) => onChange(Number(event.target.value))}
          className="min-w-0 text-center font-mono tabular-nums"
          aria-label={label}
        />
        <button
          type="button"
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-md bg-card text-fg shadow-border transition-transform duration-150 ease-out active:scale-[0.96]"
          onClick={() => onChange(roundStep(value + step))}
          aria-label={`Increase ${label}`}
        >
          <Plus className="size-4" />
        </button>
      </div>
      {suffix ? <p className="text-xs text-muted">{suffix}</p> : null}
    </div>
  );
}

function roundStep(value: number) {
  return Math.round(value * 100) / 100;
}

function Floorplate({ lengthFt, widthFt }: { lengthFt: number; widthFt: number }) {
  const max = Math.max(lengthFt, widthFt, 1);
  const w = (lengthFt / max) * 160;
  const h = (widthFt / max) * 160;
  return (
    <div className="flex flex-col items-center justify-center rounded-lg bg-wash px-3 py-4">
      <svg viewBox="0 0 200 200" className="size-36" aria-hidden="true">
        <rect
          x={(200 - w) / 2}
          y={(200 - h) / 2}
          width={w}
          height={h}
          fill="color-mix(in oklab, var(--color-ink) 8%, white)"
          stroke="var(--color-ink)"
          strokeWidth="1.5"
        />
      </svg>
      <p className="font-mono text-xs tabular-nums text-muted">
        {lengthFt}' × {widthFt}'
      </p>
    </div>
  );
}

function OpeningList({
  kind,
  items,
}: {
  kind: "doors" | "windows";
  items: Opening[];
}) {
  const add = useEstimatorStore((s) => s.addOpening);
  const remove = useEstimatorStore((s) => s.removeOpening);
  const setOpening = useEstimatorStore((s) => s.setOpening);
  const Icon = kind === "doors" ? DoorOpen : AppWindow;
  const label = kind === "doors" ? "Doors" : "Windows";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-medium text-fg">
          <Icon className="size-4 text-muted" />
          {label}
        </p>
        <Button type="button" variant="ghost" size="sm" onClick={() => add(kind)}>
          <Plus className="size-4" />
          Add
        </Button>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted">None counted against wall area.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item, index) => (
            <li key={item.id} className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-2">
              <Input
                inputMode="decimal"
                aria-label={`${label} ${index + 1} width`}
                value={item.widthFt}
                onChange={(event) =>
                  setOpening(kind, item.id, { widthFt: Number(event.target.value) })
                }
                className="font-mono tabular-nums"
              />
              <Input
                inputMode="decimal"
                aria-label={`${label} ${index + 1} height`}
                value={item.heightFt}
                onChange={(event) =>
                  setOpening(kind, item.id, { heightFt: Number(event.target.value) })
                }
                className="font-mono tabular-nums"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remove ${label} ${index + 1}`}
                onClick={() => remove(kind, item.id)}
              >
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted">Width × height, feet. Openings come off wall area.</p>
    </div>
  );
}

function FinishCard({ category, room }: { category: string; room: JobRoom }) {
  const setSelection = useEstimatorStore((s) => s.setSelection);
  const clearSelection = useEstimatorStore((s) => s.clearSelection);
  const selection = room.selections[category];
  const block = catalog[category];
  const scan = parseScan(room);
  const chosen = selection?.name ? lookupOption(category, selection.name) : null;
  const infer = chosen ? canInferQuantity(category, chosen.unit) : false;
  const autoQty = chosen ? inferredQuantity(scan, category, chosen.unit) : null;
  const qty = selection?.quantity ?? autoQty;

  if (!block) return null;

  return (
    <div className="min-w-0 rounded-lg bg-surface p-3 sm:p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-fg">{block.display_name}</p>
          {chosen ? (
            <p className="text-xs text-muted">
              {money(chosen.cost_per_unit)} / {chosen.unit}
            </p>
          ) : (
            <p className="text-xs text-muted">Leave blank to skip</p>
          )}
        </div>
        {selection?.name ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => clearSelection(category)}>
            Clear
          </Button>
        ) : null}
      </div>
      <Select
        value={selection?.name || "none"}
        onValueChange={(value) => {
          if (value === "none") {
            clearSelection(category);
            return;
          }
          const option = lookupOption(category, value);
          const needsQty = option ? !canInferQuantity(category, option.unit) : true;
          setSelection(category, {
            name: value,
            quantity: needsQty ? (selection?.quantity ?? 1) : null,
          });
        }}
      >
        <SelectTrigger aria-label={block.display_name}>
          <SelectValue placeholder="Choose a finish" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Not in this estimate</SelectItem>
          {block.options.map((option) => (
            <SelectItem key={option.name} value={option.name}>
              {option.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {chosen ? (
        <div className="mt-3">
          {infer && autoQty != null && selection?.quantity == null ? (
            <p className="rounded-md bg-wash px-3 py-2 text-sm text-fg">
              From the room · <span className="font-mono tabular-nums">{qtyLabel(autoQty, chosen.unit)}</span>
            </p>
          ) : (
            <NumberField
              label="Quantity"
              value={qty ?? 0}
              step={chosen.unit === "each" ? 1 : 1}
              onChange={(value) => setSelection(category, { quantity: value })}
              suffix={chosen.unit}
            />
          )}
        </div>
      ) : null}
    </div>
  );
}

function RoomStrip({ job }: { job: JobEstimate }) {
  const rooms = useEstimatorStore((s) => s.rooms);
  const activeRoomId = useEstimatorStore((s) => s.activeRoomId);
  const selectRoom = useEstimatorStore((s) => s.selectRoom);
  const addRoom = useEstimatorStore((s) => s.addRoom);
  const duplicateRoom = useEstimatorStore((s) => s.duplicateRoom);
  const removeRoom = useEstimatorStore((s) => s.removeRoom);
  const renameRoom = useEstimatorStore((s) => s.renameRoom);
  const [addKey, setAddKey] = useState(0);
  const totals = new Map(job.rooms.map((entry) => [entry.room.id, entry.estimate.grandTotal]));

  return (
    <div className="space-y-3">
      <div className="flex min-w-0 gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
        {rooms.map((room) => {
          const active = room.id === activeRoomId;
          return (
            <button
              key={room.id}
              type="button"
              onClick={() => selectRoom(room.id)}
              className={cn(
                "flex h-14 min-w-[8.25rem] flex-1 shrink-0 flex-col items-start justify-center rounded-lg px-3 text-left transition-[background-color,color,box-shadow] duration-150 sm:min-w-[9.5rem] sm:flex-none",
                active ? "bg-ink text-ink-foreground" : "bg-surface text-fg shadow-border hover:bg-paper-alt",
              )}
            >
              <span className="max-w-[10rem] truncate text-sm font-medium">{room.label}</span>
              <span className={cn("font-mono text-xs tabular-nums", active ? "text-ink-foreground/70" : "text-muted")}>
                {money(totals.get(room.id) ?? 0)}
              </span>
            </button>
          );
        })}
      </div>
      <div className="flex min-w-0 flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1 basis-full space-y-1.5 sm:min-w-[10rem] sm:basis-auto">
          <Label htmlFor="room-name">Room name</Label>
          <Input
            id="room-name"
            value={rooms.find((room) => room.id === activeRoomId)?.label ?? ""}
            onChange={(event) => renameRoom(activeRoomId, event.target.value)}
          />
        </div>
        <Select
          key={addKey}
          onValueChange={(value) => {
            addRoom(value);
            setAddKey((key) => key + 1);
          }}
        >
          <SelectTrigger className="w-full sm:w-[11.5rem]" aria-label="Add a room">
            <SelectValue placeholder="Add a room" />
          </SelectTrigger>
          <SelectContent>
            {roomTypes.map((item) => (
              <SelectItem key={item.room_id} value={item.room_id}>
                {item.display_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
          <Button type="button" variant="outline" onClick={() => duplicateRoom(activeRoomId)}>
            <Copy className="size-4" />
            Duplicate
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={rooms.length <= 1}
            onClick={() => removeRoom(activeRoomId)}
          >
            <Trash2 className="size-4" />
            Remove
          </Button>
        </div>
      </div>
    </div>
  );
}

function DownloadPdfButtons({
  job,
  compact = false,
}: {
  job: JobEstimate;
  compact?: boolean;
}) {
  const client = useEstimatorStore((s) => s.client);
  const [busy, setBusy] = useState<EstimatePdfKind | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onDownload(kind: EstimatePdfKind) {
    setBusy(kind);
    setError(null);
    try {
      await downloadEstimatePdf(job, client, kind);
    } catch {
      setError("Could not build the PDF. Try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-1.5">
      <div className={cn("flex gap-2", compact ? "min-w-0 shrink-0" : "flex-col")}>
        <Button
          type="button"
          onClick={() => onDownload("contractor")}
          disabled={busy != null}
          size={compact ? "icon" : "default"}
          aria-label="Contractor PDF"
          className={compact ? undefined : "w-full"}
        >
          <FileDown className="size-4" />
          {compact ? null : busy === "contractor" ? "Building…" : "Contractor PDF"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => onDownload("customer")}
          disabled={busy != null}
          size={compact ? "icon" : "default"}
          aria-label="Customer copy"
          className={
            compact
              ? undefined
              : "w-full border-ink-foreground/20 bg-ink-foreground/10 text-ink-foreground hover:bg-ink-foreground/15"
          }
        >
          <FileText className="size-4" />
          {compact ? null : busy === "customer" ? "Building PDF…" : "Customer copy"}
        </Button>
      </div>
      {error ? <p className="text-xs text-primary">{error}</p> : null}
    </div>
  );
}

function EstimateRail({ job, activeRoomId }: { job: JobEstimate; activeRoomId: string }) {
  const laborRate = useEstimatorStore((s) => s.laborRate);
  const setOpPercent = useEstimatorStore((s) => s.setOpPercent);
  const selectRoom = useEstimatorStore((s) => s.selectRoom);
  const [listMode, setListMode] = useState<"room" | "complete">("complete");
  const active = job.rooms.find((entry) => entry.room.id === activeRoomId) ?? job.rooms[0];
  const shownItems =
    listMode === "complete"
      ? job.completeLineItems
      : (active?.estimate.lineItems ?? []).map((line) => ({
          ...line,
          roomId: active?.room.id ?? "",
          roomLabel: active?.room.label ?? "",
        }));

  return (
    <aside className="min-w-0 max-w-full lg:sticky lg:top-24">
      <div className="rounded-xl bg-ink p-5 text-ink-foreground shadow-border sm:p-6">
        <p className="text-[11px] font-medium tracking-[0.18em] text-ink-foreground/60 uppercase">
          The job
        </p>
        <p className="mt-2 break-all font-display text-4xl font-medium tracking-tight tabular-nums sm:text-5xl">
          {money(job.grandTotal)}
        </p>
        <p className="mt-2 text-sm text-ink-foreground/70">
          {job.rooms.length} {job.rooms.length === 1 ? "room" : "rooms"} · {active?.room.label}{" "}
          {money(active?.estimate.grandTotal ?? 0)}
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-md bg-ink-foreground/10 px-3 py-3">
            <p className="text-[11px] tracking-wide text-ink-foreground/55 uppercase">Installed</p>
            <p className="mt-1 font-mono text-sm tabular-nums">{money(job.materialsSubtotal)}</p>
          </div>
          <div className="rounded-md bg-ink-foreground/10 px-3 py-3">
            <p className="text-[11px] tracking-wide text-ink-foreground/55 uppercase">O&P {laborRate}%</p>
            <p className="mt-1 font-mono text-sm tabular-nums">{money(job.laborSubtotal)}</p>
          </div>
        </div>
        <ul className="mt-5 divide-y divide-ink-foreground/10">
          {job.rooms.map((entry) => {
            const on = entry.room.id === activeRoomId;
            return (
              <li key={entry.room.id}>
                <button
                  type="button"
                  onClick={() => selectRoom(entry.room.id)}
                  className="flex w-full items-center justify-between gap-3 py-2.5 text-left"
                >
                  <span className={cn("truncate text-sm", on ? "text-ink-foreground" : "text-ink-foreground/70")}>
                    {entry.room.label}
                  </span>
                  <span className="shrink-0 font-mono text-sm tabular-nums">{money(entry.estimate.grandTotal)}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <Separator className="my-5 bg-ink-foreground/12" />
        <div className="space-y-1.5">
          <Label htmlFor="labor-rate" className="text-ink-foreground/60">
            Overhead & profit %
          </Label>
          <Input
            id="labor-rate"
            inputMode="decimal"
            value={laborRate}
            onChange={(event) => setOpPercent(Number(event.target.value))}
            className="bg-ink-foreground/10 font-mono tabular-nums text-ink-foreground shadow-none ring-1 ring-ink-foreground/15"
          />
        </div>
        <div className="mt-5 flex flex-col gap-3">
          <SaveEstimateButton />
          <DownloadPdfButtons job={job} />
        </div>
      </div>
      <div className="mt-4 min-w-0 rounded-xl bg-card p-4 shadow-border sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] font-medium tracking-[0.18em] text-muted uppercase">Line items</p>
          <div className="flex w-fit max-w-full rounded-full bg-surface p-1">
            <button
              type="button"
              onClick={() => setListMode("room")}
              className={cn(
                "h-8 rounded-full px-3 text-xs transition-colors duration-150",
                listMode === "room" ? "bg-ink text-ink-foreground" : "text-muted",
              )}
            >
              This room
            </button>
            <button
              type="button"
              onClick={() => setListMode("complete")}
              className={cn(
                "h-8 rounded-full px-3 text-xs transition-colors duration-150",
                listMode === "complete" ? "bg-ink text-ink-foreground" : "text-muted",
              )}
            >
              Complete list
            </button>
          </div>
        </div>
        {shownItems.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Choose finishes. The number writes itself.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {shownItems.map((line, index) => (
              <li key={`${line.roomId}-${line.description}-${index}`} className="flex items-start justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm text-fg">{line.description}</p>
                  <p className="font-mono text-xs tabular-nums text-muted">
                    {listMode === "complete" ? `${line.roomLabel} · ` : ""}
                    {qtyLabel(line.quantity, line.unit)} · {money(line.unitCost)}
                  </p>
                </div>
                <p className="shrink-0 font-mono text-sm tabular-nums text-fg">{money(line.lineTotal)}</p>
              </li>
            ))}
          </ul>
        )}
        {job.warnings.length > 0 ? (
          <ul className="mt-3 space-y-1">
            {job.warnings.map((warning) => (
              <li key={warning} className="text-xs text-primary">
                {warning}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </aside>
  );
}

export function EstimatorApp() {
  const rooms = useEstimatorStore((s) => s.rooms);
  const activeRoomId = useEstimatorStore((s) => s.activeRoomId);
  const setRoomType = useEstimatorStore((s) => s.setRoomType);
  const setDimension = useEstimatorStore((s) => s.setDimension);
  const addCategory = useEstimatorStore((s) => s.addCategory);
  const loadSample = useEstimatorStore((s) => s.loadSample);
  const startOver = useEstimatorStore((s) => s.startOver);
  const client = useEstimatorStore((s) => s.client);
  const setClient = useEstimatorStore((s) => s.setClient);
  const laborRate = useEstimatorStore((s) => s.laborRate);
  const room = useActiveRoom();
  const job = useMemo(() => estimateJob(rooms, laborRate), [rooms, laborRate]);

  useEffect(() => {
    useEstimatorStore.getState().hydrate();
  }, []);

  if (!room) return null;

  const scan = parseScan(room);
  const visibleCategories = visibleCategoriesFor(room);
  const showCabinets = visibleCategories.some(isCabinetCategory) || (room.cabinets?.length ?? 0) > 0;
  const unusedCategories = Object.keys(catalog).filter(
    (id) => !visibleCategories.includes(id) && !(showCabinets && isCabinetCategory(id)),
  );

  return (
    <>
      <div className="app-shell min-h-dvh w-full max-w-full overflow-x-clip pb-[calc(6.5rem+env(safe-area-inset-bottom))] lg:pb-10">
        <header className="sticky top-0 z-30 border-b border-border/80 bg-bg/90 pt-[env(safe-area-inset-top)] backdrop-blur-md">
          <div className="mx-auto flex w-full min-w-0 max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-ink font-display text-sm font-medium text-ink-foreground">
                {COMPANY.mark}
              </span>
              <div className="min-w-0">
                <p className="truncate font-display text-base font-medium tracking-tight sm:text-lg">{COMPANY.name}</p>
                <p className="truncate text-xs text-muted">{COMPANY.tagline}</p>
              </div>
            </div>
            <div className="hidden items-center gap-2 sm:flex">
              <EstimateLogButton />
              <SaveEstimateButton tone="light" />
              <Button type="button" variant="ghost" size="sm" onClick={loadSample}>
                <House className="size-4" />
                Sample house
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={startOver}>
                <RotateCcw className="size-4" />
                Start over
              </Button>
            </div>
            <div className="flex shrink-0 items-center gap-1 sm:hidden">
              <EstimateLogButton icon />
              <SaveEstimateButton tone="light" icon />
            </div>
          </div>
        </header>

        <main className="mx-auto grid w-full min-w-0 max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,24rem)] lg:items-start">
          <div className="min-w-0 max-w-full space-y-5">
            <section className="min-w-0 max-w-full rounded-xl bg-card px-5 py-6 shadow-border sm:px-8 sm:py-8">
              <p className="text-[11px] font-medium tracking-[0.18em] text-muted uppercase">
                {COMPANY.region} · {PRICE_AS_OF}
              </p>
              <h1 className="mt-2 max-w-xl font-display text-3xl font-medium tracking-tight text-pretty sm:text-4xl">
                One house. Every room. One number.
              </h1>
              <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted sm:text-base">
                Add the rooms. Price each one off current San Antonio installed costs. Walk out with a
                number you can stand behind.
              </p>
              <div className="mt-5 flex flex-wrap gap-2 sm:hidden">
                <Button type="button" variant="outline" size="sm" onClick={loadSample}>
                  Sample house
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={startOver}>
                  Start over
                </Button>
              </div>
            </section>

            <Section kicker="The rooms" title="What are we walking into?">
              <RoomStrip job={job} />
              <div className="mt-6">
                <div className="sm:hidden">
                  <Label htmlFor="room-type">Room type</Label>
                  <div className="mt-2">
                    <Select value={room.roomTypeId} onValueChange={setRoomType}>
                      <SelectTrigger id="room-type" aria-label="Room type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {roomTypes.map((item) => (
                          <SelectItem key={item.room_id} value={item.room_id}>
                            {item.display_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="hidden flex-wrap gap-2 sm:flex">
                  {roomTypes.map((item) => (
                    <button
                      key={item.room_id}
                      type="button"
                      onClick={() => setRoomType(item.room_id)}
                      className={cn(
                        "h-11 rounded-full px-4 text-sm transition-[background-color,color,box-shadow] duration-150",
                        room.roomTypeId === item.room_id
                          ? "bg-ink text-ink-foreground"
                          : "bg-surface text-fg shadow-border hover:bg-paper-alt",
                      )}
                    >
                      {item.display_name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-6 grid gap-4 sm:grid-cols-[1fr_auto]">
                <div className="grid gap-4 sm:grid-cols-3">
                  <NumberField
                    label="Length"
                    suffix="feet"
                    value={room.lengthFt}
                    onChange={(value) => setDimension("lengthFt", value)}
                  />
                  <NumberField
                    label="Width"
                    suffix="feet"
                    value={room.widthFt}
                    onChange={(value) => setDimension("widthFt", value)}
                  />
                  <NumberField
                    label="Height"
                    suffix="feet"
                    value={room.heightFt}
                    onChange={(value) => setDimension("heightFt", value)}
                  />
                </div>
                <Floorplate lengthFt={room.lengthFt} widthFt={room.widthFt} />
              </div>
              <div className="mt-5 grid gap-4 rounded-lg bg-wash px-3 py-3 sm:grid-cols-3">
                <Stat icon={Square} label="Floor" value={qtyLabel(scan.floorArea, "sq ft")} />
                <Stat icon={Hammer} label="Walls" value={qtyLabel(scan.wallArea, "sq ft")} />
                <Stat icon={DoorOpen} label="Perimeter" value={qtyLabel(scan.perimeter, "lf")} />
              </div>
              <div className="mt-6 grid gap-6 sm:grid-cols-2">
                <OpeningList kind="doors" items={room.doors} />
                <OpeningList kind="windows" items={room.windows} />
              </div>
            </Section>

            <Section kicker="The finishes" title={`What goes in ${room.label}?`}>
              <div className="grid gap-3">
                {showCabinets ? <CabinetPicker room={room} /> : null}
                {visibleCategories
                  .filter((category) => !isCabinetCategory(category))
                  .map((category) => (
                    <FinishCard key={`${room.id}-${category}`} category={category} room={room} />
                  ))}
              </div>
              {unusedCategories.length > 0 ? (
                <div className="mt-4">
                  <Label>Add another category</Label>
                  <div className="mt-2">
                    <Select onValueChange={(value) => addCategory(value)}>
                      <SelectTrigger aria-label="Add another category">
                        <SelectValue placeholder="Add from the catalog" />
                      </SelectTrigger>
                      <SelectContent>
                        {unusedCategories.map((id) => (
                          <SelectItem key={id} value={id}>
                            {categoryDisplayName(id)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ) : null}
            </Section>

            <Section kicker="Who it's for" title="Client & property">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Client name" value={client.name} onChange={(value) => setClient({ name: value })} />
                <Field label="Phone" value={client.phone} onChange={(value) => setClient({ phone: value })} />
                <Field
                  label="Email"
                  value={client.email}
                  onChange={(value) => setClient({ email: value })}
                  type="email"
                />
                <Field
                  label="Client address"
                  value={client.address}
                  onChange={(value) => setClient({ address: value })}
                />
                <Field
                  label="Job name"
                  value={client.propertyName}
                  onChange={(value) => setClient({ propertyName: value })}
                />
                <Field
                  label="Property address"
                  value={client.propertyAddress}
                  onChange={(value) => setClient({ propertyAddress: value })}
                />
              </div>
            </Section>
          </div>

          <EstimateRail job={job} activeRoomId={activeRoomId} />
        </main>
      </div>

      <div className="app-shell fixed inset-x-0 bottom-0 z-30 border-t border-border bg-bg/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md lg:hidden">
        <div className="mx-auto flex w-full min-w-0 max-w-6xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] tracking-wide text-muted uppercase">Job total</p>
            <p className="font-display text-xl font-medium tabular-nums leading-none sm:text-2xl">{money(job.grandTotal)}</p>
          </div>
          <DownloadPdfButtons job={job} compact />
        </div>
      </div>
    </>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Square;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <Icon className="size-4 text-muted" />
      <div>
        <p className="text-[11px] tracking-wide text-muted uppercase">{label}</p>
        <p className="font-mono text-sm tabular-nums">{value}</p>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  const id = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}
