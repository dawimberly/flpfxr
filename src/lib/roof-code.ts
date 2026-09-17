/** Notes copied from MRC Xactimates for San Antonio / Texas reroofs. */

export function roofCodeNote(zip?: string | null): string {
  const z = String(zip || "").replace(/\D/g, "").slice(0, 5);
  const sa = z.startsWith("782");
  const city = sa ? "San Antonio" : "this city";
  return [
    `${city} ${z || "zip"}: box/turtle vents and pipe jacks are replaced with the reroof.`,
    "Gutter apron at the eaves stays (underlayment code does not require replacing it). Drip edge at the rakes is R&R so felt can run underneath.",
    sa
      ? "IRC R905.2 (asphalt shingles) and R905.2.8.2 closed-valley liner, same language used on MRC San Antonio Xactimates."
      : "Use the adopted IRC roofing chapter for this zip; MRC Xactimates cite the local IRC when the AHJ requires it.",
  ].join(" ");
}
