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
export type ProjectInputs = {
  service: ProjectService;
  size: ProjectSize;
  floor: typeof FLOOR_MATERIALS[number]["id"];
  counter: typeof COUNTER_MATERIALS[number]["id"];
  shower: typeof SHOWER_MATERIALS[number]["id"];
  prime: boolean;
  delivery: number;
  specialist: number;
  fabrication: number | null;
};
export const DEFAULT_PROJECT_INPUTS: ProjectInputs = {
  service: "bathroom", size: "Medium", floor: "tile", counter: "quartz",
  shower: "ceramic", prime: true, delivery: 0, specialist: 0, fabrication: null,
};
export function projectScope(service: ProjectService, size: ProjectSize) {
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
    case "bathroom": return {
      floor: bath.floor, wall: bath.wall, trim: bath.trim, shower: bath.shower,
      counters: 0, backsplash: 0, base: 0, wallUnits: 0, doubleVanity: i === 2,
      summary: `Example: ${bath.floor} sq ft bathroom, ${bath.shower} sq ft surround, ${bath.vanity}, floor, trim, wall paint, demolition, setting materials, waterproofing and a basic fixture allowance.`,
      exclusions: "Existing layout retained. Basic finish demolition and shower waterproofing materials included. Plumbing relocation, electrical, permits and concealed repairs require separate allowances.",
    };
    case "kitchen": return {
      ...kitchen, shower: 0, doubleVanity: false,
      summary: `Example: ${kitchen.floor} sq ft kitchen, ${kitchen.base + kitchen.wallUnits} standard cabinet units, ${kitchen.counters} sq ft counter, ${kitchen.backsplash} sq ft backsplash, floor, trim and wall paint.`,
      exclusions: "Existing layout retained. Demolition, appliances, plumbing, electrical, permits and concealed repairs require separate allowances. Fabrication/install allowance is required for stone counters.",
    };
    case "flooring": return {
      floor: [120, 400, 800][i], wall: 0, trim: 0, shower: 0, counters: 0,
      backsplash: 0, base: 0, wallUnits: 0, doubleVanity: false,
      summary: `Example: ${[120, 400, 800][i]} sq ft of new floor covering on a prepared surface.`,
      exclusions: "Floor demolition, subfloor repairs, leveling, stairs and new trim are not included. Routine protection, cleanup and haul-off allowance included.",
    };
    case "interior-paint":
    case "exterior-paint": {
      const area = (service === "interior-paint" ? [300, 800, 1600] : [500, 1200, 2400])[i];
      return {
        floor: 0, wall: area, trim: 0, shower: 0, counters: 0, backsplash: 0,
        base: 0, wallUnits: 0, doubleVanity: false,
        summary: `Example: ${area} sq ft of paintable ${service === "interior-paint" ? "interior wall" : "exterior siding"} surface, not floor area.`,
        exclusions: "Sound, accessible surfaces assumed. Repairs, lead remediation, scaffolding, ceilings and trim are not included.",
      };
    }
    default: return null;
  }
}
