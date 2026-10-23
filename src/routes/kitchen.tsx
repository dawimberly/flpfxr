import { createFileRoute } from "@tanstack/react-router";
import { LeadForm } from "@/components/lead-form";
import {
  FeaturedProjectPhoto,
  MoreProjectPhotos,
  ProjectTellButton,
  RemodelInquiryIntro,
} from "@/components/remodel-project-proof";
import { AREA_LINE, PROJECT_FIT, SITE } from "@/lib/site";

export const Route = createFileRoute("/kitchen")({
  component: KitchenLanding,
  validateSearch: (search: Record<string, unknown>) => {
    const sent = search.sent === "1" || search.sent === true;
    return sent ? { sent: true as const } : {};
  },
  head: () => ({
    links: [{ rel: "canonical", href: `${SITE.url}/kitchen` }],
    meta: [
      { title: `Kitchen Remodeling in San Antonio | ${SITE.legalName}` },
      {
        name: "description",
        content: `Kitchen remodels in San Antonio. Indoor, full-room remodels. ${AREA_LINE}`,
      },
    ],
  }),
});

function KitchenLanding() {
  const { sent } = Route.useSearch();
  return (
    <div>
      <header className="mx-auto max-w-6xl px-4 pb-6 pt-6 md:pt-16">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Kitchens</p>
        <h1 className="mt-3 max-w-3xl font-display text-4xl font-semibold tracking-tight text-fg md:text-5xl">
          Kitchen remodels in San Antonio.
        </h1>
        <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted">
          Cabinets, counters, and floors. We walk the room and give you a number.
        </p>
        <p className="mt-3 max-w-xl text-lg leading-relaxed text-fg">{PROJECT_FIT}</p>
        <p className="mt-2 text-muted">{AREA_LINE}</p>
        <ProjectTellButton className="mt-6 w-full sm:w-auto" />
      </header>

      <FeaturedProjectPhoto service="kitchen" />

      <section id="send-job" className="mx-auto max-w-6xl scroll-mt-28 px-4 pb-16">
        <div className="rounded-2xl bg-surface p-6 shadow-[var(--shadow-border)] md:max-w-xl md:p-8">
          <RemodelInquiryIntro />
          <LeadForm
            sent={sent}
            nextPath="/kitchen"
            service="kitchen"
            source="kitchen-ad"
            compact
            messagePlaceholder="Neighborhood, the room, what you want to change, and when you want to start."
          />
        </div>
      </section>

      <MoreProjectPhotos service="kitchen" />
    </div>
  );
}
