import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ESTIMATE_TYPES,
  ROOM_BALLPARKS,
  ROOM_SCOPE_LABELS,
  SCOPE_LABELS,
  addRanges,
  kitchenBathLine,
  loadLeadDraft,
  roomRange,
  saveLeadDraft,

  type EstimateScope,
  type RoomKind,
  type RoomScope,
  type ServiceId,
} from "@/lib/site";
import { cn, formatUsdRange } from "@/lib/utils";

const SCOPES: EstimateScope[] = ["small", "medium", "large"];
const SIZE_SCOPES: EstimateScope[] = ["small", "medium", "large"];

export type QuoteSelection = {
  service: ServiceId | "";
  scope: EstimateScope;
  kitchen: RoomScope;
  bathroom: RoomScope;
  summary: string;
  range: [number, number] | null;
  includes: string;
};

function isRoomScope(value: string | undefined): value is RoomScope {
  return value === "none" || value === "small" || value === "medium" || value === "large";
}

export function QuoteEstimator({
  compact = false,
  initialService,
  hideCta = false,
  initialKitchen,
  initialBathroom,
  onQuoteChange,
  onServiceChange,
}: {
  compact?: boolean;
  initialService?: ServiceId;
  hideCta?: boolean;
  initialKitchen?: RoomScope;
  initialBathroom?: RoomScope;
  onQuoteChange?: (quote: QuoteSelection) => void;
  onServiceChange?: (id: ServiceId) => void;
}) {
  const starting =
    initialService && ESTIMATE_TYPES.some((t) => t.id === initialService)
      ? initialService
      : "kitchen-bath";
  const [serviceId, setServiceId] = useState<ServiceId | "">(starting);
  const [scope, setScope] = useState<EstimateScope>("medium");
  const [kitchen, setKitchen] = useState<RoomScope>(
    isRoomScope(initialKitchen) ? initialKitchen : "medium",
  );
  const [bathroom, setBathroom] = useState<RoomScope>(
    isRoomScope(initialBathroom) ? initialBathroom : "none",
  );
  const navigate = useNavigate();

  useEffect(() => {
    if (initialService && ESTIMATE_TYPES.some((t) => t.id === initialService)) {
      setServiceId(initialService);
    }
  }, [initialService]);

  useEffect(() => {
    const draft = loadLeadDraft();
    if (draft.scope === "small" || draft.scope === "medium" || draft.scope === "large") {
      setScope(draft.scope);
    }
  }, []);

  const selected = ESTIMATE_TYPES.find((t) => t.id === serviceId);
  const kitchenBath = serviceId === "kitchen-bath";
  const kitRange = kitchenBath ? roomRange("kitchen", kitchen) : null;
  const bathRange = kitchenBath ? roomRange("bathroom", bathroom) : null;
  const range = kitchenBath
    ? addRanges(kitRange, bathRange)
    : selected
      ? selected.ranges[scope]
      : null;

  const includes = kitchenBath
    ? [
        kitchen !== "none" ? `Kitchen: ${ROOM_BALLPARKS.kitchen.includes[kitchen]}` : null,
        bathroom !== "none" ? `Bathroom: ${ROOM_BALLPARKS.bathroom.includes[bathroom]}` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : selected
      ? selected.includes[scope]
      : "";

  const summary = kitchenBath
    ? kitchenBathLine(kitchen, bathroom)
    : selected
      ? `${SCOPE_LABELS[scope]} ${selected.label.toLowerCase()}`
      : "";

  const quote: QuoteSelection = {
    service: serviceId,
    scope,
    kitchen,
    bathroom,
    summary,
    range,
    includes,
  };

  useEffect(() => {
    onQuoteChange?.(quote);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- parent only needs the current pick
  }, [serviceId, scope, kitchen, bathroom, summary, includes, range?.[0], range?.[1]]);

  const pickService = (id: ServiceId) => {
    setServiceId(id);
    onServiceChange?.(id);
  };

  const goToContact = () => {
    saveLeadDraft({
      service: serviceId || undefined,
      scope,
      kitchenScope: kitchen,
      bathroomScope: bathroom,
      message: summary
        ? `I'm looking at a ${summary.toLowerCase()}.${range ? ` Rough planning range ${formatUsdRange(range[0], range[1])}.` : ""}`
        : "",
    });
    void navigate({ to: "/contact", search: { service: serviceId || undefined } });
  };

  const bothRooms = kitchenBath && kitchen !== "none" && bathroom !== "none";

  return (
    <div
      id="ballpark"
      className={cn(
        "scroll-mt-28 rounded-2xl bg-surface p-5 shadow-[var(--shadow-border)] md:p-8",
        compact && "p-5 md:p-6",
      )}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
        Ballpark
      </p>
      <h2 className="mt-2 font-display text-2xl text-fg md:text-3xl">
        What's the job?
      </h2>
      <p className="mt-2 text-sm text-muted">
        Ballpark for San Antonio. Not a bid. We'll walk the job.
      </p>

      <div className="mt-6 grid gap-2 sm:grid-cols-2">
        {ESTIMATE_TYPES.map((type) => (
          <button
            key={type.id}
            type="button"
            onClick={() => pickService(type.id)}
            className={cn(
              "rounded-xl px-4 py-3 text-left text-sm font-medium transition-[background-color,color,box-shadow] duration-150",
              serviceId === type.id
                ? "bg-primary text-primary-fg"
                : "bg-bg text-fg shadow-[var(--shadow-border)] hover:shadow-[var(--shadow-border-hover)]",
            )}
          >
            {type.label}
          </button>
        ))}
      </div>

      {kitchenBath ? (
        <div className="mt-6 space-y-4">
          <p className="text-sm text-muted">Pick a kitchen, a bath, or both. Each has its own number.</p>
          <RoomSizeRow kind="kitchen" value={kitchen} onChange={setKitchen} range={kitRange} />
          <RoomSizeRow kind="bathroom" value={bathroom} onChange={setBathroom} range={bathRange} />
        </div>
      ) : (
        <>
          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-muted">
            Size
          </p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {SCOPES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setScope(s)}
                className={cn(
                  "h-11 rounded-lg text-sm font-medium transition-[background-color,color] duration-150",
                  scope === s
                    ? "bg-cream text-cream-fg"
                    : "bg-bg text-muted shadow-[var(--shadow-border)] hover:text-fg",
                )}
              >
                {SCOPE_LABELS[s]}
              </button>
            ))}
          </div>
        </>
      )}

      {kitchenBath && range ? (
        <div className="mt-6 rounded-xl bg-bg p-5">
          {bothRooms ? (
            <>
              <p className="text-sm text-muted">Together</p>
              <p className="mt-1 font-display text-3xl text-fg tabular-nums md:text-4xl">
                {formatUsdRange(range[0], range[1])}
              </p>
              <p className="mt-2 text-sm text-muted">{includes}</p>
            </>
          ) : (
            <>
              <p className="text-sm text-muted">{includes}</p>
              <p className="mt-2 font-display text-3xl text-fg tabular-nums md:text-4xl">
                {formatUsdRange(range[0], range[1])}
              </p>
            </>
          )}
          <p className="mt-1 text-xs text-subtle">
            Finish and the house itself change this. We'll walk it free.
          </p>
        </div>
      ) : selected && range && !kitchenBath ? (
        <div className="mt-6 rounded-xl bg-bg p-5">
          <p className="text-sm text-muted">{includes}</p>
          <p className="mt-2 font-display text-3xl text-fg tabular-nums md:text-4xl">
            {formatUsdRange(range[0], range[1])}
          </p>
          <p className="mt-1 text-xs text-subtle">
            Finish and the house itself change this. We'll walk it free.
          </p>
        </div>
      ) : kitchenBath ? (
        <p className="mt-6 text-sm text-muted">Pick a kitchen size, a bathroom size, or both.</p>
      ) : null}

      {hideCta ? null : (
        <Button type="button" size="lg" className="mt-6 w-full" onClick={goToContact}>
          Get a quote
          <ArrowRight className="size-4" />
        </Button>
      )}
    </div>
  );
}

