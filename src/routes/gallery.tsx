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
  view?: "before-after";
};

function isServiceId(value: string): value is ServiceId {
  return SERVICES.some((s) => s.id === value);
}

export const Route = createFileRoute("/gallery")({
  component: GalleryPage,
  validateSearch: (search: Record<string, unknown>): Search => ({
    service:
      typeof search.service === "string" && isServiceId(search.service)
        ? search.service
        : undefined,
    view: search.view === "before-after" ? "before-after" : undefined,
  }),
  head: () => ({
    meta: [
      { title: `Gallery | ${SITE.legalName}` },
      {
        name: "description",
        content:
          "Kitchens, baths, patios, and repairs from The Flip Fixer in San Antonio. Real jobs, finished.",
      },
    ],
  }),
});

function GalleryPage() {
  const { service, view } = Route.useSearch();
  const beforeAfter = view === "before-after";
  const current = beforeAfter
    ? undefined
    : SERVICES.find((s) => s.id === service);

  return (
    <div>
      <PageIntro
        eyebrow="Gallery"
        title={beforeAfter ? "Before and after." : current ? current.title : "Jobs."}
      >
        <p>
          {beforeAfter
            ? "Same house. Same crew. Drag the photos, or swipe the job."
            : current
              ? current.body
              : "Each job stays together. Kitchen, bath, outdoor, and the rest."}
        </p>
      </PageIntro>

      <section className="mx-auto max-w-6xl px-4 pb-8">
        <div className="flex flex-wrap gap-2">
          {GALLERY_FILTERS.map((filter) => {
            const active = filter.view
              ? beforeAfter
              : !beforeAfter && filter.id === service;
            return (
              <Link
                key={filter.label}
                to="/gallery"
                search={
                  filter.view
                    ? { view: "before-after" }
                    : filter.id
                      ? { service: filter.id }
                      : {}
                }
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
        <GalleryGrid service={beforeAfter ? undefined : service} beforeAfter={beforeAfter} />
      </section>

      <CtaBand />
    </div>
  );
}
