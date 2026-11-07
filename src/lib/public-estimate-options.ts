import type { CabinetFinishId } from "./public-cabinet-finishes.ts";

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
  /**
   * Kitchen and bathroom only. When false, floor covering materials and install are omitted.
   * Dedicated flooring projects always include flooring regardless of this flag.
   * Older saved links omit the field and default to false (not bundled).
   */
  includeFlooring: boolean;
  /** Measured areas. Leave unset to price the size example. */
  floorSqft?: number | null;
  showerSqft?: number | null;
  counterSqft?: number | null;
  roomSqft?: number | null;
  /** Bathroom vanity SKU. Unset uses the size example: 30-inch, or 60-inch double when Large. */
  vanity?: string;
  /** Bathroom only. True includes a basic new toilet. */
  newToilet: boolean;
  /** Kitchen cabinet boxes. Unset uses the size example. */
  cabinetBoxes?: number | null;
  cabinetFinish?: CabinetFinishId;
  /** Kitchen XL boxes around a refrigerator. Unset means none. */
  xlFridgeBoxes?: number | null;
};
export const DEFAULT_PROJECT_INPUTS: ProjectInputs = {
  service: "kitchen", size: "Medium", floor: "lvp", counter: "quartz",
  shower: "ceramic", prime: true, exteriorCoats: 1, delivery: 0, specialist: 0, newToilet: true,
  includeFlooring: false,
};

/** Floor covering is always in scope for dedicated flooring projects. */
export function flooringIsOptional(service: ProjectService): boolean {
  return service === "kitchen" || service === "bathroom";
}

export function effectiveIncludeFlooring(input: Pick<ProjectInputs, "service" | "includeFlooring">): boolean {
  if (input.service === "flooring") return true;
  if (!flooringIsOptional(input.service)) return false;
  return Boolean(input.includeFlooring);
}
/** Optional measured areas. Omit a key to keep the size example. Null means the box was left blank. */
export type ScopeAreas = {
  floorSqft?: number | null;
  showerSqft?: number | null;
  counterSqft?: number | null;
  roomSqft?: number | null;
  cabinetBoxes?: number | null;
  xlFridgeBoxes?: number | null;
};
export const BOX_LIMITS = {
  cabinetBoxes: { min: 0, max: 40, label: "cabinet boxes" },
  xlFridgeBoxes: { min: 0, max: 6, label: "XL fridge boxes" },
} as const;
export const AREA_LIMITS = {
  /** Room size for kitchen/bath remodel scaling (walls, trim, cabinets). Also used as flooring install area when replacing flooring. */
  bathroomFloor: { min: 20, max: 300, label: "a bathroom room size" },
  bathroomShower: { min: 0, max: 200, label: "a shower or tub surround" },
  kitchenFloor: { min: 60, max: 600, label: "a kitchen room size" },
  kitchenCounter: { min: 1, max: 200, label: "countertops" },
  flooring: { min: 20, max: 2500, label: "a floor area" },
  interiorPaint: { min: 50, max: 5000, label: "an interior area to paint" },
  exteriorPaint: { min: 100, max: 8000, label: "an exterior area to paint" },
} as const;
const rangeMessage = (limit: { min: number; max: number; label: string }) =>
  `Enter ${limit.label} between ${limit.min} and ${limit.max} sq ft.`;
