import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ESTIMATE_TYPES,
  SCOPE_LABELS,
  loadLeadDraft,
  saveLeadDraft,
  type EstimateScope,
  type RoomScope,
  type ServiceId,
} from "@/lib/site";
import { cn, formatUsdRange } from "@/lib/utils";

const SCOPES: EstimateScope[] = ["small", "medium", "large"];

export type QuoteSelection = {
  service: ServiceId | "";
  scope: EstimateScope;
  kitchen: RoomScope;
  bathroom: RoomScope;
  summary: string;
  range: [number, number] | null;
  includes: string;
};

function roomsFromService(service: ServiceId | "", scope: EstimateScope): {
  kitchen: RoomScope;
  bathroom: RoomScope;
} {
  if (service === "kitchen") return { kitchen: scope, bathroom: "none" };
  if (service === "bathroom") return { kitchen: "none", bathroom: scope };
  return { kitchen: "none", bathroom: "none" };
}

export function QuoteEstimator({
  compact = false,
  initialService,
  hideCta = false,
  onQuoteChange,
  onServiceChange,
}: {
  compact?: boolean;
  initialService?: ServiceId;
  hideCta?: boolean;
  onQuoteChange?: (quote: QuoteSelection) => void;
  onServiceChange?: (id: ServiceId) => void;
}) {
  const mapped =
    initialService === "kitchen-bath" ? "kitchen" : initialService;
  const starting =
    mapped && ESTIMATE_TYPES.some((t) => t.id === mapped) ? mapped : "kitchen";
  const [serviceId, setServiceId] = useState<ServiceId | "">(starting);
  const [scope, setScope] = useState<EstimateScope>("medium");
  const navigate = useNavigate();

  useEffect(() => {
    const next = initialService === "kitchen-bath" ? "kitchen" : initialService;
    if (next && ESTIMATE_TYPES.some((t) => t.id === next)) {
      setServiceId(next);
    }
  }, [initialService]);

  useEffect(() => {
    const draft = loadLeadDraft();
    if (draft.scope === "small" || draft.scope === "medium" || draft.scope === "large") {
      setScope(draft.scope);
    }
  }, []);

  const selected = ESTIMATE_TYPES.find((t) => t.id === serviceId);
  const range = selected ? selected.ranges[scope] : null;
  const includes = selected ? selected.includes[scope] : "";
  const summary = selected ? `${SCOPE_LABELS[scope]} ${selected.label.toLowerCase()}` : "";
  const rooms = roomsFromService(serviceId, scope);

  const quote: QuoteSelection = {
    service: serviceId,
    scope,
    kitchen: rooms.kitchen,
    bathroom: rooms.bathroom,
    summary,
    range,
    includes,
  };

  useEffect(() => {
    onQuoteChange?.(quote);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- parent only needs the current pick
  }, [serviceId, scope, summary, includes, range?.[0], range?.[1]]);

  const pickService = (id: ServiceId) => {
    setServiceId(id);
    onServiceChange?.(id);
  };

  const goToContact = () => {
    saveLeadDraft({
      service: serviceId || undefined,
      scope,
      kitchenScope: rooms.kitchen,
      bathroomScope: rooms.bathroom,
      message: summary
        ? `I'm looking at a ${summary.toLowerCase()}.${range ? ` Rough planning range ${formatUsdRange(range[0], range[1])}.` : ""}`
        : "",
    });
    void navigate({ to: "/contact", search: { service: serviceId || undefined } });
  };

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

      {selected && range ? (
        <div className="mt-6 rounded-xl bg-bg p-5">
          <p className="text-sm text-muted">{includes}</p>
          <p className="mt-2 font-display text-3xl text-fg tabular-nums md:text-4xl">
            {formatUsdRange(range[0], range[1])}
          </p>
          <p className="mt-1 text-xs text-subtle">
            Finish and the house itself change this. We'll walk it free.
          </p>
        </div>
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
