import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { CtaBand } from "@/components/site-shell";
import { TrustStrip } from "@/components/trust-strip";
import { Photo } from "@/components/photo";
import {
  AREA_PAGES,
  GALLERY,
  SERVICES,
  SITE,
} from "@/lib/site";

export const Route = createFileRoute("/areas/$slug")({
  loader: ({ params }) => {
    const area = AREA_PAGES.find((a) => a.slug === params.slug);
    if (!area) {
      throw notFound();
    }
    return { area };
  },
  head: ({ loaderData }) => {
    const area = loaderData?.area;
    const title = area
      ? `${area.name} Remodeling & Renovations | ${SITE.legalName}`
      : `Service Area | ${SITE.legalName}`;
    const description = area
      ? `${area.name} kitchen and bath remodels, flooring, paint, and repairs by ${SITE.legalName}. Call (210) 436-9117. ${area.intro.replace(/^TODO:\s*[^.]*\.\s*/i, "")}`
      : `${SITE.tagline} Call (210) 436-9117.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
      ],
    };
  },
  component: AreaDetailPage,
});

function AreaDetailPage() {
  const { area } = Route.useLoaderData();
  const cleanIntro = area.intro.replace(/^TODO:\s*[^.]*\.\s*/i, "");

  const highlighted = area.highlightedServices
    .map((id) => SERVICES.find((s) => s.id === id))
    .filter((s): s is (typeof SERVICES)[number] => Boolean(s));

  const galleryPhotos = area.galleryTag
    ? GALLERY.filter((item) => item.category === area.galleryTag).slice(0, 4)
    : [];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "HomeAndConstructionBusiness",
    name: `${SITE.legalName} - ${area.name}`,
    telephone: SITE.phone,
    url: `${SITE.url}/areas/${area.slug}`,
    image: `${SITE.url}/images/gallery-01-a.webp`,
    priceRange: "$$",
    areaServed: {
      "@type": "AdministrativeArea",
      name: area.name,
    },
    address: {
      "@type": "PostalAddress",
      addressLocality: area.name,
      addressRegion: "TX",
      addressCountry: "US",
    },
    description: cleanIntro,
  };

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <header className="mx-auto max-w-3xl px-4 pb-10 pt-14 text-center md:pt-20">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
          Service Area
        </p>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-fg md:text-5xl">
          {area.name} Remodeling &amp; Renovations
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-muted">
          {cleanIntro}
        </p>
      </header>

      <div className="mx-auto max-w-6xl px-4 pb-12">
        <TrustStrip />
      </div>

      <section className="mx-auto max-w-6xl px-4 pb-16">
        <h2 className="font-display text-center text-2xl font-semibold text-fg sm:text-3xl">
          Popular Services in {area.name}
        </h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {highlighted.map((service) => (
            <article
              key={service.id}
              className="flex h-full flex-col items-center rounded-2xl bg-surface p-6 text-center shadow-[var(--shadow-border)] sm:p-8"
            >
              <h3 className="font-display text-xl text-fg">{service.title}</h3>
              <p className="mt-2 max-w-xs flex-1 text-sm leading-relaxed text-muted">
                {service.body}
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
                <Link
                  to="/contact"
                  search={{ service: service.id }}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  Get a price
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      {galleryPhotos.length > 0 ? (
        <section className="mx-auto max-w-6xl px-4 pb-16">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="font-display text-2xl font-semibold text-fg sm:text-3xl">
                Recent Work
              </h2>
              <p className="mt-2 text-sm text-muted">
                Kitchen, bath, and interior remodels across the San Antonio area.
              </p>
            </div>
            <Link
              to="/gallery"
              className="text-sm font-medium text-primary hover:underline"
            >
              View all photos &rarr;
            </Link>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {galleryPhotos.map((photo, index) => (
              <div
                key={index}
                className="overflow-hidden rounded-2xl shadow-[var(--shadow-border)]"
              >
                <Photo
                  src={photo.src}
                  alt={photo.alt}
                  className="aspect-square w-full object-cover"
                />
                <div className="bg-surface p-3 text-center">
                  <p className="text-sm font-medium text-fg">{photo.title}</p>
                  <p className="text-xs text-muted">{photo.caption}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <CtaBand
        title={`Need work done in ${area.name}?`}
        body="Call, text, or send the job. We pick up and walk the job."
      />
    </div>
  );
}
