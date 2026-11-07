import { useState } from "react";
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
import { CABINET_FINISHES, cabinetTier } from "@/lib/public-cabinet-finishes";
import { isClosetRoom, preferredCabinetGroup, resolveCabinetFinish } from "@/lib/cabinets";
import type { loadCabinetCatalog } from "@/lib/cabinet-quote";
import type { JobRoom } from "@/lib/estimator";
import { useEstimatorStore } from "@/lib/estimator-store";

export function CabinetPicker({ room, catalog }: {
  room: JobRoom;
  catalog: Awaited<ReturnType<typeof loadCabinetCatalog>>;
}) {
  const setCabinetFinish = useEstimatorStore((s) => s.setCabinetFinish);
  const addCabinet = useEstimatorStore((s) => s.addCabinet);
  const setCabinetQty = useEstimatorStore((s) => s.setCabinetQty);
  const removeCabinet = useEstimatorStore((s) => s.removeCabinet);
  const closetRoom = isClosetRoom(room.roomTypeId);
  const roomGroups = catalog.groups.filter(item => item.id.startsWith("closet-") === closetRoom);
  const preferred = preferredCabinetGroup(room.roomTypeId);
  const [group, setGroup] = useState(preferred);
  const [sku, setSku] = useState("");

  const activeGroup = roomGroups.some((item) => item.id === group) ? group : preferred;
  const picks = room.cabinets ?? [];
  const finishId = resolveCabinetFinish(room.cabinetFinishId, room.roomTypeId);
  const options = catalog.items.filter(item => item.group === activeGroup && item.finishes.some(finish => finish === finishId));
  const selected = options.find(item => item.sku === sku);
  const finish = CABINET_FINISHES.find(item => item.id === finishId);
  const tier = finish ? cabinetTier(finish.id) : null;
  const heading = closetRoom ? "Closets" : "Cabinets";

  return (
    <div className="min-w-0 rounded-lg bg-surface p-3 sm:p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-fg">{heading}</p>
          {tier ? <p className="text-xs text-muted">{tier.label}. {tier.details}</p> : null}
        </div>
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
              {catalog.finishes.filter(item => closetRoom ? item.id === "cl" : item.id !== "cl").map((item) => (
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
            {options.map(item => (
              <SelectItem key={item.sku} value={item.sku}>{item.sku} — {item.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          disabled={!selected}
          onClick={() => {
            if (!sku) return;
            addCabinet(sku);
          }}
        >
          <Plus className="size-4" />
          Add
        </Button>
      </div>
      {picks.length === 0 ? (
        <p className="mt-3 text-sm text-muted">
          {closetRoom
            ? "Add each closet tower, shelf, and drawer by SKU."
            : "Add each box by SKU. Linear feet from Xactimate are not used here."}
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-border">
          {picks.map((pick) => {
            const item = catalog.items.find(entry => entry.sku === pick.sku);
            return (
              <li key={pick.id} className="flex min-w-0 flex-col gap-2 py-2.5 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-fg">
                    {pick.sku} {item ? `· ${item.name}` : ""}
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
    </div>
  );
}
