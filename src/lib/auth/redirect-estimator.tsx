import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

/** Send authenticated employees to the in-site estimator. */
export function RedirectToEstimatorApp() {
  const navigate = useNavigate();

  useEffect(() => {
    void navigate({ to: "/estimator" });
  }, [navigate]);

  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <p className="text-muted">Opening the estimator…</p>
      <Button asChild size="lg" className="mt-6 w-full">
        <a href="/estimator">Open estimator</a>
      </Button>
    </div>
  );
}
