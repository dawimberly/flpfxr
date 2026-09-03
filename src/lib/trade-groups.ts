import type { JobEstimate, JobLineItem, LineItem } from "@/lib/estimator";

/** Print order for By trade / Cost per item (who does the work). */
export const TRADE_ORDER = [
  "Flooring",
  "Tile",
  "Drywall",
  "Paint",
  "Trim",
  "Windows",
  "Doors",
  "Lighting",
  "Plumbing",
  "Cabinets",
  "Exterior",
  "Cleanup",
  "Other",
] as const;

export type TradeName = (typeof TRADE_ORDER)[number];

export const TRADE_NOTE =
  "Tile is a tile mason (floor tile, wall tile, curb, cement board, RedGard). Flooring is LVP, carpet, and other non-tile floors. Drywall is separate from paint. Trim is hang only; paint of trim is Paint. Cabinets are Northville; most other finishes are Floor & Decor / Home Depot / Lowe's installed units.";

type LineLike = Pick<LineItem, "description" | "category" | "kind" | "unitCost" | "lineTotal" | "quantity" | "unit">;

function haystack(line: LineLike) {
  return `${line.description} ${line.category}`.toLowerCase();
}

/** First-match trade assignment — who does the work, not catalog category alone. */
export function assignTrade(line: LineLike): TradeName {
  const text = haystack(line);
  const cat = line.category.toLowerCase();
  const desc = line.description.toLowerCase();

  // 1. Plumbing — reglaze, tub/surround redo, alcove tub (not tile work)
  if (/reglaze|alcove tub/.test(text) || (/tub/.test(desc) && /surround redo/.test(text))) {
    return "Plumbing";
  }
  if (cat.includes("plumbing")) {
    return "Plumbing";
  }

  // 2. Tile mason — includes tile floor
  if (
    /tile|redgard|waterproof|cement board|shower curb|grout|\bcbu\b/.test(text) ||
    cat.includes("tile") ||
    cat.includes("backsplash")
  ) {
    return "Tile";
  }

  // Exterior early — roof / insulation / attic only (do not match "siding" or
  // "exterior" inside window/door notes like "do not disturb exterior")
  if (cat.includes("roofing") || cat.includes("insulation") || cat.includes("decking")) {
    return "Exterior";
  }
  if (/roof patch|attic insulation|blown.?in insulation|\binsulation\b/.test(desc) && !/window|door|tile/.test(desc)) {
    return "Exterior";
  }
  if (cat.includes("siding") || cat.includes("gutters") || /gutter|fascia|soffit/.test(desc)) {
    return "Exterior";
  }

  // Doors before Paint — "painted steel" garage doors must not become Paint
  if (/sliding patio|garage door|interior door|door unit|door opener/.test(text) || cat.includes("doors")) {
    return "Doors";
  }

  // Drywall — popcorn / hang drywall / patch (not "Paint drywall")
  if (/popcorn/.test(text)) {
    return "Drywall";
  }
  if (/drywall/.test(text) && !/\bpaint\b|\bpaints\b|\bpainting\b|prime/.test(desc)) {
    return "Drywall";
  }
  if (/\bpatch\b/.test(text) && !/\bpaint\b|prime|seal/.test(text)) {
    return "Drywall";
  }
  if (cat.includes("drywall") && !/\bpaint\b|prime/.test(desc)) {
    return "Drywall";
  }

  // Paint — work verbs only (not the word "painted" in a product name)
  if (
    /\bpaint\b|\bpaints\b|\bpainting\b|prime|seal \(1 coat\)|seal \(1coat\)|seal and paint|seal & paint/.test(desc) ||
    /seal \(1 coat\)|seal and paint|seal & paint/.test(text)
  ) {
    return "Paint";
  }
  if (cat.includes("walls/paint") || cat.includes("exterior paint")) {
    return "Paint";
  }
  if (cat === "walls" || (cat === "ceiling" && /\bpaint\b|prime/.test(text))) {
    return "Paint";
  }

  // Trim — hang only
  if (/baseboard|casing|crown|quarter round/.test(text) || cat.includes("trim")) {
    return "Trim";
  }

  // Windows
  if (cat.includes("windows") || cat.includes("window treatments") || (/\bwindow\b/.test(text) && !/door/.test(text))) {
    return "Windows";
  }

  // Lighting / electrical
  if (/light|fan|fixture/.test(text) || cat.includes("lighting") || cat.includes("electrical")) {
    return "Lighting";
  }

  // Cabinets (vendor: Northville)
  if (
    cat.includes("cabinets") ||
    cat.includes("vanity") ||
    cat.includes("countertop") ||
    /cabinet|vanity|countertop|northville/.test(text)
  ) {
    return "Cabinets";
  }

  // Flooring before Cleanup — carpet removal/haul stays Flooring
  if (
    /vinyl plank|lvp|carpet|laminate|engineered|vinyl tile/.test(text) ||
    (cat.includes("flooring") && !/tile|cement board|cbu|redgard/.test(text))
  ) {
    return "Flooring";
  }

  // Cleanup
  if (/haul|debris|cleanup|\bclean\b/.test(text) || cat.includes("cleanup")) {
    return "Cleanup";
  }

  return "Other";
}

