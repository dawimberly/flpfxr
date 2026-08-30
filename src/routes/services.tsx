import { createFileRoute, Link } from "@tanstack/react-router";
import { QuoteEstimator } from "@/components/quote-estimator";
import { CtaBand, PageIntro } from "@/components/site-shell";
import { SERVICES, SITE, AREA_LINE } from "@/lib/site";

export const Route = createFileRoute("/services")({
  component: ServicesPage,
  head: () => ({
    meta: [
      { title: `Services | ${SITE.legalName}` },
      {
        name: "description",
        content:
          `Kitchen and bath, handyman, flooring, paint, outdoor, and make-ready. ${AREA_LINE} Call (210) 436-9117.`,
      },
    ],
  }),
});

const GROUPS = ["Remodels", "Make-ready", "Repairs", "Specialty"] as const;

function ServicesPage() {
  return (
    <div>
      <PageIntro eyebrow="Services" title="What we do">
        <p>
          Kitchen and bath remodels, flooring, paint, and make-ready work.
          {AREA_LINE}
        </p>
      </PageIntro>

      {GROUPS.map((group) => {
        const items = SERVICES.filter((s) => s.group === group);
        return (
          <section
            key={group}
            className="mx-auto max-w-6xl px-4 pb-16"
          >
            <h2 className="font-display text-2xl text-primary">{group}</h2>
            <div className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {items.map((service) => (
                <article
                  id={service.id}
                  key={service.id}
                  className="scroll-mt-28 overflow-hidden rounded-2xl bg-surface shadow-[var(--shadow-border)]"
                >
                  <img
                    src={service.image}
                    alt=""
                    className="photo-frame h-48 w-full object-cover"
                  />
                  <div className="p-6">
                    <h3 className="font-display text-xl text-fg">
                      {service.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted">
                      {service.body}
                    </p>
                    <Link
                      to="/contact"
                      search={{ service: service.id }}
                      className="mt-4 inline-block text-sm font-medium text-primary hover:underline"
                    >
                      Get a price
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </section>
        );
      })}

      <section className="bg-surface px-4 py-16 md:py-24">
        <div className="mx-auto max-w-xl">
          <QuoteEstimator compact />
        </div>
      </section>

      <CtaBand />
    </div>
  );
}
