import { createFileRoute } from "@tanstack/react-router";
import { AdsLanding } from "@/components/ads-landing";
import { AREA_LINE, SITE } from "@/lib/site";

type Search = { sent?: boolean };

export const Route = createFileRoute("/roof")({
  component: RoofLanding,
  validateSearch: (search: Record<string, unknown>): Search => ({
    ...(search.sent === "1" || search.sent === true ? { sent: true } : {}),
  }),
  head: () => ({
    meta: [
      { title: `Roof repair and replacement | ${SITE.legalName}` },
      {
        name: "description",
        content: `Roof repair and replacement in San Antonio. Call ${SITE.phoneDisplay}. We walk the job. ${AREA_LINE}`,
      },
    ],
  }),
});

function RoofLanding() {
  const { sent } = Route.useSearch();

  return (
    <AdsLanding
      eyebrow="Roofing"
      title="Roof repair and replacement in San Antonio."
      body="Leaks, storm damage, or a roof that is done. Call. We walk it and give you a number."
      image="/images/gallery-22-d.webp"
      imageAlt="New roof going on during a rebuild by The Flip Fixer"
      service="roofing"
      nextPath="/roof"
      messagePlaceholder="Address, leak or storm, when you want someone out."
      extras={{ job: "Roofing" }}
      sent={sent}
      proofs={[
        {
          title: "We walk it free",
          body: "A planning range from the address is a start. The number you can use comes after we are on the roof.",
        },
        {
          title: "Storm and insurance rebuilds",
          body: "Hail, wind, fire. We document the damage and finish the house, not just the shingles.",
        },
        {
          title: "Same crew",
          body: "The person who looked at the job owns it through the last shingle.",
        },
      ]}
    />
  );
}
