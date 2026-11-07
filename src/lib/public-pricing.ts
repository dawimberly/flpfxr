import { planningCabinetPrices } from "./cabinet-pricing.server.ts";
import { CABINET_FINISHES } from "./public-cabinet-finishes.ts";
import {
  PROJECT_SERVICES, PROJECT_SIZES, FLOOR_MATERIALS, COUNTER_MATERIALS,
  SHOWER_MATERIALS, projectScope, scopeAreaError, selectedVanity, getVanity,
  effectiveIncludeFlooring,
  type ProjectInputs, type ScopeAreas,
} from "./public-estimate-options.ts";
import { priceOffList, CUSTOMER_LIST_DISCOUNT, FILLER_STRIPS, INCLUDED_FILLER_SKU, VANITY_LIST_PRICES } from "./public-estimate-costs.server.ts";
import { formatEstimateRange, PRELIMINARY_ESTIMATE_WORDING } from "./public-estimate-display.ts";
export { formatEstimateRange, PRELIMINARY_ESTIMATE_WORDING };

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
 * TODO Jon: current supplier quotes for laminate, butcher block, tile and paint. Never substitute
 * installed employee-catalog prices and then add crew labor.
 */
const FLOOR_COST = { lvp: 3.85, tile: 4.25, wood: 6.50, carpet: 2.50 };
const COUNTER_MATERIAL_COST = { laminate: 28, butcher: 35 };
const SHOWER_MATERIAL_COST = { ceramic: 5.50, porcelain: 6.25 };
const REFERENCE_COST = {
  trim: 2.85, interiorPaint: 0.45, exteriorPaint: 0.55,
  interiorPrimer: 0.22, exteriorPrimer: 0.28,
  backsplash: 8.75,
};

/**
 * Typical slab face. market estimate, not supplier-verified.
 * Angi (updated Jul 20, 2026): "Quartz is often sold in slabs around 120-by-55 inches."
 * https://www.angi.com/articles/how-much-do-quartz-countertops-cost.htm
 * 120 × 55 / 144 = 45.833 sq ft, rounded to the nearest square foot.
 */
export const SLAB_SQFT = 46;

/**
 * Pieces this size or smaller may use remnant pricing. Kitchens always buy full slabs.
 * Angi (2026) lists a bathroom vanity at 6–10 sq ft.
 * https://www.angi.com/articles/how-much-does-it-cost-install-countertops.htm
 * TODO Jon: confirm the small-surround cutoff. No published remnant cutoff was found.
 */
export const SMALL_PIECE_SQFT = 10;

/**
 * Installed quartz, material + fabrication + install. market estimate, not supplier-verified.
 * HomeAdvisor quartz guide (updated Jun 19, 2026): commercial-grade quartz is $60–$80 per sq ft
 * including materials and labor. This constant is the midpoint, $70.
 * https://www.homeadvisor.com/cost/cabinets-and-countertops/quartz-countertops/
 */
export const QUARTZ_INSTALLED_PER_SQFT = 70;

/**
 * Installed granite, material + fabrication + install. market estimate, not supplier-verified.
 * HomeAdvisor granite guide (updated Jun 20, 2026): material $40–$60 per sq ft, and installer
 * labor "$35 per square foot installed." Midpoint material ($50) plus that labor rate.
 * https://www.homeadvisor.com/cost/cabinets-and-countertops/install-granite-countertops/
 */
export const GRANITE_INSTALLED_PER_SQFT = 85;

/**
 * Installed stone-slab shower walls, material + fabrication + install. market estimate, not supplier-verified.
 * Archie Remodels, "Marble Shower Cost": installed slab showers commonly fall in the $60–$180 per sq ft range.
 * This constant is the midpoint, $120.
 * https://archieremodels.com/marble-shower-cost-what-expect-marble-shower-walls/
 * TODO Jon: that page is marble slab showers. Replace if the yard's stone species differs.
 */
export const STONE_SLAB_INSTALLED_PER_SQFT = 120;

/**
 * Lower rate for very small pieces only. market estimate, not supplier-verified.
 * Subject to availability. This is not a promise that a remnant is in stock.
 * HomeAdvisor quartz guide: builder's-grade quartz is $50–$60 per sq ft including materials and labor.
 * The low end is used. TODO Jon: no public remnant price list was found; use the stone-yard price.
 * https://www.homeadvisor.com/cost/cabinets-and-countertops/quartz-countertops/
 */
export const REMNANT_MAY_BE_AVAILABLE_PER_SQFT = 50;

/**
 * Licensed plumber labor for the shower valve. market estimate, not supplier-verified.
 * Angi (updated Oct 13, 2026): about $225 when a plumbing repair pro does the labor.
 * Valve/trim product stays in the fixture supply allowance. This line is labor only, with no crew hours.
 * TODO Jon: confirm the fixture allowance does not already include plumber labor.
 * https://www.angi.com/articles/how-much-should-it-cost-replace-bathroom-tub-valve.htm
 */
