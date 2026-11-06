export const CABINET_FINISHES = [
  { id: "ew", name: "Elegant White" },
  { id: "gs", name: "Grey Shaker" },
  { id: "es", name: "Espresso Shaker" },
  { id: "msk", name: "Metallic Shaker" },
  { id: "bs", name: "Blue Shaker" },
  { id: "me", name: "Midnight Espresso" },
  { id: "cg", name: "Cognac" },
  { id: "aw", name: "Antique White" },
  { id: "ve", name: "Value Espresso" },
] as const;

export type CabinetFinishId = (typeof CABINET_FINISHES)[number]["id"];

export function cabinetTier(id: CabinetFinishId) {
  return id === "ve"
    ? { label: "Builder Grade", details: "Partial overlay, standard hinges and slides." }
    : { label: "Premium", details: "Full overlay, soft-close, dovetail drawers, plywood boxes." };
}

export type CabinetPick = { id: string; sku: string; quantity: number };
export type CabinetQuote = { total: number | null; warnings: string[] };

const CABINET_CATEGORIES = new Set([
  "cabinets", "cabinets/storage", "vanity/cabinets", "closet/storage", "built-ins/storage",
]);

export function isCabinetCategory(category: string) {
  return CABINET_CATEGORIES.has(category);
}

export function isClosetRoom(roomTypeId: string) {
  return ["closet", "bedroom", "home_office"].includes(roomTypeId);
}

export function preferredCabinetGroup(roomTypeId: string) {
  if (roomTypeId === "bathroom") return "vanity";
  return isClosetRoom(roomTypeId) ? "closet-unit" : "base";
}

export function defaultFinishId(roomTypeId: string) {
  return isClosetRoom(roomTypeId) ? "cl" : "ew";
}

export function resolveCabinetFinish(id: string | undefined, roomTypeId: string) {
  // Saved drafts from older catalogs may still contain the removed finish.
  return !id || /^(?:honey|hn|hs)$/i.test(id) ? defaultFinishId(roomTypeId) : id;
}
