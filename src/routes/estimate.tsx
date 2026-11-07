import { createFileRoute } from "@tanstack/react-router";
import { PublicProjectEstimator } from "@/components/public-project-estimator";
import {
  DEFAULT_ESTIMATE_HEADLINE, estimateLandingFromSearch, estimateRouteSearch, headlineFor,
} from "@/lib/estimate-landing";
import { loadPublicEstimate } from "@/lib/public-estimate";
import { inputsFromLanding } from "@/lib/estimate-landing";
import { SITE } from "@/lib/site";

export const Route = createFileRoute("/estimate")({
  component: EstimatePage,
  loaderDeps: ({ search }) => ({ search }),
  loader: async ({ deps }) => {
    try { return await loadPublicEstimate({ data: inputsFromLanding(estimateLandingFromSearch(deps.search)) }); }
    catch { return null; } // Keep the planner mounted so its retry UI can recover.
  },
  validateSearch: (search: Record<string, unknown>) => estimateRouteSearch(search),
  head: ({ match }) => {
    const landing = estimateLandingFromSearch(match?.search ?? {});
    const headline = landing.explicitService ? headlineFor(landing.service) : DEFAULT_ESTIMATE_HEADLINE;
    return {
      meta: [
        { title: `${headline} | ${SITE.name}` },
        { name: "description", content: "Explore a preliminary estimate for your kitchen, bathroom, flooring, painting or other remodeling project in San Antonio." },
      ],
    };
  },
});

function EstimatePage() {
  const search = Route.useSearch();
  const landing = estimateLandingFromSearch(search);
  const initialEstimate = Route.useLoaderData();
  // Remount on service/size/measurement deep links — not on flooring keep/replace toggles,
  // which update the URL without resetting typed room dimensions.
  const remountKey = JSON.stringify({
    service: landing.service,
    size: landing.size,
    explicitService: landing.explicitService,
    explicitSize: landing.explicitSize,
    floorSqft: landing.floorSqft,
    showerSqft: landing.showerSqft,
    counterSqft: landing.counterSqft,
    roomSqft: landing.roomSqft,
  });
  return <PublicProjectEstimator key={remountKey} landing={landing} search={search} initialEstimate={initialEstimate} />;
}
