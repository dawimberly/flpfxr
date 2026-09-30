import { createFileRoute, Link } from "@tanstack/react-router";
import { CtaBand, PageIntro } from "@/components/site-shell";
import { TrustStrip } from "@/components/trust-strip";
import {
  AREA_PAGES,
  PROCESS,
  SERVICE_AREAS,
  SERVICES,
  SITE,
  AREA_LINE,
  serviceHasWork,
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

const GROUPS = [
  {
    name: "Remodels",
    /** Three across */
    grid: "grid-cols-1 sm:grid-cols-3",
    center: false,
  },
  {
    name: "Make-ready",
    /** Single window, centered */
    grid: "grid-cols-1 max-w-sm mx-auto",
    center: true,
  },
  {
    name: "Repairs",
    /** Single window, centered */
    grid: "grid-cols-1 max-w-sm mx-auto",
    center: true,
  },
  {
    name: "Specialty",
    /** Three across; a lone fourth card (Walkthrough) centers under them */
    grid: "grid-cols-1 sm:grid-cols-3 sm:[&>:last-child:nth-child(3n+1)]:col-start-2",
    center: false,
  },
] as const;

function ServiceCard({
  service,
}: {
  service: (typeof SERVICES)[number];
}) {
  return (
    <article
      id={service.id}
      className="scroll-mt-28 flex h-full flex-col items-center rounded-2xl bg-surface p-6 text-center shadow-[var(--shadow-border)] sm:p-8"
    >
      <h3 className="font-display text-2xl text-fg">{service.title}</h3>
      <p className="mt-2 max-w-xs flex-1 text-sm leading-relaxed text-muted">
        {service.body}
      </p>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
        {service.id === "roofing" ? (
          <Link
            to="/roof"
            className="text-sm font-medium text-primary hover:underline"
          >
            Measure this roof
          </Link>
        ) : (
          <Link
            to="/contact"
            search={{ service: service.id }}
            className="text-sm font-medium text-primary hover:underline"
          >
            Get a price
          </Link>
        )}
        {serviceHasWork(service.id) ? (
          <Link
            to="/gallery"
            search={{ service: service.id }}
            className="text-sm font-medium text-muted hover:text-primary hover:underline"
          >
            See the work
          </Link>
        ) : null}
      </div>
    </article>
  );
}

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

      <div className="mx-auto max-w-6xl px-4 pb-12">
        <TrustStrip />
      </div>

      <div className="mx-auto max-w-6xl space-y-14 px-4 pb-16">
        {GROUPS.map((group) => {
          const items = SERVICES.filter((s) => s.group === group.name);
          return (
            <section key={group.name} className="text-center">
              <h2 className="font-display text-xl text-primary">{group.name}</h2>
              <div className={`mt-6 grid gap-4 ${group.grid}`}>
                {items.map((service) => (
                  <ServiceCard key={service.id} service={service} />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <section className="mx-auto max-w-6xl px-4 pb-16 text-center">
        <h2 className="font-display text-xl text-primary">Service areas</h2>
        <p className="mt-2 text-sm text-muted">
          Remodels, make-ready, and repairs across the greater San Antonio area.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          {SERVICE_AREAS.map((areaName) => {
            const page = AREA_PAGES.find((a) => a.name === areaName);
            return page ? (
              <Link
                key={areaName}
                to="/areas/$slug"
                params={{ slug: page.slug }}
                className="inline-flex h-9 items-center rounded-lg bg-surface px-3.5 text-sm font-medium text-fg shadow-[var(--shadow-border)] hover:text-primary hover:shadow-[var(--shadow-border-hover)]"
              >
                {areaName}
              </Link>
            ) : (
              <span
                key={areaName}
                className="inline-flex h-9 items-center rounded-lg px-3.5 text-sm text-muted"
              >
                {areaName}
              </span>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16">
        <h2 className="font-display text-center text-2xl font-semibold text-fg sm:text-3xl">
          How a job goes
        </h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PROCESS.map((item) => (
            <article
              key={item.step}
              className="rounded-2xl bg-surface p-6 shadow-[var(--shadow-border)]"
            >
              <p className="font-display text-4xl font-semibold text-primary">
                {item.step}.
              </p>
              <h3 className="mt-2 font-display text-lg text-fg">{item.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                {item.body}
              </p>
            </article>
          ))}
        </div>
      </section>

      <CtaBand />
    </div>
  );
}
