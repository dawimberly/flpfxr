import { createFileRoute } from "@tanstack/react-router";
import { CallTextActions } from "@/components/call-text-actions";
import { LeadForm } from "@/components/lead-form";
import { AREA_LINE, SITE } from "@/lib/site";

export const Route = createFileRoute("/kitchen")({
  component: KitchenLanding,
  validateSearch: (search: Record<string, unknown>) => {
    const sent = search.sent === "1" || search.sent === true;
    return sent ? { sent: true as const } : {};
  },
  head: () => ({
    meta: [
      { title: `Kitchen remodel | ${SITE.legalName}` },
      {
        name: "description",
        content: `Kitchen remodels in San Antonio. Call or text ${SITE.phoneDisplay}. Design in-house. ${AREA_LINE}`,
      },
    ],
  }),
});

function KitchenLanding() {
  const { sent } = Route.useSearch();
  return (
    <div>
      <header className="mx-auto max-w-6xl px-4 pb-8 pt-14 md:pt-16">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
          Kitchens
        </p>
        <h1 className="mt-3 max-w-3xl font-display text-4xl font-semibold tracking-tight text-fg md:text-5xl">
          Kitchen remodels in San Antonio.
        </h1>
        <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted">
          Cabinets, counters, floors. Design in-house. Call, text, or send the
          job. We walk the room and give you a number.
        </p>
        <p className="mt-2 text-muted">{AREA_LINE}</p>
        <CallTextActions className="mt-6" />
      </header>

      <section
        id="send-job"
        className="mx-auto max-w-6xl scroll-mt-28 px-4 pb-16"
      >
        <div className="rounded-2xl bg-surface p-6 shadow-[var(--shadow-border)] md:max-w-xl md:p-8">
          <LeadForm
            sent={sent}
            nextPath="/kitchen"
            service="kitchen"
            source="kitchen-ad"
            compact
            messagePlaceholder="Neighborhood, the room, when you want to start."
          />
        </div>
      </section>
    </div>
  );
}
