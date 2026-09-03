import { Minus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  canInferQuantity,
  catalog,
  inferredQuantity,
  lookupOption,
  parseScan,
  type JobRoom,
} from "@/lib/estimator";
import { useEstimatorStore } from "@/lib/estimator-store";
import { selectionList } from "@/lib/selections";
import { money, qtyLabel } from "@/lib/utils";

export function FinishCard({ category, room }: { category: string; room: JobRoom }) {
  const addSelection = useEstimatorStore((s) => s.addSelection);
  const setSelectionQty = useEstimatorStore((s) => s.setSelectionQty);
  const removeSelection = useEstimatorStore((s) => s.removeSelection);
  const clearSelection = useEstimatorStore((s) => s.clearSelection);
  const block = catalog[category];
  const picks = selectionList(room.selections[category]);
  const scan = parseScan(room);
  const chosenNames = new Set(picks.map((item) => item.name));
  const available = (block?.options ?? []).filter((option) => !chosenNames.has(option.name));

  if (!block) return null;

  return (
    <div className="min-w-0 rounded-lg bg-surface p-3 sm:p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-fg">{block.display_name}</p>
          <p className="text-xs text-muted">
            {picks.length === 0
              ? "Add every line this room needs."
              : `${picks.length} ${picks.length === 1 ? "line" : "lines"}`}
          </p>
        </div>
        {picks.length > 0 ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => clearSelection(category)}>
            Clear
          </Button>
        ) : null}
      </div>

      {picks.length > 0 ? (
        <ul className="mb-3 divide-y divide-border">
          {picks.map((pick) => {
            const option = lookupOption(category, pick.name);
            if (!option) return null;
            const infer = canInferQuantity(category, option.unit);
            const autoQty = inferredQuantity(scan, category, option.unit);
            const qty = pick.quantity ?? autoQty;
            return (
              <li key={pick.name} className="py-2.5 first:pt-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-fg">{option.name}</p>
                    <p className="text-xs text-muted">
                      {money(option.cost_per_unit)} / {option.unit}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-muted"
                    onClick={() => removeSelection(category, pick.name)}
                    aria-label={`Remove ${option.name}`}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
                {infer && autoQty != null && pick.quantity == null ? (
                  <p className="mt-2 rounded-md bg-wash px-3 py-2 text-sm text-fg">
                    From the room ·{" "}
                    <span className="font-mono tabular-nums">{qtyLabel(autoQty, option.unit)}</span>
                  </p>
                ) : (
                  <div className="mt-2 flex min-w-0 items-center gap-2">
                    <button
                      type="button"
                      className="inline-flex size-9 shrink-0 items-center justify-center rounded-md bg-card text-fg shadow-border"
                      onClick={() =>
                        setSelectionQty(category, pick.name, Math.max(0, roundStep((qty ?? 0) - 1)))
                      }
                      aria-label={`Decrease ${option.name}`}
                    >
                      <Minus className="size-4" />
                    </button>
                    <Input
                      inputMode="decimal"
                      value={Number.isFinite(qty ?? 0) ? String(qty ?? 0) : ""}
                      onChange={(event) =>
                        setSelectionQty(category, pick.name, Number(event.target.value))
                      }
                      className="min-w-0 text-center font-mono tabular-nums"
                      aria-label={`${option.name} quantity`}
                    />
                    <button
                      type="button"
                      className="inline-flex size-9 shrink-0 items-center justify-center rounded-md bg-card text-fg shadow-border"
                      onClick={() =>
                        setSelectionQty(category, pick.name, roundStep((qty ?? 0) + 1))
                      }
                      aria-label={`Increase ${option.name}`}
                    >
                      <Plus className="size-4" />
                    </button>
                    <p className="shrink-0 text-xs text-muted">{option.unit}</p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}

      {available.length > 0 ? (
        <Select
          key={picks.map((item) => item.name).join("|")}
          onValueChange={(value) => {
            if (!value) return;
            addSelection(category, value);
          }}
        >
          <SelectTrigger aria-label={`Add a ${block.display_name} line`}>
            <SelectValue placeholder={picks.length === 0 ? "Add a line" : "Add another line"} />
          </SelectTrigger>
          <SelectContent>
            {available.map((option) => (
              <SelectItem key={option.name} value={option.name}>
                {option.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
    </div>
  );
}

function roundStep(value: number) {
  return Math.round(value * 100) / 100;
}
