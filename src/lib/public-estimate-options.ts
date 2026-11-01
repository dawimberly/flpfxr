/** Public scope examples, not measured takeoffs or fixed bids. */
export const PROJECT_SIZES = ["Small", "Medium", "Large"] as const;
export type ProjectSize = typeof PROJECT_SIZES[number];
export const PROJECT_SERVICES = [
  { id: "kitchen", label: "Kitchen remodeling" },
  { id: "bathroom", label: "Bathroom remodeling" },
  { id: "flooring", label: "Flooring" },
  { id: "interior-paint", label: "Interior painting" },
  { id: "exterior-paint", label: "Exterior painting" },
  { id: "custom", label: "Handyman / outdoor / other" },
] as const;
export type ProjectService = typeof PROJECT_SERVICES[number]["id"];
export const FLOOR_MATERIALS = [
  { id: "lvp", label: "Luxury vinyl plank" },
  { id: "tile", label: "Tile" },
  { id: "wood", label: "Engineered hardwood" },
  { id: "carpet", label: "Carpet" },
] as const;
export const COUNTER_MATERIALS = [
  { id: "quartz", label: "Quartz" },
  { id: "granite", label: "Granite" },
  { id: "laminate", label: "Laminate" },
  { id: "butcher", label: "Butcher block" },
] as const;
export const SHOWER_MATERIALS = [
  { id: "ceramic", label: "Ceramic tile" },
  { id: "porcelain", label: "Porcelain tile" },
  { id: "stone", label: "Stone slab" },
] as const;
export type ExteriorCoats = 1 | 2;
export type ProjectInputs = {
  service: ProjectService;
  size: ProjectSize;
  floor: typeof FLOOR_MATERIALS[number]["id"];
  counter: typeof COUNTER_MATERIALS[number]["id"];
  shower: typeof SHOWER_MATERIALS[number]["id"];
  prime: boolean;
  /** Exterior finish coats. 1 is the standard. Ignored for every other project type. */
  exteriorCoats: ExteriorCoats;
  delivery: number;
  specialist: number;
  /** Measured areas. Leave unset to price the size example. */
  floorSqft?: number | null;
  showerSqft?: number | null;
  counterSqft?: number | null;
  roomSqft?: number | null;
};
export const DEFAULT_PROJECT_INPUTS: ProjectInputs = {
  service: "kitchen", size: "Medium", floor: "lvp", counter: "quartz",
  shower: "ceramic", prime: true, exteriorCoats: 1, delivery: 0, specialist: 0,
};
/** Optional measured areas. Omit a key to keep the size example. Null means the box was left blank. */
export type ScopeAreas = {
  floorSqft?: number | null;
  showerSqft?: number | null;
  counterSqft?: number | null;
  roomSqft?: number | null;
};
export const AREA_LIMITS = {
  bathroomFloor: { min: 20, max: 300, label: "a bathroom floor" },
  bathroomShower: { min: 0, max: 200, label: "a shower or tub surround" },
  kitchenFloor: { min: 60, max: 600, label: "a kitchen floor" },
  kitchenCounter: { min: 1, max: 200, label: "countertops" },
  flooring: { min: 20, max: 2500, label: "a floor area" },
  interiorPaint: { min: 50, max: 5000, label: "an interior area to paint" },
  exteriorPaint: { min: 100, max: 8000, label: "an exterior area to paint" },
} as const;
const rangeMessage = (limit: { min: number; max: number; label: string }) =>
  `Enter ${limit.label} between ${limit.min} and ${limit.max} sq ft.`;
