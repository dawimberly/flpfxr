export const DEFAULT_OP_PERCENT = 20;

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
