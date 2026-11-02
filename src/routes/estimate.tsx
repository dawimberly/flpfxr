import { createFileRoute } from "@tanstack/react-router";
import { PublicProjectEstimator } from "@/components/public-project-estimator";
import { SITE } from "@/lib/site";

export const Route = createFileRoute("/estimate")({
  component: EstimatePage,
  head: () => ({
    meta: [
      { title: `Project Cost Estimator | ${SITE.name}` },
      { name: "description", content: "Explore kitchen and bathroom remodeling planning ranges in San Antonio. Choose your project and scope, then request an on-site estimate." },
    ],
  }),
});

function EstimatePage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 md:py-20">
      <h1 className="font-display text-3xl font-semibold text-fg md:text-5xl">Plan your next project.</h1>
      <p className="mb-8 mt-4 text-muted">Thinking about a kitchen or bathroom remodel? Choose your project and scope to explore a planning range. No measuring, cost calculations or contact details needed to get started.</p>
      <PublicProjectEstimator />
    </main>
  );
}
