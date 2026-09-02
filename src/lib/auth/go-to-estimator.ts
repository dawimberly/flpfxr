import { ESTIMATOR_APP_URL } from "@/lib/site";

/**
 * Navigate to the external estimator app. Mobile Safari often blocks
 * `location.replace` after an async sign-in, so we try a form GET submit first.
 */
export function goToEstimatorApp() {
  if (typeof window === "undefined") return;

  try {
    const form = document.createElement("form");
    form.method = "GET";
    form.action = ESTIMATOR_APP_URL;
    form.style.display = "none";
    document.body.appendChild(form);
    form.submit();
    form.remove();
    return;
  } catch {
    /* fall through */
  }

  window.location.replace(ESTIMATOR_APP_URL);
}
