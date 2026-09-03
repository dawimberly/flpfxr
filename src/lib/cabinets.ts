import legacyJson from "@/data/northville.json";
import framelessCabinetsJson from "@/data/northville-frameless-cabinets.json";
import framelessClosetsJson from "@/data/northville-frameless-closets.json";
import type { LineItem } from "@/lib/estimator";

export type CabinetFinish = {
  id: string;
  name: string;
  code: string;
  asOf: string;
};

export type CabinetGroup = { id: string; label: string };

export type CabinetItem = {
  sku: string;
  group: string;
  name: string;
  oversized: boolean;
  prices: Record<string, number>;
};

export type CabinetPick = {
  id: string;
  sku: string;
  quantity: number;
};

type NorthvilleCatalog = {
  source: string;
  asOf: string;
  laborPerUnit: number;
  laborPerOversized: number;
  laborNote: string;
  finishes: CabinetFinish[];
  groups: CabinetGroup[];
  items: CabinetItem[];
};

const CLOSET_GROUP_IDS = new Set([
  "closet-unit",
  "closet-shelf",
  "closet-drawer",
  "closet-door",
  "closet-led",
  "closet-upgrade",
]);

const CLOSET_ROOMS = new Set(["closet", "bedroom", "home_office"]);

function mergeCatalogs(legacy: NorthvilleCatalog, next: NorthvilleCatalog): NorthvilleCatalog {
  const finishes: CabinetFinish[] = [];
  const seenFinishes = new Set<string>();
  for (const finish of [...next.finishes, ...legacy.finishes]) {
    if (seenFinishes.has(finish.id)) continue;
    seenFinishes.add(finish.id);
    finishes.push(finish);
  }

  const groups: CabinetGroup[] = [];
  const seenGroups = new Set<string>();
  for (const group of [...legacy.groups, ...next.groups]) {
    if (seenGroups.has(group.id)) continue;
    seenGroups.add(group.id);
    groups.push(group);
  }

  const itemsBySku = new Map<string, CabinetItem>();
  for (const item of legacy.items) {
    itemsBySku.set(item.sku, { ...item, prices: { ...item.prices } });
  }
  for (const item of next.items) {
    const existing = itemsBySku.get(item.sku);
    if (existing) {
      existing.prices = { ...existing.prices, ...item.prices };
    } else {
      itemsBySku.set(item.sku, item);
    }
  }

  return {
    source: `${legacy.source}; ${next.source}`,
    asOf: next.asOf,
    laborPerUnit: next.laborPerUnit,
    laborPerOversized: next.laborPerOversized,
    laborNote: next.laborNote,
    finishes,
    groups,
    items: [...itemsBySku.values()],
  };
}

export const northville = mergeCatalogs(
  mergeCatalogs(legacyJson as NorthvilleCatalog, framelessCabinetsJson as NorthvilleCatalog),
  framelessClosetsJson as NorthvilleCatalog,
);
export const CABINET_LABOR = northville.laborPerUnit;
export const CABINET_LABOR_OVERSIZED = northville.laborPerOversized;
export const CABINET_CATEGORIES = new Set([
  "cabinets",
  "cabinets/storage",
  "vanity/cabinets",
  "closet/storage",
  "built-ins/storage",
]);

const itemBySku = new Map(northville.items.map((item) => [item.sku, item]));

export function isCabinetCategory(category: string) {
  return CABINET_CATEGORIES.has(category);
}

export function isClosetRoom(roomTypeId: string) {
  return CLOSET_ROOMS.has(roomTypeId);
}

export function preferredCabinetGroup(roomTypeId: string) {
  if (roomTypeId === "bathroom") return "vanity";
  if (isClosetRoom(roomTypeId)) return "closet-unit";
  return "base";
}

export function defaultFinishId(roomTypeId: string) {
  return isClosetRoom(roomTypeId) ? "cl" : "ess";
}

export function groupsForRoom(roomTypeId: string) {
  if (isClosetRoom(roomTypeId)) {
    return northville.groups.filter((group) => CLOSET_GROUP_IDS.has(group.id));
  }
  return northville.groups.filter((group) => !CLOSET_GROUP_IDS.has(group.id));
}

export function lineCategoryFor(item: CabinetItem) {
  if (CLOSET_GROUP_IDS.has(item.group)) return "closet/storage";
  if (item.group === "vanity") return "vanity/cabinets";
  return "cabinets";
}

export function getCabinetItem(sku: string) {
  return itemBySku.get(sku) ?? null;
}

export function getFinish(id: string) {
  return northville.finishes.find((finish) => finish.id === id) ?? northville.finishes[0];
}

export function itemsForFinish(finishId: string, group?: string) {
  return northville.items.filter((item) => {
    if (item.prices[finishId] == null) return false;
    if (group && group !== "all" && item.group !== group) return false;
    return true;
  });
}

export function cabinetLaborFor(item: CabinetItem) {
  return item.oversized ? CABINET_LABOR_OVERSIZED : CABINET_LABOR;
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

export function cabinetLineItems(finishId: string, picks: CabinetPick[]): { lines: LineItem[]; warnings: string[] } {
  const finish = getFinish(finishId);
  const lines: LineItem[] = [];
  const warnings: string[] = [];

  for (const pick of picks) {
    const item = getCabinetItem(pick.sku);
    if (!item) {
      warnings.push(`Unknown cabinet SKU ${pick.sku}.`);
      continue;
    }
    const material = item.prices[finishId];
    if (material == null) {
      warnings.push(`${item.sku} is not priced in ${finish.name}.`);
      continue;
    }
    const qty = Math.max(0, pick.quantity);
    if (qty <= 0) {
      warnings.push(`Enter a quantity for ${item.sku}.`);
      continue;
    }

    const category = lineCategoryFor(item);
    const noun = CLOSET_GROUP_IDS.has(item.group) ? "Closet install labor" : "Cabinet install labor";

    lines.push({
      description: `${finish.name} ${item.sku} — ${item.name}`,
      quantity: qty,
      unit: "each",
      unitCost: material,
      lineTotal: round2(qty * material),
      kind: "material",
      category,
    });

    const labor = cabinetLaborFor(item);
    if (labor > 0) {
      lines.push({
        description: `${noun} — ${item.sku}`,
        quantity: qty,
        unit: "each",
        unitCost: labor,
        lineTotal: round2(qty * labor),
        kind: "labor",
        category,
      });
    }
  }

  return { lines, warnings };
}

export function cabinetTotals(finishId: string, picks: CabinetPick[]) {
  const { lines } = cabinetLineItems(finishId, picks);
  const material = round2(
    lines.filter((line) => line.kind === "material").reduce((sum, line) => sum + line.lineTotal, 0),
  );
  const labor = round2(
    lines.filter((line) => line.kind === "labor").reduce((sum, line) => sum + line.lineTotal, 0),
  );
  return { material, labor, installed: round2(material + labor), count: picks.reduce((sum, pick) => sum + pick.quantity, 0) };
}
