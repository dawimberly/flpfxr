/** Two-person crew, internal planning rate. Not payroll or a quote. */
export const CREW_DAY_RATE = 650;

/** Count complete four-day blocks; partial crew days round up first. */
export function adjustedCrewDays(baseDays: number): number {
  const days = Math.max(0, Math.ceil(Number.isFinite(baseDays) ? baseDays : 0));
  return days + Math.floor(days / 4);
}

/** Materials are passed through at cost, without automatic markup. */
export function planningEstimate(input: {
  baseCrewDays: number;
  materialsAtCost: number;
  otherProjectCosts?: number;
}): number {
  const { baseCrewDays, materialsAtCost, otherProjectCosts = 0 } = input;
  if (![baseCrewDays, materialsAtCost, otherProjectCosts].every(Number.isFinite) ||
      baseCrewDays < 0 || materialsAtCost < 0 || otherProjectCosts < 0) {
    throw new Error("Estimate quantities must be finite nonnegative numbers");
  }
  return adjustedCrewDays(baseCrewDays) * CREW_DAY_RATE + materialsAtCost + otherProjectCosts;
}


import {
  PROJECT_SERVICES, PROJECT_SIZES, FLOOR_MATERIALS, COUNTER_MATERIALS,
  SHOWER_MATERIALS, projectScope, type ProjectInputs,
} from "./public-estimate-options.ts";

/**
 * Material-only reference costs copied from dawimberly/flipfixer-estimator,
 * materials/catalog.json at 509583fcb2fc5c7d793f0374b6f9eac2a50a35e0.
 * Labor defaults from pricing/estimator.py: 0.08 person-hours/sq ft,
 * 0.15 person-hours/linear ft, 1.5 person-hours/item.
 * These are preliminary estimating assumptions, not current supplier quotes.
 * Do NOT substitute the employee catalog's installed rates and then add labor.
 */
const FLOOR_COST = { lvp: 3.85, tile: 4.25, wood: 6.50, carpet: 2.50 };
const COUNTER_COST = { quartz: 65, granite: 55, laminate: 28, butcher: 35 };
const SHOWER_COST = { ceramic: 5.50, porcelain: 6.25, stone: 18 };
const PERSON_HOURS_PER_UNIT = { area: 0.08, length: 0.15, item: 1.5 };
const PERSON_HOURS_PER_CREW_DAY = 2 * 8;

export function projectPlanningEstimate(input: ProjectInputs) {
  if (!PROJECT_SERVICES.some(s => s.id === input.service) ||
      !PROJECT_SIZES.includes(input.size) ||
      !Object.hasOwn(FLOOR_COST, input.floor) ||
      !Object.hasOwn(COUNTER_COST, input.counter) ||
      !Object.hasOwn(SHOWER_COST, input.shower) ||
      typeof input.prime !== "boolean" ||
      ![input.delivery, input.specialist].every(n => Number.isFinite(n) && n >= 0 && n <= 1000000)) {
    throw new Error("Invalid project selections or allowances");
  }
  const scope = projectScope(input.service, input.size);
  if (!scope) return null;
  let materials = 0;
  let hours = 0;
  const add = (quantity: number, unitCost: number, unit: keyof typeof PERSON_HOURS_PER_UNIT) => {
    materials += quantity * unitCost;
    hours += quantity * PERSON_HOURS_PER_UNIT[unit];
  };
  if (scope.floor) add(scope.floor, FLOOR_COST[input.floor], "area");
  if (scope.trim) add(scope.trim, 2.85, "length");
  if (scope.wall) {
    const exterior = input.service === "exterior-paint";
    add(scope.wall, exterior ? 0.55 : 0.45, "area");
    if (input.prime) add(scope.wall, exterior ? 0.28 : 0.22, "area");
  }
  if (input.service === "kitchen") {
    add(scope.base, 185, "item");
    add(scope.wallUnits, 145, "item");
    add(scope.counters, COUNTER_COST[input.counter], "area");
    add(scope.backsplash, 8.75, "area");
  }
  if (input.service === "bathroom") {
    add(1, scope.doubleVanity ? 620 : 289, "item");
    add(scope.shower, SHOWER_COST[input.shower], "area");
  }
  const baseCrewDays = hours / PERSON_HOURS_PER_CREW_DAY;
  const total = planningEstimate({
    baseCrewDays, materialsAtCost: materials,
    otherProjectCosts: input.delivery + input.specialist,
  });
  // Only the combined total is shown to customers; no daily-rate breakdown.
  return { total: Math.round(total), scope, materials: Math.round(materials * 100) / 100,
    baseCrewDays, adjustedDays: adjustedCrewDays(baseCrewDays) };
}

const dollars = (n: number) => new Intl.NumberFormat("en-US", {
  style: "currency", currency: "USD", maximumFractionDigits: 0,
}).format(n);

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
    `I'd like an on-site estimate for ${service.toLowerCase()} (${input.size.toLowerCase()} scope).`,
    result ? `Selections: ${selections}. ${result.scope.summary}` : "Please assess my custom project.",
    result ? `Preliminary estimate: ${dollars(result.total)}, including labor and project support. Delivery/shipping allowance: ${dollars(input.delivery)}; specialist/other allowance: ${dollars(input.specialist)}. ${result.scope.exclusions}` : "",
    "This is an estimate, not a quote. Please confirm measurements, selections, delivery and any additional work on site.",
  ].filter(Boolean).join(" ");
}