function outOfRange(value: number | null | undefined, limit: { min: number; max: number; label: string }, optional: boolean) {
  if (value == null) return optional ? null : rangeMessage(limit);
  if (!Number.isFinite(value) || value < limit.min || value > limit.max) return rangeMessage(limit);
  return null;
}
/** Friendly copy when a typed area is outside the planning range. Preset-only calls have no error. */
export function scopeAreaError(service: ProjectService, areas: ScopeAreas = {}): string | null {
  const mentioned = (["floorSqft", "showerSqft", "counterSqft", "roomSqft"] as const).some(key => Object.hasOwn(areas, key));
  if (!mentioned || service === "custom") return null;
  if (service === "bathroom") {
    return outOfRange(areas.floorSqft, AREA_LIMITS.bathroomFloor, false) ??
      outOfRange(areas.showerSqft, AREA_LIMITS.bathroomShower, true);
  }
  if (service === "kitchen") {
    return outOfRange(areas.floorSqft, AREA_LIMITS.kitchenFloor, false) ??
      outOfRange(areas.counterSqft, AREA_LIMITS.kitchenCounter, true);
  }
  if (service === "flooring") return outOfRange(areas.roomSqft, AREA_LIMITS.flooring, false);
  if (service === "interior-paint") return outOfRange(areas.roomSqft, AREA_LIMITS.interiorPaint, false);
  if (service === "exterior-paint") return outOfRange(areas.roomSqft, AREA_LIMITS.exteriorPaint, false);
  return null;
}
export function parseSqft(raw: string): { value: number | null; error: string | null } {
  const s = raw.trim().replace(/,/g, "");
  if (!s) return { value: null, error: null };
  if (!/^(?:\d+(?:\.\d{0,2})?|\.\d{1,2})$/.test(s)) {
    return { value: null, error: "Use a number of square feet, like 168 or 40.5." };
  }
  const value = Number(s);
  if (!Number.isFinite(value)) return { value: null, error: "Use a number of square feet, like 168 or 40.5." };
  return { value, error: null };
}
const sqftText = (n: number) => {
  const tenths = Math.round(n * 10) / 10;
  return Number.isInteger(tenths) ? String(tenths) : tenths.toFixed(1);
};
const scaleFrom = (presetValue: number, presetBase: number, actualBase: number) =>
  actualBase === presetBase ? presetValue : presetValue * actualBase / presetBase;
