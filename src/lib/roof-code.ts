/** Notes copied from MRC Xactimates for San Antonio / Texas reroofs. */

export function zipFromAddress(address?: string | null): string | null {
  const m = String(address || "").match(/\b(\d{5})(?:-\d{4})?\b/);
  return m?.[1] ?? null;
}

export function jobHasRoofing(job: {
  rooms: Array<{ room: { label: string; extraCategories?: string[] } }>;
}): boolean {
  return job.rooms.some(
    (entry) =>
      entry.room.label === "Roof" || (entry.room.extraCategories ?? []).includes("roofing"),
  );
}

export function roofCodeNote(zip?: string | null): string {
  const z = String(zip || "").replace(/\D/g, "").slice(0, 5);
  const sa = z.startsWith("782");
  const city = sa ? "San Antonio" : "this city";
  return [
    `${city} ${z || "zip"}: box/turtle vents and pipe jacks are replaced with the reroof.`,
    "Gutter apron at the eaves is left in place (MRC practice: underlayment laps over eave metal). Drip edge at the rakes is R&R so felt can run underneath, per IRC R905.2.8.5 drip-edge lap.",
    sa
      ? "IRC R905.2 (asphalt shingles), R905.2.8.5 drip edge, and R905.2.8.2 valleys. This quote prices Valley metal plus ice & water in the valleys only (3 ft wide x valley LF). Steep uses the TXSA 7/12 to 9/12 charge for every 7/12 and steeper roof. Unmeasured rake count follows pitch: more rakes on 4/12-6/12 gables, fewer on 7/12+ hips, unless you tap cut-up."
      : "Use the adopted IRC roofing chapter for this zip; MRC Xactimates cite the local IRC when the AHJ requires it. Valleys get metal plus 3 ft ice & water x valley LF.",
  ].join(" ");
}
