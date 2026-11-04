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
  loader: ({ deps }) => loadPublicEstimate({ data: inputsFromLanding(estimateLandingFromSearch(deps.search)) }),
  validateSearch: (search: Record<string, unknown>) => estimateRouteSearch(search),
  head: ({ match }) => {
    const landing = estimateLandingFromSearch(match?.search ?? {});
    const headline = landing.explicitService ? headlineFor(landing.service) : DEFAULT_ESTIMATE_HEADLINE;
    return {
      meta: [
        { title: `${headline} | ${SITE.name}` },
        { name: "description", content: "Explore preliminary planning ranges for kitchen, bathroom, flooring, painting and other remodeling projects in San Antonio." },
      ],
    };
  },
});

function EstimatePage() {
  const search = Route.useSearch();
  const landing = estimateLandingFromSearch(search);
  const initialEstimate = Route.useLoaderData();
  return <PublicProjectEstimator key={JSON.stringify(landing)} landing={landing} search={search} initialEstimate={initialEstimate} />;
}
