import { publicPageMeta } from "@/lib/public-page-meta";
import { createFileRoute, Link } from "@tanstack/react-router";
import { OwnerTodo } from "@/components/owner-todo";
import { CtaBand, PageIntro } from "@/components/site-shell";
import { AREA_PAGES, areasWithoutPages } from "@/lib/areas";
import { SERVICE_AREAS, SITE, TESTIMONIALS } from "@/lib/site";

export const Route = createFileRoute("/areas/")({
  component: AreasIndex,
  head: () => ({
    links: [{ rel: "canonical", href: `${SITE.url}/areas` }],
    meta: publicPageMeta([
      { title: `Service areas | ${SITE.name}` },
      {
        name: "description",
        content: `Service areas for The Flip Fixer, including Alamo Heights, Stone Oak, Boerne, The Dominion, and Kerrville. Call ${SITE.phoneDisplay}.`,
      },
    ]),
  }),
});

function AreasIndex() {
  const hollywoodPark = TESTIMONIALS.find((review) => review.name === "Scott S.");
  return (
    <div>
      <PageIntro eyebrow="Service areas" title="Service areas around San Antonio">
        <p>
          {SERVICE_AREAS.length} places are on the list. Five have their own pages: the ones named in the short
          area line, plus Stone Oak, where a published review names a kitchen and a covered patio
          with green turf is a real job.
        </p>
      </PageIntro>

      <section className="mx-auto grid max-w-6xl gap-4 px-4 pb-10 md:grid-cols-2">
        {AREA_PAGES.map((area) => (
          <article key={area.slug} className="rounded-2xl bg-surface p-6 shadow-[var(--shadow-border)]">
            <h2 className="font-display text-2xl text-fg">
              <Link
                to="/areas/$slug"
                params={{ slug: area.slug }}
                className="hover:text-primary"
              >
                {area.name}
              </Link>
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted">{area.paragraphs[0]}</p>
            <Link
              to="/areas/$slug"
              params={{ slug: area.slug }}
              className="mt-4 inline-flex font-medium text-primary hover:underline"
            >
              {area.name} remodeling
            </Link>
          </article>
        ))}
      </section>

      <section className="mx-auto max-w-3xl px-4 pb-16">
        <h2 className="font-display text-2xl text-fg">Also on the list</h2>
        <p className="mt-3 text-lg leading-relaxed text-muted">
          {areasWithoutPages().join(", ")}. These do not have their own pages. San Antonio is the
          home city for the rest of the site. Call {SITE.phoneDisplay} and name the neighborhood.
        </p>
        {hollywoodPark ? (
          <figure className="mt-8 rounded-2xl border border-border bg-surface p-6">
            <blockquote className="text-fg/90">&ldquo;{hollywoodPark.quote}&rdquo;</blockquote>
            <figcaption className="mt-4 text-sm">
              <span className="font-medium text-fg">{hollywoodPark.name}</span>
              <span className="text-subtle"> · {hollywoodPark.place}</span>
            </figcaption>
            <p className="mt-3 text-sm text-muted">
              Hollywood Park is on the service list and does not have its own page. This is the
              review that names it.
            </p>
          </figure>
        ) : null}
        <OwnerTodo
          items={[
            "Add a page for Hollywood Park, Terrell Hills, Olmos Park, Shavano Park, Fair Oaks Ranch, Helotes, New Braunfels, or Fredericksburg only when you have something specific to say about that place. Do not copy one city's page and swap the name.",
          ]}
        />
        <p className="mt-6">
          <Link to="/testimonials" className="font-medium text-primary hover:underline">
            All reviews
          </Link>
        </p>
      </section>

      <CtaBand />
    </div>
  );
}
