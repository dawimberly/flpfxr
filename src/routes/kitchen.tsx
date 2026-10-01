import { createFileRoute } from "@tanstack/react-router";
import { CallTextActions } from "@/components/call-text-actions";
import { LeadForm } from "@/components/lead-form";
import { PageIntro } from "@/components/site-shell";
import { AREA_LINE, SITE } from "@/lib/site";

export const Route = createFileRoute("/kitchen")({
  component: KitchenPage,
  validateSearch: (search: Record<string, unknown>) => {
    const sent = search.sent === "1" || search.sent === true;
    return sent ? { sent: true as const } : {};
  },
  head: () => ({
    meta: [
      { title: "Kitchen Remodels | The Flip Fixer" },
      {
        name: "description",
        content:
          "Kitchen remodels in San Antonio. Cabinets, counters, floors. Call, text, or send the job.",
      },
    ],
  }),
});

function KitchenPage() {
  const { sent } = Route.useSearch();
  return (
    <div>
      <header className="mx-auto max-w-6xl px-4 pb-10 pt-14 md:pt-20">
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
        <CallTextActions linkLocation="hero" className="mt-6" />
      </header>

      <section
        id="send-job"
        className="mx-auto max-w-6xl scroll-mt-28 px-4 pb-16"
      >
        <div className="rounded-2xl bg-surface p-5 shadow-[var(--shadow-border)] md:p-7">
          <LeadForm
            sent={Boolean(sent)}
            nextPath="/kitchen"
            service="kitchen"
            source="kitchen-ads"
          />
        </div>
      </section>
    </div>
  );
}
