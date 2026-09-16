export const DEFAULT_OP_PERCENT = 20;

/** Roofing is bid at installed unit prices. Interior work still takes O&P. */
export function lineTakesOp(category: string) {
  return category.trim().toLowerCase() !== "roofing";
}

export function opBaseFromLines(lines: { category: string; lineTotal: number }[]) {
  return lines.reduce((sum, line) => sum + (lineTakesOp(line.category) ? line.lineTotal : 0), 0);
}

export function effectiveOpPercent(laborRate: number, opEnabled = true) {
  if (!opEnabled) return 0;
  return Number.isFinite(laborRate) ? laborRate : 0;
}

export function rememberOpPercent(laborRate: number, lastOpPercent?: number) {
  if (Number.isFinite(laborRate) && laborRate > 0) return laborRate;
  if (lastOpPercent != null && Number.isFinite(lastOpPercent) && lastOpPercent > 0) {
    return lastOpPercent;
  }
  return DEFAULT_OP_PERCENT;
}
