import { createFileRoute } from "@tanstack/react-router";
import { PublicProjectEstimator } from "@/components/public-project-estimator";
import { SITE } from "@/lib/site";

export const Route = createFileRoute("/estimate")({
  component: EstimatePage,
  head: () => ({
    meta: [
      { title: `Project Cost Estimator | ${SITE.name}` },
      { name: "description", content: "Explore preliminary planning ranges for kitchen, bathroom, flooring, painting and other remodeling projects in San Antonio." },
    ],
  }),
});

function EstimatePage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 md:py-20">
      <h1 className="font-display text-3xl font-semibold text-fg md:text-5xl">Plan your next project.</h1>
      <p className="mb-8 mt-4 text-muted">Select a service and project size, then enter rough quantities for a preliminary estimate. This is not a quote; final pricing requires an on-site assessment.</p>
      <PublicProjectEstimator />
    </main>
  );
}
