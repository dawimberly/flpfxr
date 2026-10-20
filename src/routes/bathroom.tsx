import { createFileRoute } from "@tanstack/react-router";
import { CallTextActions } from "@/components/call-text-actions";
import { LeadForm } from "@/components/lead-form";
import { RemodelProjectProof, RemodelInquiryIntro } from "@/components/remodel-project-proof";
import { AREA_LINE, SITE } from "@/lib/site";

export const Route = createFileRoute("/bathroom")({
  component: BathroomLanding,
  validateSearch: (search: Record<string, unknown>) => {
    const sent = search.sent === "1" || search.sent === true;
    return sent ? { sent: true as const } : {};
  },
  head: () => ({
    meta: [
      { title: `Bathroom remodel | ${SITE.legalName}` },
      {
        name: "description",
        content: `Bathroom remodels in San Antonio. Show us the room and tell us what needs to change. ${AREA_LINE}`,
      },
    ],
  }),
});

function BathroomLanding() {
  const { sent } = Route.useSearch();
  return (
    <div>
      <header className="mx-auto max-w-6xl px-4 pb-8 pt-14 md:pt-16">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Bathrooms</p>
        <h1 className="mt-3 max-w-3xl font-display text-4xl font-semibold tracking-tight text-fg md:text-5xl">
          Bathroom remodels in San Antonio.
        </h1>
        <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted">
          Show us the bathroom and tell us what needs to change. Design in-house. Call, text, or
          send the job. We walk the room and give you a number.
        </p>
        <p className="mt-2 text-muted">{AREA_LINE}</p>
        <CallTextActions className="mt-6" />
      </header>

      <RemodelProjectProof service="bathroom" />

      <section id="send-job" className="mx-auto max-w-6xl scroll-mt-28 px-4 pb-16">
        <div className="rounded-2xl bg-surface p-6 shadow-[var(--shadow-border)] md:max-w-xl md:p-8">
          <RemodelInquiryIntro />
          <LeadForm
            sent={sent}
            nextPath="/bathroom"
            service="bathroom"
            source="bathroom-ad"
            compact
            messagePlaceholder="Neighborhood, scope, approximate budget, and when you want to start."
          />
        </div>
      </section>
    </div>
  );
}
