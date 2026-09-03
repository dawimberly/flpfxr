/**
 * Navigate to the same-origin estimator after employee login.
 * Kept for any leftover callers; prefer router navigate({ to: "/estimator" }).
 */
export function goToEstimatorApp() {
  if (typeof window === "undefined") return;
  window.location.assign("/estimator");
}
