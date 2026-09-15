/** EagleView length-diagram look: red ridges, blue valleys, green rakes, black eaves. */

export const EV_EDGE_COLOR: Record<string, string> = {
  ridge: "#cc0000",
  hip: "#cc0000",
  valley: "#3366cc",
  rake: "#228b22",
  eave: "#111111",
  step: "#555555",
  unclassified: "#333333",
};

export const EV_FILL = "#8ec8e8";

export const EV_LEGEND: { kind: string; label: string; color: string }[] = [
  { kind: "ridge", label: "Ridges", color: "#cc0000" },
  { kind: "valley", label: "Valleys", color: "#3366cc" },
  { kind: "rake", label: "Rakes", color: "#228b22" },
  { kind: "eave", label: "Eaves", color: "#111111" },
];

export function evLengthLabel(ft: number): string {
  if (!Number.isFinite(ft) || ft < 4.5) return "";
  return String(Math.round(ft));
}
