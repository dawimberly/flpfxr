import { useMemo, useState } from "react";
import { Minus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CABINET_LABOR,
  CABINET_LABOR_OVERSIZED,
  cabinetLaborFor,
  cabinetTotals,
  getCabinetItem,
  getFinish,
  groupsForRoom,
  isClosetRoom,
  itemsForFinish,
  northville,
  preferredCabinetGroup,
} from "@/lib/cabinets";
import type { JobRoom } from "@/lib/estimator";
import { useEstimatorStore } from "@/lib/estimator-store";
import { money } from "@/lib/utils";

export function CabinetPicker({ room }: { room: JobRoom }) {
  const setCabinetFinish = useEstimatorStore((s) => s.setCabinetFinish);
  const addCabinet = useEstimatorStore((s) => s.addCabinet);
  const setCabinetQty = useEstimatorStore((s) => s.setCabinetQty);
  const removeCabinet = useEstimatorStore((s) => s.removeCabinet);
  const closetRoom = isClosetRoom(room.roomTypeId);
  const roomGroups = groupsForRoom(room.roomTypeId);
  const preferred = preferredCabinetGroup(room.roomTypeId);
  const [group, setGroup] = useState(preferred);
  const [sku, setSku] = useState("");

  const activeGroup = roomGroups.some((item) => item.id === group) ? group : preferred;
  const picks = room.cabinets ?? [];
  const finishId = room.cabinetFinishId ?? (closetRoom ? "cl" : "ess");
  const finish = getFinish(finishId);
  const options = useMemo(() => itemsForFinish(finishId, activeGroup), [finishId, activeGroup]);
  const totals = cabinetTotals(finishId, picks);
  const selected = options.find((item) => item.sku === sku) ?? null;
  const heading = closetRoom ? "Closets" : "Cabinets";

  return (
    <div className="min-w-0 rounded-lg bg-surface p-3 sm:p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-fg">{heading}</p>
          <p className="text-xs text-muted">
            Northville MSRP {northville.asOf}. ${CABINET_LABOR} install each, ${CABINET_LABOR_OVERSIZED}{" "}
            for pantries, fridge panels, and tall closet towers.
          </p>
        </div>
        <p className="shrink-0 font-mono text-sm tabular-nums text-fg">{money(totals.installed)}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Finish</Label>
          <Select
            value={finishId}
            onValueChange={(value) => {
              setCabinetFinish(value);
              setSku("");
            }}
          >
            <SelectTrigger aria-label={closetRoom ? "Closet finish" : "Cabinet finish"}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {northville.finishes.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Type</Label>
          <Select
            value={activeGroup}
            onValueChange={(value) => {
              setGroup(value);
              setSku("");
            }}
          >
            <SelectTrigger aria-label={closetRoom ? "Closet type" : "Cabinet type"}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {roomGroups.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Select value={sku || undefined} onValueChange={setSku}>
          <SelectTrigger aria-label={closetRoom ? "Closet SKU" : "Cabinet SKU"} className="sm:flex-1">
            <SelectValue placeholder="Choose a SKU" />
          </SelectTrigger>
          <SelectContent>
            {options.map((item) => {
              const price = item.prices[finishId];
              const labor = cabinetLaborFor(item);
              return (
                <SelectItem key={item.sku} value={item.sku}>
                  {item.sku} — {item.name} · {money(price)}
                  {labor ? ` + ${money(labor)} labor` : " material only"}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
        <Button
          type="button"
          disabled={!sku}
          onClick={() => {
            if (!sku) return;
            addCabinet(sku);
          }}
        >
          <Plus className="size-4" />
          Add
        </Button>
      </div>
      {selected ? (
        <p className="mt-2 text-xs text-muted">
          {selected.sku} · {money(selected.prices[finishId])} material +{" "}
          {money(cabinetLaborFor(selected))} labor
          {selected.oversized ? " (oversized)" : ""}
        </p>
      ) : null}

      {picks.length === 0 ? (
        <p className="mt-3 text-sm text-muted">
          {closetRoom
            ? "Add each closet tower, shelf, and drawer by SKU."
            : "Add each box by SKU. Linear feet from Xactimate are not used here."}
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-border">
          {picks.map((pick) => {
            const item = getCabinetItem(pick.sku);
            const price = item?.prices[finishId];
            const labor = item ? cabinetLaborFor(item) * pick.quantity : 0;
            const material = price != null ? price * pick.quantity : 0;
            return (
              <li key={pick.id} className="flex min-w-0 flex-col gap-2 py-2.5 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-fg">
                    {pick.sku} {item ? `· ${item.name}` : ""}
                  </p>
                  <p className="font-mono text-xs tabular-nums text-muted">
                    {finish.code} · {money(material)}
                    {labor ? ` + ${money(labor)} labor` : " material only"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1 self-end sm:self-auto">
                  <button
                    type="button"
                    className="inline-flex size-9 items-center justify-center rounded-md bg-card text-fg shadow-border"
                    onClick={() =>
                      pick.quantity <= 1 ? removeCabinet(pick.id) : setCabinetQty(pick.id, pick.quantity - 1)
                    }
                    aria-label={`Decrease ${pick.sku}`}
                  >
                    <Minus className="size-4" />
                  </button>
                  <span className="w-8 text-center font-mono text-sm tabular-nums">{pick.quantity}</span>
                  <button
                    type="button"
                    className="inline-flex size-9 items-center justify-center rounded-md bg-card text-fg shadow-border"
                    onClick={() => setCabinetQty(pick.id, pick.quantity + 1)}
                    aria-label={`Increase ${pick.sku}`}
                  >
                    <Plus className="size-4" />
                  </button>
                  <button
                    type="button"
                    className="inline-flex size-9 items-center justify-center rounded-md text-muted"
                    onClick={() => removeCabinet(pick.id)}
                    aria-label={`Remove ${pick.sku}`}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {picks.length > 0 ? (
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div className="min-w-0 rounded-md bg-wash px-1 py-2 sm:px-2">
            <p className="text-[11px] tracking-wide text-muted uppercase">Material</p>
            <p className="truncate font-mono text-xs tabular-nums sm:text-sm">{money(totals.material)}</p>
          </div>
          <div className="min-w-0 rounded-md bg-wash px-1 py-2 sm:px-2">
            <p className="text-[11px] tracking-wide text-muted uppercase">Labor</p>
            <p className="truncate font-mono text-xs tabular-nums sm:text-sm">{money(totals.labor)}</p>
          </div>
          <div className="min-w-0 rounded-md bg-wash px-1 py-2 sm:px-2">
            <p className="text-[11px] tracking-wide text-muted uppercase">Installed</p>
            <p className="truncate font-mono text-xs tabular-nums sm:text-sm">{money(totals.installed)}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
