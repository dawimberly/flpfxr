import { publicPageMeta } from "@/lib/public-page-meta";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { OwnerTodo } from "@/components/owner-todo";
import { Photo } from "@/components/photo";
import { CtaBand, PageIntro } from "@/components/site-shell";
import { type AreaLink, type AreaPage, areaBySlug } from "@/lib/areas";
import { PROCESS, SITE, TESTIMONIALS } from "@/lib/site";

export const Route = createFileRoute("/areas/$slug")({
  loader: ({ params }) => {
    const area = areaBySlug(params.slug);
    if (!area) throw notFound();
    return area;
  },
  head: ({ loaderData }) =>
    loaderData
      ? {
          meta: publicPageMeta([
            { title: `${loaderData.title} | ${SITE.name}` },
            { name: "description", content: loaderData.description },
          ]),
          links: [{ rel: "canonical", href: `${SITE.url}/areas/${loaderData.slug}` }],
        }
      : {},
  component: AreaPageView,
  notFoundComponent: () => (
    <PageIntro title="Area not found">
      <Link to="/areas" className="text-primary">
        See service areas
      </Link>
    </PageIntro>
  ),
});

function AreaLinks({ links }: { links: readonly AreaLink[] }) {
  return (
    <div className="mt-8 flex flex-col items-start gap-3">
      {links.map((link) => {
        const className = "font-medium text-primary hover:underline";
        if (link.to === "/blog/$slug") {
          return (
            <Link key={link.label} to="/blog/$slug" params={{ slug: link.slug }} className={className}>
              {link.label}
            </Link>
          );
        }
        if (link.to === "/areas/$slug") {
          return (
            <Link key={link.label} to="/areas/$slug" params={{ slug: link.slug }} className={className}>
              {link.label}
            </Link>
          );
        }
        if (link.to === "/contact") {
          return (
            <Link
              key={link.label}
              to="/contact"
              search={link.service ? { service: link.service } : {}}
              className={className}
            >
              {link.label}
            </Link>
          );
        }
        return (
          <Link key={link.label} to={link.to} className={className}>
            {link.label}
          </Link>
        );
      })}
    </div>
  );
}

function AreaReview({ area }: { area: AreaPage }) {
  if (!area.reviewName) return null;
  const review = TESTIMONIALS.find((item) => item.name === area.reviewName);
  if (!review) return null;
  return (
    <figure className="mt-8 rounded-2xl border border-primary/25 bg-surface p-6 text-left">
      <blockquote className="leading-relaxed text-fg/90">&ldquo;{review.quote}&rdquo;</blockquote>
      <figcaption className="mt-4 text-sm">
        <span className="font-medium text-fg">{review.name}</span>
        <span className="text-subtle"> · {review.place}</span>
      </figcaption>
    </figure>
  );
}

function AreaPageView() {
  const area: AreaPage = Route.useLoaderData();
  return (
    <div>
      <PageIntro eyebrow={area.name} title={area.title} />
      <article className="mx-auto max-w-3xl px-4 pb-16">
        {area.paragraphs.map((paragraph) => (
          <p key={paragraph} className="mt-4 text-lg leading-relaxed text-muted first:mt-0">
            {paragraph}
          </p>
        ))}
        <AreaReview area={area} />
        {area.photos?.length ? (
          <section aria-label="Project photos" className="mt-8 space-y-8">
            {area.photos.map((photo) => (
              <figure key={photo.src}>
                <Photo
                  src={photo.src}
                  alt={photo.alt}
                  loading="lazy"
                  className="photo-frame aspect-[4/3] w-full object-cover"
                />
                <figcaption className="mt-3 text-sm text-muted">{photo.caption}</figcaption>
              </figure>
            ))}
          </section>
        ) : null}
        <AreaLinks links={area.links} />
        <OwnerTodo items={area.todos} />
      </article>

      {area.showProcess ? (
        <section className="mx-auto grid max-w-6xl gap-4 px-4 pb-16 sm:grid-cols-2 lg:grid-cols-4">
          {PROCESS.map((item) => (
            <article key={item.step} className="rounded-2xl bg-surface p-6 shadow-[var(--shadow-border)]">
              <p className="font-display text-5xl font-semibold text-primary">{item.step}.</p>
              <h2 className="mt-3 font-display text-xl text-fg">{item.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">{item.body}</p>
            </article>
          ))}
        </section>
      ) : null}

      <CtaBand
        title={`Work in ${area.name}?`}
        body={`Call or text ${SITE.phoneDisplay}. Say the neighborhood and what you want to change.`}
        contact
      />
    </div>
  );
}
