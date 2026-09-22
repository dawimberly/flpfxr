import { createFileRoute } from "@tanstack/react-router";
import { AdsLanding } from "@/components/ads-landing";
import { QuoteEstimator } from "@/components/quote-estimator";
import { AREA_LINE, SITE } from "@/lib/site";

type Search = { sent?: boolean };

export const Route = createFileRoute("/kitchen")({
  component: KitchenLanding,
  validateSearch: (search: Record<string, unknown>): Search => ({
    ...(search.sent === "1" || search.sent === true ? { sent: true } : {}),
  }),
  head: () => ({
    meta: [
      { title: `Kitchen remodel | ${SITE.legalName}` },
      {
        name: "description",
        content: `Kitchen remodels in San Antonio. Call ${SITE.phoneDisplay}. Design in-house. ${AREA_LINE}`,
      },
    ],
  }),
});

function KitchenLanding() {
  const { sent } = Route.useSearch();

  return (
    <AdsLanding
      eyebrow="Kitchens"
      title="Kitchen remodels in San Antonio."
      body="Cabinets, counters, floors. Design in-house. Call. We walk the room and give you a number."
      image="/images/gallery-23-e.webp"
      imageAlt="Finished kitchen remodel by The Flip Fixer"
      service="kitchen"
      nextPath="/kitchen"
      messagePlaceholder="Neighborhood, the room, when you want to start."
      extras={{ job: "Kitchen" }}
      sent={sent}
      proofs={[
        {
          title: "Design in-house",
          body: "You are not waiting on a third-party designer. The crew that builds it draws it.",
        },
        {
          title: "You can stay in the house",
          body: "Floors covered. Work room by room. Living in a remodel is already enough.",
        },
        {
          title: "One price",
          body: "What is included, what is not, and a date. That is the number.",
        },
      ]}
    >
      <section className="mx-auto max-w-6xl px-4 pb-16">
        <QuoteEstimator initialService="kitchen" hideCta />
      </section>
    </AdsLanding>
  );
}
