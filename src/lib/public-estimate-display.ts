export const PRELIMINARY_ESTIMATE_WORDING =
  "Preliminary estimate only — not a quote. Final price is confirmed after an on-site review.";

export function formatPublicEstimate(total: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", maximumFractionDigits: 0,
  }).format(total);
}
