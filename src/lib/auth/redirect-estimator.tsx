import { useEffect } from "react";
import { ESTIMATOR_APP_URL } from "@/lib/site";

/** Send authenticated employees to the live estimator app on Vercel. */
export function RedirectToEstimatorApp() {
  useEffect(() => {
    window.location.assign(ESTIMATOR_APP_URL);
  }, []);

  return (
    <p className="mx-auto max-w-md px-4 py-20 text-center text-muted">
      Opening the estimator…
    </p>
  );
}
