import {
  PROJECT_SERVICES, PROJECT_SIZES, FLOOR_MATERIALS, COUNTER_MATERIALS,
  SHOWER_MATERIALS, projectScope, type ProjectInputs,
} from "./public-estimate-options.ts";

export const CREW_DAY_RATE = 650;
export const ALLOWANCE_CAP = 50000;
export const JOB_MINIMUM = 1500;
const PERSON_HOURS_PER_CREW_DAY = 16;
const PROJECT_SUPPORT = { Small: 250, Medium: 450, Large: 750 } as const;

/** Owner-specified person-hours, not crew-hours. Primer consumes half a pass. */
export const TRADE_HOURS = {
  tileFloor: 0.35, surroundTile: 0.5, lvp: 0.06,
  interiorPaintPerCoat: 0.03, exteriorPaint: 0.04, cabinetBox: 1.5,
  // TODO Jon: confirm these retained/provisional non-specified productivity assumptions.
  woodFloor: 0.08, carpetFloor: 0.08, trim: 0.15, countertop: 0.08,
  backsplashTile: 0.5, fixture: 1.5,
} as const;

/**
 * Last checked 2026-11-01 against the repository reference only, NOT supplier-verified.
 * Source: https://github.com/dawimberly/flipfixer-estimator/blob/509583fcb2fc5c7d793f0374b6f9eac2a50a35e0/materials/catalog.json
 * TODO Jon: current supplier quotes for all material entries below; confirm per-coat paint coverage.
 * Never substitute installed employee-catalog prices and then add crew labor.
 */
const FLOOR_COST = { lvp: 3.85, tile: 4.25, wood: 6.50, carpet: 2.50 };
const COUNTER_COST = { quartz: 65, granite: 55, laminate: 28, butcher: 35 };
const SHOWER_COST = { ceramic: 5.50, porcelain: 6.25, stone: 18 };
const REFERENCE_COST = {
  trim: 2.85, interiorPaint: 0.45, exteriorPaint: 0.55,
  interiorPrimer: 0.22, exteriorPrimer: 0.28,
  baseCabinet: 185, wallCabinet: 145, singleVanity: 289, doubleVanity: 620, backsplash: 8.75,
};
/**
 * Provisional budgeting allowances only; last reviewed 2026-11-01.
 * Source: UNKNOWN. TODO Jon: replace each with supplier cost/receipt and source/date.
 * Material quantities are net surface area; confirm waste, product coverage and substrate.
 */
export const BATH_SETTING_COST = { thinset: 0.75, grout: 0.50, backerBoard: 1.75, membrane: 1.50 };
export const BATH_FIXTURES = { Small: 750, Medium: 1000, Large: 1500 } as const;
// TODO Jon: actual demo person-hours by scope. No disposal charged here; support includes it.
const BATH_DEMO_HOURS = { Small: 8, Medium: 12, Large: 16 } as const;
const FINISH_COATS = 2;

export function adjustedCrewDays(baseDays: number): number {
  if (!Number.isFinite(baseDays) || baseDays < 0) throw new Error("Invalid base effort");
  const days = Math.ceil(baseDays);
  return days + Math.floor(days / 4) + (days < 4 ? 0.5 : 0);
}

export function planningEstimate(input: {
  baseCrewDays: number; materialsAtCost: number; otherProjectCosts?: number;
}): number {
  const { baseCrewDays, materialsAtCost, otherProjectCosts = 0 } = input;
  if (![baseCrewDays, materialsAtCost, otherProjectCosts].every(n => Number.isFinite(n) && n >= 0)) {
    throw new Error("Estimate quantities must be finite nonnegative numbers");
  }
  return adjustedCrewDays(baseCrewDays) * CREW_DAY_RATE + materialsAtCost + otherProjectCosts;
}

export function needsFabrication(input: Pick<ProjectInputs, "service" | "counter" | "shower">): boolean {
  return (input.service === "kitchen" && (input.counter === "quartz" || input.counter === "granite")) ||
    (input.service === "bathroom" && input.shower === "stone");
}

/** Keep raw text so an unfinished/invalid number can never become zero via HTML number coercion. */
export function parseAllowance(raw: string, required = false): { value: number | null; error: string | null } {
  const s = raw.trim();
  if (!s) return required ? { value: null, error: "Enter a fabrication/install allowance greater than $0." } :
    { value: 0, error: null };
  if (!/^(?:\d+(?:\.\d{0,2})?|\.\d{1,2})$/.test(s)) {
    return { value: null, error: "Enter a numeric dollar amount with up to two decimal places." };
  }
  const value = Number(s);
  if (!Number.isFinite(value) || value < 0 || value > ALLOWANCE_CAP || (required && value === 0)) {
    return { value: null, error: required ? "Enter an amount greater than $0 and no more than $50,000." :
      "Enter an amount from $0 to $50,000." };
  }
  return { value, error: null };
}

function validate(input: ProjectInputs) {
  if (!input || !PROJECT_SERVICES.some(s => s.id === input.service) ||
      !PROJECT_SIZES.includes(input.size) ||
      !Object.hasOwn(FLOOR_COST, input.floor) || !Object.hasOwn(COUNTER_COST, input.counter) ||
      !Object.hasOwn(SHOWER_COST, input.shower) || typeof input.prime !== "boolean" ||
      ![input.delivery, input.specialist].every(n => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= ALLOWANCE_CAP) ||
      (input.fabrication !== null && (typeof input.fabrication !== "number" || !Number.isFinite(input.fabrication) ||
        input.fabrication < 0 || input.fabrication > ALLOWANCE_CAP))) {
    throw new Error("Invalid project selections or allowances");
  }
  if (needsFabrication(input) && (input.fabrication === null || input.fabrication <= 0)) {
    throw new Error("Fabrication/install allowance is required for selected stone");
  }
}

