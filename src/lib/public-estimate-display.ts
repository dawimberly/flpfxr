export const PRELIMINARY_ESTIMATE_WORDING =
  "Preliminary estimate only — not a quote. Final price is confirmed after an on-site review.";

export function formatPublicEstimate(total: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", maximumFractionDigits: 0,
  }).format(total);
}

/**
 * Established public range from projectPlanningEstimate finalize():
 * low = round(total to $100), high = round(total * 1.25 to $100).
 * Source: commit 3f92fa7 (Harden public estimator labor, ranges and allowance validation).
 */
export function formatEstimateRange(result: { low: number; high: number }): string {
  return `between ${formatPublicEstimate(result.low)} and ${formatPublicEstimate(result.high)}`;
}