export const LICENSED_PLUMBER_VALVE_ALLOWANCE = 225;

/**
 * Provisional budgeting allowances only; last reviewed 2026-11-01.
 * Source: UNKNOWN. TODO Jon: replace each with supplier cost/receipt and source/date.
 * Material quantities are net surface area; confirm waste, product coverage and substrate.
 */
export const BATH_SETTING_COST = { thinset: 0.75, grout: 0.50, backerBoard: 1.75, membrane: 1.50 };
export const BATH_FIXTURES = { Small: 750, Medium: 1000, Large: 1500 } as const;
// TODO Jon: actual demo person-hours by scope. No disposal charged here; support includes it.
const BATH_DEMO_HOURS = { Small: 8, Medium: 12, Large: 16 } as const;
/** Provisional, same basic-finish schedule as bathrooms. TODO Jon: confirm kitchen demo hours. */
const KITCHEN_DEMO_HOURS = { Small: 8, Medium: 12, Large: 16 } as const;
const FINISH_COATS = 2;
/** Toilet and vanity faucet stay on the crew. The shower valve does not. */
const CREW_FIXTURE_ITEMS = 2;

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

/** Full slabs above the small-piece threshold. Counters and surrounds at or under that threshold can use remnant pricing. */
export function stoneCoverage(areaSqft: number, alwaysFullSlab: boolean): { billableSqft: number; remnant: boolean } {
  if (!Number.isFinite(areaSqft) || areaSqft < 0) throw new Error("Invalid stone area");
  if (areaSqft === 0) return { billableSqft: 0, remnant: false };
  if (!alwaysFullSlab && areaSqft <= SMALL_PIECE_SQFT) {
    return { billableSqft: areaSqft, remnant: true };
  }
  const slabs = Math.max(1, Math.ceil(areaSqft / SLAB_SQFT));
  return { billableSqft: slabs * SLAB_SQFT, remnant: false };
}

function stoneRate(kind: "quartz" | "granite" | "stone", remnant: boolean): number {
  if (remnant) return REMNANT_MAY_BE_AVAILABLE_PER_SQFT;
  if (kind === "quartz") return QUARTZ_INSTALLED_PER_SQFT;
  if (kind === "granite") return GRANITE_INSTALLED_PER_SQFT;
  return STONE_SLAB_INSTALLED_PER_SQFT;
}

