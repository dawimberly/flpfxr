import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEstimatorStore } from "@/lib/estimator-store";
import { cn } from "@/lib/utils";

export function OpToggle() {
  const laborRate = useEstimatorStore((s) => s.laborRate);
  const lastOpPercent = useEstimatorStore((s) => s.lastOpPercent);
  const opEnabled = useEstimatorStore((s) => s.opEnabled);
  const setOpPercent = useEstimatorStore((s) => s.setOpPercent);
  const setOpEnabled = useEstimatorStore((s) => s.setOpEnabled);
  const shown = opEnabled ? laborRate : lastOpPercent;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] tracking-wide text-ink-foreground/60 uppercase">Overhead & profit</p>
        <div className="flex rounded-full bg-ink-foreground/10 p-1">
          <button
            type="button"
            onClick={() => setOpEnabled(true)}
            className={cn(
              "h-8 rounded-full px-3 text-xs transition-colors duration-150",
              opEnabled ? "bg-ink-foreground text-ink" : "text-ink-foreground/70",
            )}
          >
            On
          </button>
          <button
            type="button"
            onClick={() => setOpEnabled(false)}
            className={cn(
              "h-8 rounded-full px-3 text-xs transition-colors duration-150",
              !opEnabled ? "bg-ink-foreground text-ink" : "text-ink-foreground/70",
            )}
          >
            Off
          </button>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="labor-rate" className="text-ink-foreground/60">
          {opEnabled ? `O&P ${shown}%` : "O&P off \u2014 installed only"}
        </Label>
        <Input
          id="labor-rate"
          inputMode="decimal"
          value={shown}
          disabled={!opEnabled}
          onChange={(event) => setOpPercent(Number(event.target.value))}
          className="bg-ink-foreground/10 font-mono tabular-nums text-ink-foreground shadow-none ring-1 ring-ink-foreground/15 disabled:opacity-50"
        />
      </div>
    </div>
  );
}