export function projectPlanningEstimate(input: ProjectInputs) {
  validate(input);
  const scope = projectScope(input.service, input.size);
  if (!scope) return null;
  const lines: { id: string; materials: number; personHours: number }[] = [];
  const add = (id: string, quantity: number, unitCost: number, hoursPerUnit: number) =>
    lines.push({ id, materials: quantity * unitCost, personHours: quantity * hoursPerUnit });
  const floorHours = { lvp: TRADE_HOURS.lvp, tile: TRADE_HOURS.tileFloor,
    wood: TRADE_HOURS.woodFloor, carpet: TRADE_HOURS.carpetFloor };
  if (scope.floor) add("floor", scope.floor, FLOOR_COST[input.floor], floorHours[input.floor]);
  if (scope.trim) add("trim", scope.trim, REFERENCE_COST.trim, TRADE_HOURS.trim);
  if (scope.wall) {
    const exterior = input.service === "exterior-paint";
    // Interior assumes two finish coats; exterior rate is one specified painting pass.
    // TODO Jon: confirm exterior coating system and whether an additional finish coat is needed.
    const coats = exterior ? 1 : FINISH_COATS;
    const labor = exterior ? TRADE_HOURS.exteriorPaint : TRADE_HOURS.interiorPaintPerCoat;
    add("paint", scope.wall, (exterior ? REFERENCE_COST.exteriorPaint : REFERENCE_COST.interiorPaint) * coats, labor * coats);
    if (input.prime) add("primer", scope.wall,
      exterior ? REFERENCE_COST.exteriorPrimer : REFERENCE_COST.interiorPrimer, labor * 0.5);
  }
  if (input.service === "kitchen") {
    add("base-cabinets", scope.base, REFERENCE_COST.baseCabinet, TRADE_HOURS.cabinetBox);
    add("wall-cabinets", scope.wallUnits, REFERENCE_COST.wallCabinet, TRADE_HOURS.cabinetBox);
    const stone = input.counter === "quartz" || input.counter === "granite";
    add("counter", scope.counters, COUNTER_COST[input.counter], stone ? 0 : TRADE_HOURS.countertop);
    add("backsplash", scope.backsplash, REFERENCE_COST.backsplash, TRADE_HOURS.backsplashTile);
  }
  if (input.service === "bathroom") {
    add("vanity", 1, scope.doubleVanity ? REFERENCE_COST.doubleVanity : REFERENCE_COST.singleVanity, TRADE_HOURS.cabinetBox);
    add("surround", scope.shower, SHOWER_COST[input.shower], input.shower === "stone" ? 0 : TRADE_HOURS.surroundTile);
    const tileArea = scope.shower + (input.floor === "tile" ? scope.floor : 0);
    // Prep/setting labor is covered by the tile productivity allowance, not added again.
    for (const [name, cost] of Object.entries(BATH_SETTING_COST)) add(name, tileArea, cost, 0);
    add("fixture-allowance", 1, BATH_FIXTURES[input.size], TRADE_HOURS.fixture * 3);
    add("demolition", 1, 0, BATH_DEMO_HOURS[input.size]);
  }
  const materials = lines.reduce((sum, row) => sum + row.materials, 0);
  const hours = lines.reduce((sum, row) => sum + row.personHours, 0);
  const baseCrewDays = hours / PERSON_HOURS_PER_CREW_DAY;
  const adjustedDays = adjustedCrewDays(baseCrewDays);
  const labor = adjustedDays * CREW_DAY_RATE;
  const jobSubtotal = Math.max(JOB_MINIMUM, materials + labor);
  const support = PROJECT_SUPPORT[input.size];
  // Inactive fabrication values never leak into another project type.
  const fabrication = needsFabrication(input) ? input.fabrication! : 0;
  const total = jobSubtotal + support + input.delivery + input.specialist + fabrication;
  const low = Math.round(total / 100) * 100;
  const high = Math.round(total * 1.25 / 100) * 100;
  return { total, low, high, scope, materials, baseCrewDays, adjustedDays, labor, support,
    fabrication, lines, minimumAdjustment: jobSubtotal - materials - labor };
}

const dollars = (n: number) => new Intl.NumberFormat("en-US", {
  style: "currency", currency: "USD", maximumFractionDigits: 0,
}).format(n);
export const formatEstimateRange = (result: { low: number; high: number }) =>
  dollars(result.low) + "-" + dollars(result.high);

export function projectEstimateLeadMessage(input: ProjectInputs): string {
  const result = projectPlanningEstimate(input);
  const service = PROJECT_SERVICES.find(s => s.id === input.service)!.label;
  const selections = [
    result?.scope.floor ? FLOOR_MATERIALS.find(m => m.id === input.floor)!.label : "",
    input.service === "kitchen" ? COUNTER_MATERIALS.find(m => m.id === input.counter)!.label + " counters" : "",
    input.service === "bathroom" ? SHOWER_MATERIALS.find(m => m.id === input.shower)!.label + " surround" : "",
    result?.scope.wall ? (input.prime ? "Primer and paint" : "Paint only") : "",
  ].filter(Boolean).join(", ");
  return [
    `Project: ${service}. Size: ${input.size}. Materials: ${selections || "To be selected"}.`,
    result ? `Preliminary estimate: ${formatEstimateRange(result)}.` : "On-site estimate requested.",
    "This is an estimate, not a quote.",
  ].join(" ");
}
