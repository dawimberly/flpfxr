import { createFileRoute } from "@tanstack/react-router";
import { PublicProjectEstimator } from "@/components/public-project-estimator";
import {
  DEFAULT_ESTIMATE_HEADLINE, estimateLandingFromSearch, estimateRouteSearch, headlineFor,
} from "@/lib/estimate-landing";
import { loadEstimateOffer } from "@/lib/estimate-offer";
import { SITE } from "@/lib/site";

export const Route = createFileRoute("/estimate")({
  component: EstimatePage,
  loader: () => loadEstimateOffer(),
  validateSearch: (search: Record<string, unknown>) => estimateRouteSearch(search),
  head: ({ match }) => {
    const landing = estimateLandingFromSearch(match?.search ?? {});
    const headline = landing.explicitService ? headlineFor(landing.service) : DEFAULT_ESTIMATE_HEADLINE;
    return {
      meta: [
        { title: `${headline} | ${SITE.name}` },
        { name: "description", content: "Explore preliminary planning ranges for kitchen, bathroom, flooring, painting and other remodeling projects in San Antonio." },
      ],
      scripts: [{ src: "https://js.stripe.com/dahlia/stripe.js" }],
    };
  },
});

function EstimatePage() {
  const search = Route.useSearch();
  const offer = Route.useLoaderData();
  const landing = estimateLandingFromSearch(search);
  return <PublicProjectEstimator landing={landing} search={search} feeLabel={offer.feeLabel} />;
}
