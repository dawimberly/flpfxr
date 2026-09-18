import { QuoteEstimator, type QuoteSelection } from "@/components/quote-estimator";
import { RoofPublicQuote, type RoofQuotePayload } from "@/components/roof-public-quote";
import type { ServiceId } from "@/lib/site";
import { cn } from "@/lib/utils";

export type BallparkSide = "interior" | "exterior";

const SIDES: Array<{ id: BallparkSide; label: string }> = [
  { id: "interior", label: "Interior" },
  { id: "exterior", label: "Exterior" },
];

export function JobBallpark({
  side,
  onSideChange,
  initialService,
  hideCta = false,
  onQuoteChange,
  onServiceChange,
}: {
  side: BallparkSide;
  onSideChange: (side: BallparkSide) => void;
  initialService?: ServiceId;
  hideCta?: boolean;
  onQuoteChange?: (quote: QuoteSelection | null) => void;
  onServiceChange?: (id: ServiceId) => void;
}) {
  const onRoofQuote = (payload: RoofQuotePayload | null) => {
    if (!payload) {
      onQuoteChange?.(null);
      return;
    }
    onQuoteChange?.({
      service: "roofing",
      scope: "medium",
      kitchen: "none",
      bathroom: "none",
      summary: payload.includes,
      range: payload.range,
      includes: payload.message,
    });
  };

  return (
    <div
      id="ballpark"
      className="scroll-mt-28 rounded-2xl bg-surface p-5 shadow-[var(--shadow-border)] md:p-8"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
        Ballpark
      </p>
      <h2 className="mt-2 font-display text-2xl text-fg md:text-3xl">
        What's the job?
      </h2>
      <p className="mt-2 text-sm text-muted">
        {side === "exterior"
          ? "We outline that roof. You pick pitch and shingles. Planning range for San Antonio. Not a bid."
          : "Ballpark for San Antonio. Not a bid. We'll walk the job."}
      </p>

      <div className="mt-6 grid grid-cols-2 gap-2">
        {SIDES.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSideChange(item.id)}
            className={cn(
              "h-11 rounded-lg text-sm font-medium transition-[background-color,color] duration-150",
              side === item.id
                ? "bg-cream text-cream-fg"
                : "bg-bg text-muted shadow-[var(--shadow-border)] hover:text-fg",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {side === "interior" ? (
        <QuoteEstimator
          embedded
          hideCta={hideCta}
          initialService={initialService}
          onQuoteChange={onQuoteChange}
          onServiceChange={onServiceChange}
        />
      ) : (
        <RoofPublicQuote
          embedded
          hideCta={hideCta}
          onQuoteChange={onRoofQuote}
        />
      )}
    </div>
  );
}