export function projectScope(service: ProjectService, size: ProjectSize, areas: ScopeAreas = {}) {
  const i = PROJECT_SIZES.indexOf(size);
  if (i < 0) throw new Error("Invalid project size");
  const bath = [
    { floor: 40, wall: 190, trim: 26, shower: 60, vanity: "30-inch vanity" },
    { floor: 80, wall: 270, trim: 36, shower: 80, vanity: "30-inch vanity" },
    { floor: 120, wall: 330, trim: 44, shower: 100, vanity: "60-inch double vanity" },
  ][i];
  const kitchen = [
    { floor: 120, wall: 300, trim: 44, counters: 32, backsplash: 20, base: 6, wallUnits: 6 },
    { floor: 168, wall: 350, trim: 52, counters: 40, backsplash: 30, base: 8, wallUnits: 8 },
    { floor: 256, wall: 420, trim: 64, counters: 60, backsplash: 40, base: 10, wallUnits: 10 },
  ][i];
  switch (service) {
    case "bathroom": {
      const floor = areas.floorSqft == null ? bath.floor : areas.floorSqft;
      const wall = scaleFrom(bath.wall, bath.floor, floor);
      const trim = scaleFrom(bath.trim, bath.floor, floor);
      const shower = areas.showerSqft == null ? scaleFrom(bath.shower, bath.floor, floor) : areas.showerSqft;
      const surroundNote = areas.showerSqft == null ? ", scaled from that example because none was entered" : "";
      return {
        floor, wall, trim, shower, counters: 0, backsplash: 0, base: 0, wallUnits: 0, doubleVanity: i === 2,
        summary: `Example: ${sqftText(floor)} sq ft bathroom, ${sqftText(shower)} sq ft surround, ${bath.vanity}, floor, trim, wall paint, demolition, setting materials, waterproofing and a basic fixture allowance.`,
        assumptions: `Using ${sqftText(floor)} sq ft of floor. Walls (${sqftText(wall)} sq ft) and trim (${sqftText(trim)} ft) are scaled from the ${size} example. Surround is ${sqftText(shower)} sq ft${surroundNote}. Vanity, fixtures and demolition stay with the ${size} example.`,
        exclusions: "Existing layout retained. Basic finish demolition and shower waterproofing materials included. Plumbing relocation, electrical, permits and concealed repairs require separate allowances.",
      };
    }
    case "kitchen": {
      const floor = areas.floorSqft == null ? kitchen.floor : areas.floorSqft;
      const wall = scaleFrom(kitchen.wall, kitchen.floor, floor);
      const trim = scaleFrom(kitchen.trim, kitchen.floor, floor);
      const backsplash = scaleFrom(kitchen.backsplash, kitchen.floor, floor);
      const counters = areas.counterSqft == null ? scaleFrom(kitchen.counters, kitchen.floor, floor) : areas.counterSqft;
      const counterNote = areas.counterSqft == null ? ", scaled from that example because none were entered" : "";
      return {
        floor, wall, trim, shower: 0, counters, backsplash, base: kitchen.base, wallUnits: kitchen.wallUnits, doubleVanity: false,
        summary: `Example: ${sqftText(floor)} sq ft kitchen, ${kitchen.base + kitchen.wallUnits} standard cabinet units, ${sqftText(counters)} sq ft counter, ${sqftText(backsplash)} sq ft backsplash, floor, trim, wall paint and basic finish demolition.`,
        assumptions: `Using ${sqftText(floor)} sq ft of floor. Walls (${sqftText(wall)} sq ft), trim (${sqftText(trim)} ft) and backsplash (${sqftText(backsplash)} sq ft) are scaled from the ${size} example. Counters are ${sqftText(counters)} sq ft${counterNote}. Cabinet count stays with the ${size} example.`,
        exclusions: "Existing layout retained. Appliances, plumbing, electrical, permits and concealed repairs require separate allowances.",
      };
    }
    case "flooring": {
      const preset = [120, 400, 800][i];
      const floor = areas.roomSqft == null ? preset : areas.roomSqft;
      return {
        floor, wall: 0, trim: 0, shower: 0, counters: 0,
        backsplash: 0, base: 0, wallUnits: 0, doubleVanity: false,
        summary: `Example: ${sqftText(floor)} sq ft of new floor covering on a prepared surface.`,
        assumptions: `Using ${sqftText(floor)} sq ft of floor. ${areas.roomSqft == null ? `That is the ${size} example.` : `Started from the ${size} example and edited.`}`,
        exclusions: "Floor demolition, subfloor repairs, leveling, stairs and new trim are not included. Routine protection, cleanup and haul-off allowance included.",
      };
    }
    case "interior-paint":
    case "exterior-paint": {
      const preset = (service === "interior-paint" ? [300, 800, 1600] : [500, 1200, 2400])[i];
      const area = areas.roomSqft == null ? preset : areas.roomSqft;
      const surface = service === "interior-paint" ? "interior wall" : "exterior siding";
      return {
        floor: 0, wall: area, trim: 0, shower: 0, counters: 0, backsplash: 0,
        base: 0, wallUnits: 0, doubleVanity: false,
        summary: `Example: ${sqftText(area)} sq ft of paintable ${surface} surface, not floor area.`,
        assumptions: `Using ${sqftText(area)} sq ft of paintable ${surface}. This is the area to paint, not the floor. ${areas.roomSqft == null ? `That is the ${size} example.` : `Started from the ${size} example and edited.`}`,
        exclusions: "Sound, accessible surfaces assumed. Repairs, lead remediation, scaffolding, ceilings and trim are not included.",
      };
    }
    default: return null;
  }
}
export function presetAreas(service: ProjectService, size: ProjectSize) {
  const scope = projectScope(service, size);
  const blank = { floor: "", shower: "", counter: "", room: "" };
  if (!scope) return blank;
  if (service === "bathroom") return { ...blank, floor: String(scope.floor), shower: String(scope.shower) };
  if (service === "kitchen") return { ...blank, floor: String(scope.floor), counter: String(scope.counters) };
  if (service === "flooring") return { ...blank, room: String(scope.floor) };
  if (service === "interior-paint" || service === "exterior-paint") return { ...blank, room: String(scope.wall) };
  return blank;
}
