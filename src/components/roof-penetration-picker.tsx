import { Minus, Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { catalog } from "@/lib/estimator";
import {
  ROOF_PENETRATION_OPTIONS,
  type RoofLineItem,
} from "@/lib/roof-line-items";
import { cn } from "@/lib/utils";

export function RoofPenetrationPicker({
  value,
  onChange,
  variant = "card",
}: {
  value: RoofLineItem[];
  onChange: (next: RoofLineItem[]) => void;
  variant?: "card" | "ink";
}) {
  const chosen = new Set(value.map((row) => row.name));
  const available = ROOF_PENETRATION_OPTIONS.filter((name) => !chosen.has(name));
  const ink = variant === "ink";
  const options = catalog.roofing.options;

  function setQty(name: string, qty: number) {
    const next = Math.max(0, Math.round(qty * 100) / 100);
    onChange(
      value
        .map((row) => (row.name === name ? { ...row, quantity: next } : row))
        .filter((row) => (row.quantity ?? 0) > 0),
    );
  }

  return (
    <div className="space-y-2">
      <p className={cn("text-[11px] uppercase tracking-wide", ink ? "text-ink-foreground/60" : "text-muted")}>
        Penetrations from the photos
      </p>
      {value.length > 0 ? (
        <ul className="space-y-2">
          {value.map((row) => {
            const option = options.find((item) => item.name === row.name);
            const qty = row.quantity ?? 0;
            return (
              <li key={row.name} className="space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <p className={cn("min-w-0 text-xs", ink ? "text-ink-foreground" : "text-fg")}>{row.name}</p>
                  <button
                    type="button"
                    className={cn("shrink-0", ink ? "text-ink-foreground/55" : "text-muted")}
                    onClick={() => onChange(value.filter((item) => item.name !== row.name))}
                    aria-label={`Remove ${row.name}`}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className={cn(
                      "inline-flex size-9 shrink-0 items-center justify-center rounded-md",
                      ink ? "bg-ink-foreground/10 text-ink-foreground" : "bg-card text-fg shadow-border",
                    )}
                    onClick={() => setQty(row.name, qty - 1)}
                    aria-label={`Decrease ${row.name}`}
                  >
                    <Minus className="size-4" />
                  </button>
                  <Input
                    inputMode="numeric"
                    value={String(qty)}
                    onChange={(event) => setQty(row.name, Number(event.target.value))}
                    className={cn(
                      "h-10 min-w-0 text-center font-mono tabular-nums",
                      ink &&
                        "bg-ink-foreground/10 text-ink-foreground shadow-none ring-1 ring-ink-foreground/15",
                    )}
                    aria-label={`${row.name} quantity`}
                  />
                  <button
                    type="button"
                    className={cn(
                      "inline-flex size-9 shrink-0 items-center justify-center rounded-md",
                      ink ? "bg-ink-foreground/10 text-ink-foreground" : "bg-card text-fg shadow-border",
                    )}
                    onClick={() => setQty(row.name, qty + 1)}
                    aria-label={`Increase ${row.name}`}
                  >
                    <Plus className="size-4" />
                  </button>
                  <p className={cn("shrink-0 text-[11px]", ink ? "text-ink-foreground/55" : "text-muted")}>
                    {option?.unit ?? "each"}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className={cn("text-xs", ink ? "text-ink-foreground/60" : "text-muted")}>
          Count boots, vents, turbines, solar, and chimneys from the pictures. Same lines as the estimator.
        </p>
      )}
      {available.length > 0 ? (
        <Select
          key={value.map((row) => row.name).join("|")}
          onValueChange={(name) => {
            if (!name) return;
            onChange([...value, { name, quantity: 1, act: "rr" }]);
          }}
        >
          <SelectTrigger
            className={cn(
              "h-10",
              ink && "bg-ink-foreground/10 text-ink-foreground shadow-none ring-1 ring-ink-foreground/15",
            )}
            aria-label="Add a penetration"
          >
            <SelectValue placeholder={value.length ? "Add another penetration" : "Add a penetration"} />
          </SelectTrigger>
          <SelectContent>
            {available.map((name) => (
              <SelectItem key={name} value={name}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
    </div>
  );
}