function RoomSizeRow({
  kind,
  value,
  onChange,
  range,
}: {
  kind: RoomKind;
  value: RoomScope;
  onChange: (scope: RoomScope) => void;
  range: [number, number] | null;
}) {
  return (
    <div className="rounded-xl bg-bg px-4 py-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium text-fg">{ROOM_BALLPARKS[kind].label}</p>
        <p className="text-sm tabular-nums text-muted">
          {range ? formatUsdRange(range[0], range[1]) : "Skip"}
        </p>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2">
        <button
          type="button"
          onClick={() => onChange("none")}
          className={cn(
            "h-11 rounded-lg text-sm font-medium transition-[background-color,color] duration-150",
            value === "none"
              ? "bg-cream text-cream-fg"
              : "bg-surface text-muted shadow-[var(--shadow-border)] hover:text-fg",
          )}
        >
          Skip
        </button>
        {SIZE_SCOPES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onChange(s)}
            className={cn(
              "h-11 rounded-lg text-sm font-medium transition-[background-color,color] duration-150",
              value === s
                ? "bg-cream text-cream-fg"
                : "bg-surface text-muted shadow-[var(--shadow-border)] hover:text-fg",
            )}
          >
            {ROOM_SCOPE_LABELS[s]}
          </button>
        ))}
      </div>
      {value !== "none" ? (
        <p className="mt-2 text-xs text-subtle">{ROOM_BALLPARKS[kind].includes[value]}</p>
      ) : null}
    </div>
  );
}
