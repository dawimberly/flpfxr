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
