/** EagleView length-diagram look: red ridges, blue valleys, green rakes, black eaves, orange walls. */

export const EV_EDGE_COLOR: Record<string, string> = {
  ridge: "#cc0000",
  hip: "#cc0000",
  valley: "#3366cc",
  rake: "#228b22",
  eave: "#111111",
  headwall: "#c2410c",
  sidewall: "#c2410c",
  wall: "#c2410c",
  step: "#c2410c",
  unclassified: "#333333",
};

export const EV_FILL = "#8ec8e8";

export const EV_LEGEND: { kind: string; label: string; color: string; dash: boolean }[] = [
  { kind: "ridge", label: "Ridges", color: "#cc0000", dash: false },
  { kind: "hip", label: "Hips", color: "#cc0000", dash: true },
  { kind: "valley", label: "Valleys", color: "#3366cc", dash: true },
  { kind: "rake", label: "Rakes", color: "#228b22", dash: false },
  { kind: "eave", label: "Eaves", color: "#111111", dash: false },
  { kind: "headwall", label: "Headwall", color: "#c2410c", dash: false },
  { kind: "sidewall", label: "Sidewall", color: "#c2410c", dash: true },
];

export function evStrokeDash(kind: string): string | undefined {
  const row = EV_LEGEND.find((item) => item.kind === kind);
  return row?.dash ? "8 6" : undefined;
}

export function evLengthLabel(ft: number): string {
  if (!Number.isFinite(ft) || ft < 4.5) return "";
  return String(Math.round(ft));
}
