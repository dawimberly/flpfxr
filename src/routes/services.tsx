import { createFileRoute, Link } from "@tanstack/react-router";
import { CtaBand, PageIntro } from "@/components/site-shell";
import {
  HOME_SERVICES,
  SERVICES,
  SITE,
  AREA_LINE,
} from "@/lib/site";

export const Route = createFileRoute("/services")({
  component: ServicesPage,
  head: () => ({
    meta: [
      { title: `Services | ${SITE.legalName}` },
      {
        name: "description",
        content:
          `Kitchen and bath, flooring, paint, outdoor, make-ready, and insurance claims. ${AREA_LINE} Call (210) 436-9117.`,
      },
    ],
  }),
});

const featured = HOME_SERVICES.map(
  (id) => SERVICES.find((s) => s.id === id)!,
);

function ServicesPage() {
  return (
    <div>
      <PageIntro eyebrow="Services" title="What we do">
        <p>
          {SITE.tagline} {AREA_LINE}
        </p>
        <p className="mt-3">
          Photos are on the{" "}
          <Link to="/gallery" className="font-medium text-primary">
            Gallery
          </Link>
          .
        </p>
      </PageIntro>

      <section className="mx-auto max-w-4xl px-4 pb-16">
        <div className="grid gap-4 sm:grid-cols-2">
          {featured.map((service) => (
            <article
              id={service.id}
              key={service.id}
              className="scroll-mt-28 flex flex-col items-center rounded-2xl bg-surface p-6 text-center shadow-[var(--shadow-border)] sm:p-8"
            >
              <h2 className="font-display text-2xl text-fg">{service.title}</h2>
              <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted">
                {service.body}
              </p>
              <Link
                to="/contact"
                search={{ service: service.id }}
                className="mt-auto pt-4 text-sm font-medium text-primary hover:underline"
              >
                Get a price
              </Link>
            </article>
          ))}
        </div>
        <p className="mt-10 text-center text-sm text-muted">
          Also flooring, paint, outdoor, and custom carpentry.{" "}
          <Link to="/gallery" className="font-medium text-primary hover:underline">
            See the Gallery
          </Link>
          .
        </p>
      </section>

      <CtaBand />
    </div>
  );
}
