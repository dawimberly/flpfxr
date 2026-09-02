import northvilleJson from "@/data/northville.json";
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

export const northville = northvilleJson as NorthvilleCatalog;
export const CABINET_LABOR = northville.laborPerUnit;
export const CABINET_LABOR_OVERSIZED = northville.laborPerOversized;
export const CABINET_CATEGORIES = new Set(["cabinets", "cabinets/storage", "vanity/cabinets"]);

const itemBySku = new Map(northville.items.map((item) => [item.sku, item]));

export function isCabinetCategory(category: string) {
  return CABINET_CATEGORIES.has(category);
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

    lines.push({
      description: `${finish.name} ${item.sku} — ${item.name}`,
      quantity: qty,
      unit: "each",
      unitCost: material,
      lineTotal: round2(qty * material),
      kind: "material",
      category: "cabinets",
    });

    const labor = cabinetLaborFor(item);
    if (labor > 0) {
      lines.push({
        description: `Cabinet install labor — ${item.sku}`,
        quantity: qty,
        unit: "each",
        unitCost: labor,
        lineTotal: round2(qty * labor),
        kind: "labor",
        category: "cabinets",
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