function outOfRange(value: number | null | undefined, limit: { min: number; max: number; label: string }, optional: boolean) {
  if (value == null) return optional ? null : rangeMessage(limit);
  // Zero is never a valid substitute for "use the size example" — reject it explicitly.
  if (!Number.isFinite(value) || value < limit.min || value > limit.max) return rangeMessage(limit);
  return null;
}
function invalidBoxCount(value: number | null | undefined, limit: { min: number; max: number; label: string }) {
  if (value == null) return null;
  if (!Number.isInteger(value) || value < limit.min || value > limit.max) {
    return `Enter ${limit.label} from ${limit.min} to ${limit.max}.`;
  }
  return null;
}
/** Friendly copy when a typed area or box count is outside the planning range. Preset-only calls have no error. */
export function scopeAreaError(service: ProjectService, areas: ScopeAreas = {}): string | null {
  if (service === "custom") return null;
  if (service === "kitchen") {
    const boxes = invalidBoxCount(areas.cabinetBoxes, BOX_LIMITS.cabinetBoxes) ??
      invalidBoxCount(areas.xlFridgeBoxes, BOX_LIMITS.xlFridgeBoxes);
    if (boxes) return boxes;
  }
  const mentioned = (["floorSqft", "showerSqft", "counterSqft", "roomSqft"] as const).some(key => Object.hasOwn(areas, key));
  if (!mentioned) return null;
  if (service === "bathroom") {
    // Blank room size → size example. Flooring opt-out must not require a flooring-work quantity;
    // the same field is remodel room size, so blank stays allowed and 0/out-of-range stay invalid.
    return outOfRange(areas.floorSqft, AREA_LIMITS.bathroomFloor, true) ??
      outOfRange(areas.showerSqft, AREA_LIMITS.bathroomShower, true);
  }
  if (service === "kitchen") {
    return outOfRange(areas.floorSqft, AREA_LIMITS.kitchenFloor, true) ??
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
/** Whole boxes only. Blank keeps the size example for cabinet boxes, or none for an XL fridge box. */
export function parseBoxCount(raw: string): { value: number | null; error: string | null } {
  const s = raw.trim();
  if (!s) return { value: null, error: null };
  if (!/^\d+$/.test(s)) return { value: null, error: "Use a whole number of boxes." };
  return { value: Number(s), error: null };
}
/** Vanities and filler strips. Kitchen box prices are the amounts on the box costs. */
export type VanitySize = { id: string; label: string; widthIn: number; double: boolean };
/** Standard vanity cabinet depth. The top area follows the selected width. */
export const VANITY_TOP_DEPTH_IN = 22;
export const VANITY_SIZES: VanitySize[] = [
  { id: "VA24", label: "24-inch vanity", widthIn: 24, double: false },
  { id: "VA27", label: "27-inch vanity", widthIn: 27, double: false },
  { id: "VA30", label: "30-inch vanity", widthIn: 30, double: false },
  { id: "VA36", label: "36-inch vanity", widthIn: 36, double: false },
  { id: "VA42DL", label: "42-inch vanity", widthIn: 42, double: false },
  { id: "VA48D", label: "48-inch vanity", widthIn: 48, double: false },
  { id: "VA60D", label: "60-inch vanity", widthIn: 60, double: false },
  { id: "VA60DD", label: "60-inch double vanity", widthIn: 60, double: true },
];
export function vanityTopSqft(vanity: VanitySize) {
  return Math.round((vanity.widthIn * VANITY_TOP_DEPTH_IN) / 144 * 100) / 100;
}
export function vanityForSize(size: ProjectSize) {
  return size === "Large" ? "VA60DD" : "VA30";
}
export function getVanity(id: string) {
  return VANITY_SIZES.find(row => row.id === id) ?? null;
}
export function selectedVanity(size: ProjectSize, vanityId?: string) {
  return (vanityId ? getVanity(vanityId) : null) ?? getVanity(vanityForSize(size))!;
}
const sqftText = (n: number) => {
  const tenths = Math.round(n * 10) / 10;
  return Number.isInteger(tenths) ? String(tenths) : tenths.toFixed(1);
};
const scaleFrom = (presetValue: number, presetBase: number, actualBase: number) =>
  actualBase === presetBase ? presetValue : presetValue * actualBase / presetBase;
export function projectScope(service: ProjectService, size: ProjectSize, areas: ScopeAreas = {}, vanityId?: string) {
  const i = PROJECT_SIZES.indexOf(size);
  if (i < 0) throw new Error("Invalid project size");
  const bath = [
    { floor: 40, wall: 190, trim: 26, shower: 60 },
    { floor: 80, wall: 270, trim: 36, shower: 80 },
    { floor: 120, wall: 330, trim: 44, shower: 100 },
  ][i];
  const vanity = selectedVanity(size, vanityId);
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
        floor, wall, trim, shower, counters: vanityTopSqft(vanity), backsplash: 0, base: 0, wallUnits: 0, xlFridgeBoxes: 0, doubleVanity: vanity.double,
        summary: `Example: ${sqftText(floor)} sq ft bathroom, ${sqftText(shower)} sq ft surround, ${vanity.label}, one 3-inch filler strip, floor, trim, wall paint, demolition, setting materials, waterproofing and a basic fixture allowance.`,
        assumptions: `Using ${sqftText(floor)} sq ft of floor. Walls (${sqftText(wall)} sq ft) and trim (${sqftText(trim)} ft) are scaled from the ${size} example. Surround is ${sqftText(shower)} sq ft${surroundNote}. Vanity is a ${vanity.label}. One 3-inch filler strip is included. Fixtures and demolition stay with the ${size} example.`,
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
      const presetBoxes = kitchen.base + kitchen.wallUnits;
      const boxes = areas.cabinetBoxes == null ? presetBoxes : areas.cabinetBoxes;
      const xlFridgeBoxes = areas.xlFridgeBoxes == null ? 0 : areas.xlFridgeBoxes;
      const base = boxes === presetBoxes ? kitchen.base : boxes / 2;
      const wallUnits = boxes === presetBoxes ? kitchen.wallUnits : boxes / 2;
      const cabinetPhrase = boxes === presetBoxes && xlFridgeBoxes === 0
        ? `${presetBoxes} standard cabinet units`
        : `${sqftText(boxes)} cabinet boxes${xlFridgeBoxes ? ` and ${sqftText(xlFridgeBoxes)} XL fridge ${xlFridgeBoxes === 1 ? "box" : "boxes"}` : ""}`;
      const cabinetNote = boxes === presetBoxes && xlFridgeBoxes === 0
        ? `Cabinet count stays with the ${size} example.`
        : `Using ${sqftText(boxes)} cabinet boxes${xlFridgeBoxes ? ` and ${sqftText(xlFridgeBoxes)} XL fridge ${xlFridgeBoxes === 1 ? "box" : "boxes"}` : ""}.`;
      return {
        floor, wall, trim, shower: 0, counters, backsplash, base, wallUnits, xlFridgeBoxes, doubleVanity: false,
        summary: `Example: ${sqftText(floor)} sq ft kitchen, ${cabinetPhrase}, ${sqftText(counters)} sq ft counter, ${sqftText(backsplash)} sq ft backsplash, floor, trim, wall paint and basic finish demolition.`,
        assumptions: `Using ${sqftText(floor)} sq ft of floor. Walls (${sqftText(wall)} sq ft), trim (${sqftText(trim)} ft) and backsplash (${sqftText(backsplash)} sq ft) are scaled from the ${size} example. Counters are ${sqftText(counters)} sq ft${counterNote}. ${cabinetNote}`,
        exclusions: "Existing layout retained. Appliances, plumbing, electrical, permits and concealed repairs require separate allowances.",
      };
    }
    case "flooring": {
      const preset = [120, 400, 800][i];
      const floor = areas.roomSqft == null ? preset : areas.roomSqft;
      return {
        floor, wall: 0, trim: 0, shower: 0, counters: 0,
        backsplash: 0, base: 0, wallUnits: 0, xlFridgeBoxes: 0, doubleVanity: false,
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
        base: 0, wallUnits: 0, xlFridgeBoxes: 0, doubleVanity: false,
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
  const blank = { floor: "", shower: "", counter: "", room: "", boxes: "", xl: "" };
  if (!scope) return blank;
  if (service === "bathroom") return { ...blank, floor: String(scope.floor), shower: String(scope.shower) };
  if (service === "kitchen") return {
    ...blank,
    floor: String(scope.floor),
    counter: String(scope.counters),
    boxes: String(scope.base + scope.wallUnits),
    xl: "0",
  };
  if (service === "flooring") return { ...blank, room: String(scope.floor) };
  if (service === "interior-paint" || service === "exterior-paint") return { ...blank, room: String(scope.wall) };
  return blank;
}
