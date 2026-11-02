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
  /** Bathroom vanity SKU. Unset uses the size example: 30-inch, or 60-inch double when Large. */
  vanity?: string;
  /** Bathroom only. True includes a basic new toilet. */
  newToilet: boolean;
  /** Kitchen cabinet boxes. Unset uses the size example. */
  cabinetBoxes?: number | null;
  /** Kitchen XL boxes around a refrigerator. Unset means none. */
  xlFridgeBoxes?: number | null;
};
export const DEFAULT_PROJECT_INPUTS: ProjectInputs = {
  service: "kitchen", size: "Medium", floor: "lvp", counter: "quartz",
  shower: "ceramic", prime: true, exteriorCoats: 1, delivery: 0, specialist: 0, newToilet: true,
};
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
/** Whole boxes only. Blank keeps the size example for cabinet boxes, or none for an XL fridge box. */
export function parseBoxCount(raw: string): { value: number | null; error: string | null } {
  const s = raw.trim();
  if (!s) return { value: null, error: null };
  if (!/^\d+$/.test(s)) return { value: null, error: "Use a whole number of boxes." };
  return { value: Number(s), error: null };
}
/**
 * Styles by Design contractor catalog stores Northville list prices in `cost_per_unit`
 * (Elegant White Shaker matches the Northville MSRP file). The contractor portal sells at 20% off.
 * Customers are not charged that list price. Their price is 10% off, which is above the contractor price.
 */
export const CUSTOMER_LIST_DISCOUNT = 0.1;
export const CONTRACTOR_LIST_DISCOUNT = 0.2;
export function priceOffList(list: number, discount: number) {
  return Math.round(list * (1 - discount) * 100) / 100;
}
export type VanitySize = { id: string; label: string; list: number; double: boolean };
export const VANITY_SIZES: VanitySize[] = [
  { id: "VA24", label: "24-inch vanity", list: 186, double: false },
  { id: "VA27", label: "27-inch vanity", list: 288, double: false },
  { id: "VA30", label: "30-inch vanity", list: 220, double: false },
  { id: "VA36", label: "36-inch vanity", list: 273, double: false },
  { id: "VA42DL", label: "42-inch vanity", list: 345, double: false },
  { id: "VA48D", label: "48-inch vanity", list: 429, double: false },
  { id: "VA60D", label: "60-inch vanity", list: 499, double: false },
  { id: "VA60DD", label: "60-inch double vanity", list: 463, double: true },
];
export function vanityForSize(size: ProjectSize) {
  return size === "Large" ? "VA60DD" : "VA30";
}
export function getVanity(id: string) {
  return VANITY_SIZES.find(row => row.id === id) ?? null;
}
export function selectedVanity(size: ProjectSize, vanityId?: string) {
  return (vanityId ? getVanity(vanityId) : null) ?? getVanity(vanityForSize(size))!;
}
/** Base fillers are Northville MSRP and were not copied into the contractor file. Closet fillers are in that file. */
export const FILLER_STRIPS = [
  { sku: "BF336", name: "3 in × 36 in base filler", list: 24, source: "Northville MSRP" },
  { sku: "BF636", name: "6 in × 36 in base filler", list: 50, source: "Northville MSRP" },
  { sku: "TK8", name: "Toe kick", list: 19, source: "Northville MSRP" },
  { sku: "TF196", name: "Closet filler 1.5 in × 96 in", list: 22, source: "Styles by Design contractor catalog" },
  { sku: "TF396", name: "Closet filler 3 in × 96 in", list: 67, source: "Styles by Design contractor catalog" },
  { sku: "TF696", name: "Closet filler 6 in × 96 in", list: 136, source: "Styles by Design contractor catalog" },
] as const;
export function fillerCostAnalysis() {
  return FILLER_STRIPS.map(row => ({
    ...row,
    contractor: priceOffList(row.list, CONTRACTOR_LIST_DISCOUNT),
    customer: priceOffList(row.list, CUSTOMER_LIST_DISCOUNT),
  }));
}
export const INCLUDED_FILLER_SKU = "BF336";
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
        floor, wall, trim, shower, counters: 0, backsplash: 0, base: 0, wallUnits: 0, xlFridgeBoxes: 0, doubleVanity: vanity.double,
        summary: `Example: ${sqftText(floor)} sq ft bathroom, ${sqftText(shower)} sq ft surround, ${vanity.label}, one 3-inch filler strip, floor, trim, wall paint, demolition, setting materials, waterproofing and a basic fixture allowance.`,
        assumptions: `Using ${sqftText(floor)} sq ft of floor. Walls (${sqftText(wall)} sq ft) and trim (${sqftText(trim)} ft) are scaled from the ${size} example. Surround is ${sqftText(shower)} sq ft${surroundNote}. Vanity is a ${vanity.label}, priced at 10% off the cabinet list. One 3-inch filler strip is included at that same discount. Fixtures and demolition stay with the ${size} example.`,
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
