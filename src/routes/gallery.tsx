import { createFileRoute, Link } from "@tanstack/react-router";
import { GalleryGrid } from "@/components/gallery-lightbox";
import { CtaBand, PageIntro } from "@/components/site-shell";
import {
  GALLERY_FILTERS,
  SERVICES,
  SITE,
  type ServiceId,
} from "@/lib/site";
import { cn } from "@/lib/utils";

type Search = {
  service?: ServiceId;
};

const SERVICE_IDS = new Set(SERVICES.map((s) => s.id));

export const Route = createFileRoute("/gallery")({
  component: GalleryPage,
  validateSearch: (search: Record<string, unknown>): Search => ({
    service:
      typeof search.service === "string" && SERVICE_IDS.has(search.service as ServiceId)
        ? (search.service as ServiceId)
        : undefined,
  }),
  head: () => ({
    meta: [
      { title: `Gallery | ${SITE.legalName}` },
      {
        name: "description",
        content:
          "Kitchens, baths, patios, and carpentry from The Flip Fixer in San Antonio. Real jobs, finished.",
      },
    ],
  }),
});

function GalleryPage() {
  const { service } = Route.useSearch();
  const current = SERVICES.find((s) => s.id === service);

  return (
    <div>
      <PageIntro eyebrow="Gallery" title={current ? current.title : "Jobs."}>
        <p>
          {current
            ? current.body
            : "Each job stays together. Kitchen, bath, outdoor, and the rest."}
        </p>
      </PageIntro>

      <section className="mx-auto max-w-6xl px-4 pb-8">
        <div className="flex flex-wrap gap-2">
          {GALLERY_FILTERS.map((filter) => {
            const active = filter.id === service;
            return (
              <Link
                key={filter.label}
                to="/gallery"
                search={filter.id ? { service: filter.id } : {}}
                className={cn(
                  "inline-flex h-10 items-center rounded-lg px-4 text-sm font-medium",
                  active
                    ? "bg-primary text-primary-fg"
                    : "bg-surface text-fg shadow-[var(--shadow-border)] hover:shadow-[var(--shadow-border-hover)]",
                )}
              >
                {filter.label}
              </Link>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16">
        <GalleryGrid service={service} />
      </section>

      <CtaBand />
    </div>
  );
}
