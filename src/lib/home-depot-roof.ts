/** Home Depot San Antonio list prices for roof Cost per item (Sep 2026). */

export const HD_AS_OF = "Home Depot Sep 2026";
export const HD_OAKRIDGE_BUNDLE = 38.97;
export const HD_BUNDLES_PER_SQ = 3;
export const HD_PROARMOR_ROLL = 135.35;
export const HD_SYNTHETIC_SQ_PER_ROLL = 10;
export const HD_STARTER_BUNDLE = 44.97;
export const HD_STARTER_LF_PER_BUNDLE = 100;
export const HD_PROEDGE_BUNDLE = 54.97;
export const HD_PROEDGE_LF_PER_BUNDLE = 33;
export const HD_DRIP_10FT = 8.97;
export const HD_DELIVERY = 79;
/** WeatherLock-style 3 ft x 75 ft roll. Contractor ice is billed per sq ft. */
export const HD_ICE_ROLL = 208;
export const HD_ICE_ROLL_SF = 225;
/** Market installed per shingle square with waste (customer copy). */
export const CUSTOMER_PER_SQ = 446.83;

export const HD_UNIT_COST: Record<string, number> = {
  "Owens Corning Oakridge": HD_OAKRIDGE_BUNDLE * HD_BUNDLES_PER_SQ,
  "Laminated composition shingles": HD_OAKRIDGE_BUNDLE * HD_BUNDLES_PER_SQ,
  "Synthetic underlayment": 13.54,
  "Asphalt starter \u2014 universal": 0.43,
  "Hip / ridge cap \u2014 composition": 1.67,
  "Drip edge": 0.9,
  "Coil nails \u2014 1 1/4 in (20 SQ/box)": 44.98,
  "Plastic cap nails \u2014 1 in (20 SQ/box)": 42.97,
  "Roofing caulk \u2014 NP1": 8.97,
  "Ice & water barrier": Math.round((HD_ICE_ROLL / HD_ICE_ROLL_SF) * 10000) / 10000,
  "Material delivery": HD_DELIVERY,
};

export function homeDepotUnitCost(description: string): number | null {
  for (const [name, cost] of Object.entries(HD_UNIT_COST)) {
    if (description.includes(name)) return cost;
  }
  return null;
}

export const CREW_PER_SQ = 100;

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export type RoofCrewBid = {
  squares: number;
  materials: number;
  crew: number;
  total: number;
  profit: number;
  customerTotal: number;
  materialsPerSq: number;
  laborPerSq: number;
  customerPerSq: number;
};

export function roofCrewBid(
  lines: Array<{ description: string; quantity: number; lineTotal: number }>,
  customerGrand?: number,
): RoofCrewBid | null {
  const shingles = lines.find((line) =>
    /Owens Corning Oakridge|Laminated composition shingles/i.test(line.description),
  );
  if (!shingles) return null;
  let materials = 0;
  for (const line of lines) {
    if (/roofing crew/i.test(line.description)) continue;
    const hd = homeDepotUnitCost(line.description);
    if (hd != null) materials += line.quantity * hd;
    else if (/debris haul/i.test(line.description)) materials += line.lineTotal;
  }
  const squares = shingles.quantity;
  const crew = round2(squares * CREW_PER_SQ);
  materials = round2(materials);
  const total = round2(materials + crew);
  const customerTotal = round2(customerGrand ?? squares * CUSTOMER_PER_SQ);
  const materialsPerSq = squares > 0 ? round2(materials / squares) : 0;
  return {
    squares,
    materials,
    crew,
    total,
    profit: round2(customerTotal - total),
    customerTotal,
    materialsPerSq,
    laborPerSq: CREW_PER_SQ,
    customerPerSq: CUSTOMER_PER_SQ,
  };
}

export function customerRoofTask(description: string): string | null {
  const name = description.replace(/^(R&R|R|\+)\s+/i, "").trim();
  if (/roofing crew/i.test(name)) return null;
  if (/3-tab/i.test(name)) return "Tear off existing 3-tab shingles";
  if (/Tear-off composition/i.test(name)) return "Tear off existing shingles";
  if (/debris haul/i.test(name)) return "Haul off roofing debris";
  if (/Owens Corning Oakridge/i.test(name)) return "Install Owens Corning Oakridge shingles";
  if (/Laminated composition/i.test(name)) return "Install laminated composition shingles";
  if (/Synthetic underlayment/i.test(name)) return "Install synthetic underlayment";
  if (/Hip \/ ridge cap/i.test(name)) return "Install hip and ridge cap";
  if (/Drip edge/i.test(name)) return "Replace drip edge at the rakes";
  if (/Asphalt starter/i.test(name)) return "Install starter shingles";
  if (/Coil nails/i.test(name)) return "Coil roofing nails";
  if (/Plastic cap nails/i.test(name)) return "Plastic cap nails";
  if (/Roofing caulk/i.test(name)) return "Roofing caulk";
  if (/Ice & water/i.test(name)) return "Ice and water in the valleys (3 ft wide)";
  if (/Valley metal/i.test(name)) return "Valley metal";
  if (/Steep roof/i.test(name)) return "Steep-roof labor";
  if (/Material delivery/i.test(name)) return "Deliver roofing materials";
  return name;
}
