import framed from "../data/northville.json" with { type: "json" };
import frameless from "../data/northville-frameless-cabinets.json" with { type: "json" };
import closets from "../data/northville-frameless-closets.json" with { type: "json" };
import { CABINET_FINISHES, type CabinetFinishId, type CabinetPick, type CabinetQuote } from "./cabinets.ts";

const CABINET_PRICING = {
  multiplier: { ew: 0.80, gs: 0.80, es: 0.80, msk: 0.80, bs: 0.80, me: 0.80, cg: 0.80, aw: 0.80, ve: 0.75 },
  install: { standard: 75, oversized: 125 },
} as const;

const supported = new Set<string>([...CABINET_FINISHES.map(finish => finish.id), "ess", "prime", "cl"]);
type CatalogItem = { sku: string; group: string; name: string; oversized: boolean; prices: Record<string, number> };
const items = new Map<string, CatalogItem>();
for (const catalog of [framed, frameless, closets]) {
  for (const item of catalog.items) {
    const existing = items.get(item.sku);
    items.set(item.sku, existing
      ? { ...existing, prices: { ...existing.prices, ...item.prices } as Record<string, number> }
      : { ...item, prices: item.prices as Record<string, number> });
  }
}

export function cabinetCatalog() {
  return {
    finishes: [...CABINET_FINISHES, ...frameless.finishes, ...closets.finishes].map(({ id, name }) => ({ id, name })),
    groups: [...new Map([...framed.groups, ...frameless.groups, ...closets.groups].map(group => [group.id, group])).values()],
    items: [...items.values()].map(({ sku, group, name, prices }) => ({
      sku, group, name, finishes: Object.keys(prices).filter(id => supported.has(id)),
    })),
  };
}

function installedCents(listPrice: number, finish: string, oversized: boolean) {
  const factor = CABINET_PRICING.multiplier[finish as CabinetFinishId] ?? 1;
  return Math.round(listPrice * 100 * factor) + CABINET_PRICING.install[oversized ? "oversized" : "standard"] * 100;
}

export function quoteCabinets(finish: string, picks: Pick<CabinetPick, "sku" | "quantity">[]): CabinetQuote {
  const warnings: string[] = [];
  let cents = 0;
  for (const { sku, quantity } of picks) {
    const item = items.get(sku);
    const listPrice = supported.has(finish) && item && Object.hasOwn(item.prices, finish) ? item.prices[finish] : undefined;
    if (listPrice === undefined || !item) {
      warnings.push(`${sku} is unavailable in the selected finish.`);
      continue;
    }
    cents += installedCents(listPrice, finish, item.oversized) * quantity;
  }
  return { total: warnings.length ? null : cents / 100, warnings };
}

export function planningCabinetPrices(finish: CabinetFinishId) {
  function average(group: string, oversized = false) {
    const matches = framed.items.filter(item => item.group === group && Object.hasOwn(item.prices, finish));
    return matches.reduce((sum, item) => sum + installedCents((item.prices as Record<string, number>)[finish], finish, oversized), 0) / matches.length / 100;
  }
  return { base: average("base"), wall: average("wall"), oversized: average("pantry", true) };
}
