import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { gableRoofFt, inchesToFt } from "@/lib/roof-math";
import { EV_LEGEND } from "@/lib/roof-style";
import { cn } from "@/lib/utils";

export function EvLegend({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "pointer-events-none rounded-md bg-white/92 px-2.5 py-1.5 text-[11px] leading-5 text-ink shadow",
        className,
      )}
    >
      {EV_LEGEND.map((row) => (
        <div key={row.kind} className="flex items-center gap-2">
          <span
            className="inline-block h-0 w-5 shrink-0"
            style={{
              borderTopWidth: 3,
              borderTopStyle: row.dash ? "dashed" : "solid",
              borderTopColor: row.color,
            }}
          />
          {row.label}
        </div>
      ))}
    </div>
  );
}

export function RoofDimFields({
  garageWidth,
  eaveOverhang,
  rakeOverhang,
  onGarageWidth,
  onEaveOverhang,
  onRakeOverhang,
  variant = "card",
}: {
  garageWidth: string;
  eaveOverhang: string;
  rakeOverhang: string;
  onGarageWidth: (value: string) => void;
  onEaveOverhang: (value: string) => void;
  onRakeOverhang: (value: string) => void;
  variant?: "card" | "ink";
}) {
  const gable = gableRoofFt(Number(garageWidth), Number(rakeOverhang));
  const eaveFt = inchesToFt(Number(eaveOverhang));
  const inputClass =
    variant === "ink"
      ? "h-10 bg-ink-foreground/10 font-mono tabular-nums text-ink-foreground shadow-none ring-1 ring-ink-foreground/15"
      : "h-10 font-mono tabular-nums";
  const labelClass = variant === "ink" ? "text-[11px] text-ink-foreground/60" : "text-[11px]";
  const hintClass = variant === "ink" ? "text-xs text-ink-foreground/60" : "text-xs text-muted";
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1.5">
          <Label className={labelClass} htmlFor="garage-width">
            Garage width (ft)
          </Label>
          <Input
            id="garage-width"
            inputMode="decimal"
            value={garageWidth}
            placeholder="18.5"
            onChange={(event) => onGarageWidth(event.target.value)}
            className={inputClass}
          />
        </div>
        <div className="space-y-1.5">
          <Label className={labelClass} htmlFor="eave-oh">
            Eave OH (in)
          </Label>
          <Input
            id="eave-oh"
            inputMode="decimal"
            value={eaveOverhang}
            placeholder="23"
            onChange={(event) => onEaveOverhang(event.target.value)}
            className={inputClass}
          />
        </div>
        <div className="space-y-1.5">
          <Label className={labelClass} htmlFor="rake-oh">
            Rake OH (in)
          </Label>
          <Input
            id="rake-oh"
            inputMode="decimal"
            value={rakeOverhang}
            placeholder="12"
            onChange={(event) => onRakeOverhang(event.target.value)}
            className={inputClass}
          />
        </div>
      </div>
      <p className={hintClass}>
        {gable
          ? `Roof gable for scale: ${gable} ft (wall + 2 x rake). Eave overhang ${eaveFt || 0} ft soffit.`
          : "Garage width is the wall. Rake is barge to drip. Eave is wall to drip (soffit)."}
      </p>
    </div>
  );
}