export function isLaborOnlyLine(line: LineLike) {
  if (line.kind === "labor") return true;
  return /labor only|owner supplied|owner-supplied/.test(haystack(line));
}

export function lineSource(line: LineLike): string {
  if (isLaborOnlyLine(line)) return "Labor only / owner supply";
  if (assignTrade(line) === "Cabinets" || /northville|cabinet|vanity|countertop/.test(haystack(line))) {
    return "Northville";
  }
  return "Floor & Decor / HD / Lowe's";
}

export type TradeTotal = {
  trade: TradeName;
  installed: number;
  op: number;
  total: number;
};

export type CostPerItemRow = {
  trade: TradeName;
  description: string;
  quantity: number;
  unit: string;
  unitCost: number;
  amount: number;
  source: string;
  laborOnly: boolean;
};

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function tradeTotals(job: JobEstimate): TradeTotal[] {
  const opRate = job.materialsSubtotal > 0 ? job.laborSubtotal / job.materialsSubtotal : 0;
  const buckets = new Map<TradeName, number>();
  for (const trade of TRADE_ORDER) buckets.set(trade, 0);

  for (const line of job.completeLineItems) {
    const trade = assignTrade(line);
    buckets.set(trade, (buckets.get(trade) ?? 0) + line.lineTotal);
  }

  return TRADE_ORDER.filter((trade) => (buckets.get(trade) ?? 0) > 0).map((trade) => {
    const installed = round2(buckets.get(trade) ?? 0);
    const op = round2(installed * opRate);
    return { trade, installed, op, total: round2(installed + op) };
  });
}

export function costPerItemRows(lines: JobLineItem[]): CostPerItemRow[] {
  const map = new Map<string, CostPerItemRow>();

  for (const line of lines) {
    const trade = assignTrade(line);
    const laborOnly = isLaborOnlyLine(line);
    const source = lineSource(line);
    const key = `${trade}|${line.description}|${line.unit}|${line.unitCost}|${source}|${laborOnly}`;
    const existing = map.get(key);
    if (existing) {
      existing.quantity = round2(existing.quantity + line.quantity);
      existing.amount = round2(existing.amount + line.lineTotal);
    } else {
      map.set(key, {
        trade,
        description: line.description,
        quantity: line.quantity,
        unit: line.unit,
        unitCost: line.unitCost,
        amount: line.lineTotal,
        source,
        laborOnly,
      });
    }
  }

  const rows = [...map.values()];
  rows.sort((a, b) => {
    const ai = TRADE_ORDER.indexOf(a.trade);
    const bi = TRADE_ORDER.indexOf(b.trade);
    if (ai !== bi) return ai - bi;
    return a.description.localeCompare(b.description);
  });
  return rows;
}
