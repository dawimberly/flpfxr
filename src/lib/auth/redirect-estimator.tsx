import { useEffect } from "react";
import { ESTIMATOR_APP_URL } from "@/lib/site";
import { Button } from "@/components/ui/button";
import { goToEstimatorApp } from "@/lib/auth/go-to-estimator";

/** Send authenticated employees to the live estimator app on Vercel. */
export function RedirectToEstimatorApp() {
  useEffect(() => {
    goToEstimatorApp();
  }, []);

  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <p className="text-muted">Opening the estimator…</p>
      <Button asChild size="lg" className="mt-6 w-full">
        <a href={ESTIMATOR_APP_URL}>Open estimator</a>
      </Button>
    </div>
  );
}