/** Keep raw text so an unfinished/invalid number can never become zero via HTML number coercion. */
export function parseAllowance(raw: string, required = false): { value: number | null; error: string | null } {
  const s = raw.trim().replace(/[$,]/g, "").replace(/\s+/g, "");
  if (!s) return required ? { value: null, error: "Enter an amount greater than $0 and no more than $50,000." } :
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

function validCounter(counter: string): counter is ProjectInputs["counter"] {
  return counter in COUNTER_MATERIAL_COST || counter === "quartz" || counter === "granite";
}
function validShower(shower: string): shower is ProjectInputs["shower"] {
  return shower in SHOWER_MATERIAL_COST || shower === "stone";
}

function validate(input: ProjectInputs) {
  if (!input || !PROJECT_SERVICES.some(s => s.id === input.service) ||
      !PROJECT_SIZES.includes(input.size) ||
      !Object.hasOwn(FLOOR_COST, input.floor) || !validCounter(input.counter) ||
      !validShower(input.shower) ||
      (input.cabinetFinish !== undefined && !CABINET_FINISHES.some(finish => finish.id === input.cabinetFinish)) || (input.vanity != null && !getVanity(input.vanity)) ||
      typeof input.newToilet !== "boolean" || typeof input.prime !== "boolean" ||
      typeof input.includeFlooring !== "boolean" ||
      (input.exteriorCoats !== 1 && input.exteriorCoats !== 2) ||
      ![input.delivery, input.specialist].every(n => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= ALLOWANCE_CAP)) {
    throw new Error("Invalid project selections or allowances");
  }
}

type Line = { id: string; materials: number; personHours: number };

function buildLines(input: ProjectInputs, scope: NonNullable<ReturnType<typeof projectScope>>): { lines: Line[]; remnantStone: boolean } {
  const lines: Line[] = [];
  const add = (id: string, quantity: number, unitCost: number, hoursPerUnit: number) =>
    lines.push({ id, materials: quantity * unitCost, personHours: quantity * hoursPerUnit });
  const floorHours = { lvp: TRADE_HOURS.lvp, tile: TRADE_HOURS.tileFloor,
    wood: TRADE_HOURS.woodFloor, carpet: TRADE_HOURS.carpetFloor };
  const includeFloor = effectiveIncludeFlooring(input);
  // Floor covering dollars and install hours are a separable line. Kitchen/bath room
  // area still drives wall/trim/backsplash scaling when flooring is opted out.
  if (includeFloor && scope.floor) add("floor", scope.floor, FLOOR_COST[input.floor], floorHours[input.floor]);
  if (scope.trim) add("trim", scope.trim, REFERENCE_COST.trim, TRADE_HOURS.trim);
  if (scope.wall) {
    const exterior = input.service === "exterior-paint";
    const coats = exterior ? input.exteriorCoats : FINISH_COATS;
    const labor = exterior ? TRADE_HOURS.exteriorPaint : TRADE_HOURS.interiorPaintPerCoat;
    add("paint", scope.wall, (exterior ? REFERENCE_COST.exteriorPaint : REFERENCE_COST.interiorPaint) * coats, labor * coats);
    if (input.prime) add("primer", scope.wall,
      exterior ? REFERENCE_COST.exteriorPrimer : REFERENCE_COST.interiorPrimer, labor * 0.5);
  }
  let remnantStone = false;
  if (input.service === "kitchen") {
    const cabinets = planningCabinetPrices(input.cabinetFinish ?? "ew");
    add("base-cabinets", scope.base, cabinets.base, 0);
    add("wall-cabinets", scope.wallUnits, cabinets.wall, 0);
    if (scope.xlFridgeBoxes > 0) {
      add("xl-fridge", scope.xlFridgeBoxes, cabinets.oversized, 0);
    }
    if (input.counter === "quartz" || input.counter === "granite") {
      const coverage = stoneCoverage(scope.counters, scope.counters > SMALL_PIECE_SQFT);
      remnantStone = coverage.remnant;
      add("counter", coverage.billableSqft, stoneRate(input.counter, coverage.remnant), 0);
    } else {
      add("counter", scope.counters, COUNTER_MATERIAL_COST[input.counter], TRADE_HOURS.countertop);
    }
    add("backsplash", scope.backsplash, REFERENCE_COST.backsplash, TRADE_HOURS.backsplashTile);
    add("demolition", 1, 0, KITCHEN_DEMO_HOURS[input.size]);
  }
  if (input.service === "bathroom") {
    const vanity = selectedVanity(input.size, input.vanity);
    add("vanity", 1, priceOffList(VANITY_LIST_PRICES[vanity.id], CUSTOMER_LIST_DISCOUNT), TRADE_HOURS.cabinetBox);
    if (input.counter === "quartz" || input.counter === "granite") {
      add("counter", scope.counters, stoneRate(input.counter, false), 0);
    } else {
      add("counter", scope.counters, COUNTER_MATERIAL_COST[input.counter], TRADE_HOURS.countertop);
    }
    const filler = FILLER_STRIPS.find(row => row.sku === INCLUDED_FILLER_SKU)!;
    add("filler", 1, priceOffList(filler.list, CUSTOMER_LIST_DISCOUNT), 0);
    if (input.shower === "stone") {
      const coverage = stoneCoverage(scope.shower, false);
      remnantStone = coverage.remnant;
      add("surround", coverage.billableSqft, stoneRate("stone", coverage.remnant), 0);
    } else {
      add("surround", scope.shower, SHOWER_MATERIAL_COST[input.shower], TRADE_HOURS.surroundTile);
    }
    // Slab install is already in the stone rate. Tile setting stays on ceramic, porcelain and tiled floors.
    const tiledSurround = input.shower === "stone" ? 0 : scope.shower;
    const tiledFloor = includeFloor && input.floor === "tile" ? scope.floor : 0;
    const tileArea = tiledSurround + tiledFloor;
    for (const [name, cost] of Object.entries(BATH_SETTING_COST)) add(name, tileArea, cost, 0);
    // Allowance covers a toilet, vanity faucet, and shower valve trim. Skipping the toilet drops one third.
    const fixtureShare = input.newToilet ? 1 : 2 / 3;
    const fixtureItems = input.newToilet ? CREW_FIXTURE_ITEMS : 1;
    add("fixture-allowance", 1, Math.round(BATH_FIXTURES[input.size] * fixtureShare * 100) / 100, TRADE_HOURS.fixture * fixtureItems);
    add("licensed-plumber-valve", 1, LICENSED_PLUMBER_VALVE_ALLOWANCE, 0);
    add("demolition", 1, 0, BATH_DEMO_HOURS[input.size]);
  }
  return { lines, remnantStone };
}

function finalize(input: ProjectInputs, scope: NonNullable<ReturnType<typeof projectScope>>, lines: Line[], remnantStone: boolean) {
  const materials = lines.reduce((sum, row) => sum + row.materials, 0);
  const hours = lines.reduce((sum, row) => sum + row.personHours, 0);
  const baseCrewDays = hours / PERSON_HOURS_PER_CREW_DAY;
  const adjustedDays = adjustedCrewDays(baseCrewDays);
  const labor = adjustedDays * CREW_DAY_RATE;
  const jobSubtotal = Math.max(JOB_MINIMUM, materials + labor);
  const support = PROJECT_SUPPORT[input.size];
  const total = jobSubtotal + support + input.delivery + input.specialist;
  const low = Math.round(total / 100) * 100;
  const high = Math.round(total * 1.25 / 100) * 100;
  return { total, low, high, scope, materials, baseCrewDays, adjustedDays, labor, support,
    lines, remnantStone, minimumAdjustment: jobSubtotal - materials - labor };
}

function areasFrom(input: ProjectInputs): ScopeAreas {
  const areas: ScopeAreas = {};
  if (input.floorSqft !== undefined) areas.floorSqft = input.floorSqft;
  if (input.showerSqft !== undefined) areas.showerSqft = input.showerSqft;
  if (input.counterSqft !== undefined) areas.counterSqft = input.counterSqft;
  if (input.roomSqft !== undefined) areas.roomSqft = input.roomSqft;
  if (input.cabinetBoxes !== undefined) areas.cabinetBoxes = input.cabinetBoxes;
  if (input.xlFridgeBoxes !== undefined) areas.xlFridgeBoxes = input.xlFridgeBoxes;
  return areas;
}

export function projectPlanningEstimate(input: ProjectInputs) {
  validate(input);
  const areas = areasFrom(input);
  if (scopeAreaError(input.service, areas)) return null;
  const scope = projectScope(input.service, input.size, areas, input.vanity);
  if (!scope) return null;
  const built = buildLines(input, scope);
  let result = finalize(input, scope, built.lines, built.remnantStone);
  const stoneKitchen = input.service === "kitchen" && (input.counter === "quartz" || input.counter === "granite");
  const stoneBath = input.service === "bathroom" && input.shower === "stone";
  if (stoneKitchen || stoneBath) {
    const alternate = stoneKitchen ? { ...input, counter: "laminate" as const } : { ...input, shower: "ceramic" as const };
    const altScope = projectScope(alternate.service, alternate.size, areasFrom(alternate), alternate.vanity)!;
    const alt = finalize(alternate, altScope, buildLines(alternate, altScope).lines, false);
    const stoneLine = built.lines.find(row => row.id === (stoneKitchen ? "counter" : "surround"));
    // Installed stone includes fabrication labor, so a day-boundary drop must not undercut laminate or ceramic.
    for (let pass = 0; pass < 3 && stoneLine && result.total < alt.total; pass++) {
      stoneLine.materials += alt.total - result.total;
      result = finalize(input, scope, built.lines, built.remnantStone);
    }
  }
  return result;
}

export function projectEstimateLeadMessage(input: ProjectInputs): string {
  const result = projectPlanningEstimate(input);
  const service = PROJECT_SERVICES.find(s => s.id === input.service)!.label;
  const includeFloor = effectiveIncludeFlooring(input);
  const selections = [
    includeFloor && result?.scope.floor ? FLOOR_MATERIALS.find(m => m.id === input.floor)!.label : "",
    input.service === "kitchen" || input.service === "bathroom"
      ? COUNTER_MATERIALS.find(m => m.id === input.counter)!.label + " counters" : "",
    input.service === "bathroom" ? SHOWER_MATERIALS.find(m => m.id === input.shower)!.label + " shower wall" : "",
    input.service === "kitchen" ? CABINET_FINISHES.find(finish => finish.id === (input.cabinetFinish ?? "ew"))?.name ?? "" : "",
    input.service === "bathroom" ? selectedVanity(input.size, input.vanity).label : "",
    input.service === "bathroom" ? (input.newToilet ? "New toilet" : "Existing toilet") : "",
    result?.scope.wall ? (input.prime ? "Primer and paint" : "Paint only") : "",
    input.service === "exterior-paint" ? (input.exteriorCoats === 2 ? "2 coats" : "1 coat (standard)") : "",
  ].filter(Boolean).join(", ");
  const flooringStatus = input.service === "kitchen" || input.service === "bathroom"
    ? (includeFloor ? "Replacing flooring." : "Keeping existing flooring.")
    : "";
  return [
    `Project: ${service}. Size: ${input.size}. Materials: ${selections || "To be selected"}.`,
    flooringStatus,
    result ? `Preliminary estimate: ${formatEstimateRange(result)}.` : "On-site estimate requested.",
    PRELIMINARY_ESTIMATE_WORDING,
  ].filter(Boolean).join(" ");
}
