export type LineAct = "rr" | "r" | "plus";

export const LINE_ACTS: { id: LineAct; code: string; label: string }[] = [
  { id: "rr", code: "R&R", label: "Remove & replace" },
  { id: "r", code: "R", label: "Remove only" },
  { id: "plus", code: "+", label: "Install only" },
];

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

export function isRemoveOnlySku(name: string) {
  return /tear-?off|removal|haul-?off|scrape only|detach|pull-?off/i.test(name);
}

export function defaultLineAct(name: string): LineAct {
  return isRemoveOnlySku(name) ? "r" : "plus";
}

export function normalizeLineAct(act: string | null | undefined, name: string): LineAct {
  if (act === "rr" || act === "r" || act === "plus") {
    if (isRemoveOnlySku(name) && act !== "r") return "r";
    return act;
  }
  return defaultLineAct(name);
}

export function actCode(act: LineAct) {
  return LINE_ACTS.find((item) => item.id === act)?.code ?? "+";
}

export function actLabel(act: LineAct) {
  return LINE_ACTS.find((item) => item.id === act)?.label ?? "Install only";
}

export function actDescription(name: string, act: LineAct) {
  return `${actCode(act)} ${name}`;
}

type Priced = { name: string; cost_per_unit: number; remove_cost_per_unit?: number };

export function actUnitCost(option: Priced, act: LineAct) {
  if (isRemoveOnlySku(option.name)) {
    return act === "plus" ? 0 : option.cost_per_unit;
  }
  const install = option.cost_per_unit;
  const remove = option.remove_cost_per_unit ?? 0;
  if (act === "plus") return install;
  if (act === "r") return remove;
  return round2(install + remove);
}
