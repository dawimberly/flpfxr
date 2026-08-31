import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ESTIMATE_TYPES,
  SCOPE_LABELS,
  saveLeadDraft,
  type EstimateScope,
  type ServiceId,
} from "@/lib/site";
import { cn, formatUsdRange } from "@/lib/utils";

const SCOPES: EstimateScope[] = ["small", "medium", "large"];

export function QuoteEstimator({
  compact = false,
  initialService,
  hideCta = false,
  onServiceChange,
}: {
  compact?: boolean;
  initialService?: ServiceId;
  hideCta?: boolean;
  onServiceChange?: (id: ServiceId) => void;
}) {
  const starting =
    initialService && ESTIMATE_TYPES.some((t) => t.id === initialService)
      ? initialService
      : "kitchen-bath";
  const [serviceId, setServiceId] = useState<ServiceId | "">(starting);
  const [scope, setScope] = useState<EstimateScope>("medium");
  const navigate = useNavigate();

  useEffect(() => {
    if (initialService && ESTIMATE_TYPES.some((t) => t.id === initialService)) {
      setServiceId(initialService);
    }
  }, [initialService]);

  const selected = ESTIMATE_TYPES.find((t) => t.id === serviceId);
  const range = selected ? selected.ranges[scope] : null;

  const pickService = (id: ServiceId) => {
    setServiceId(id);
    onServiceChange?.(id);
  };

  const goToContact = () => {
    saveLeadDraft({
      service: serviceId || undefined,
      scope,
      message: selected
        ? `I'm looking at a ${SCOPE_LABELS[scope].toLowerCase()} ${selected.label.toLowerCase()}. Rough planning range ${range ? formatUsdRange(range[0], range[1]) : ""}.`
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
          <p className="text-sm text-muted">{selected.includes[scope]}</p>
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
