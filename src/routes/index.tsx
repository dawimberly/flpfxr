import { createFileRoute, Link } from "@tanstack/react-router";
import { CallTextActions } from "@/components/call-text-actions";
import { CallLink, CallNumber } from "@/components/call-link";
import { LeadForm } from "@/components/lead-form";
import { ProjectTellButton } from "@/components/remodel-project-proof";
import { Photo } from "@/components/photo";
import {
  SITE,
  AREA_LINE,
  FEATURED_REVIEW,
  SERVICE_AREAS,
} from "@/lib/site";

export const Route = createFileRoute("/")({
  component: Home,
  validateSearch: (search: Record<string, unknown>) => {
    const sent = search.sent === "1" || search.sent === true;
    return sent ? { sent: true as const } : {};
  },
  head: () => ({
    scripts: [{ type: "application/ld+json", children: JSON.stringify({
      "@context": "https://schema.org",
      "@type": "GeneralContractor",
      "@id": `${SITE.url}/#business`,
      name: SITE.name,
      url: `${SITE.url}/`,
      telephone: `+1${SITE.phone}`,
      email: SITE.email,
      description: SITE.tagline,
      logo: `${SITE.url}/logo.svg`,
      image: `${SITE.url}/og.jpg`,
      areaServed: SERVICE_AREAS.map(name => ({ "@type": "Place", name: `${name}, Texas` })),
    }).replace(/</g, "\\u003c") }],
    links: [{ rel: "canonical", href: `${SITE.url}/` }],
    meta: [
      { title: `Kitchen & Bathroom Remodeling in San Antonio | ${SITE.name}` },
      {
        name: "description",
        content:
          `Kitchen and bath remodels in San Antonio. Call or text ${SITE.phoneDisplay}. ${SITE.tagline} ${AREA_LINE}`,
      },
    ],
  }),
});

function Home() {
  const { sent } = Route.useSearch();
  return (
    <div>
      <section className="relative isolate overflow-hidden">
        <Photo
          src="/images/gallery-01-a.webp"
          alt="Farmhouse kitchen remodel by The Flip Fixer"
          className="absolute inset-0 size-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/55 to-bg/25" />
        <div className="relative mx-auto flex max-w-6xl flex-col items-start px-4 pb-4 pt-4 md:min-h-[32rem] md:justify-end md:pb-20 md:pt-36">
          <h1 className="max-w-2xl font-display text-4xl font-semibold tracking-tight text-fg sm:text-5xl md:text-6xl">
            Kitchen and bathroom remodeling in San Antonio.
          </h1>
          <p className="mt-4 max-w-xl text-lg text-fg/90 md:text-xl">
            Full-room remodels with in-house design, one crew from start to finish,
            and clear communication throughout the job.
          </p>
          <p className="mt-2 text-fg/75">{AREA_LINE}</p>
          <CallTextActions className="mt-8 hidden sm:flex" />
          <ProjectTellButton className="mt-4 w-full sm:w-auto" />
        </div>
      </section>


      <section className="border-b border-border bg-surface px-4 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="font-display text-2xl font-semibold text-fg">How much might your project cost?</h2>
            <p className="mt-2 text-muted">Select kitchen, bathroom, paint, flooring or another service and a project size.</p>
          </div>
          <Link to="/estimate" className="inline-flex min-h-11 items-center justify-center rounded-lg bg-primary px-6 py-3 font-semibold text-primary-fg hover:opacity-90">Get a ballpark estimate</Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 md:py-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-3xl font-semibold text-fg">Recent remodels</h2>
            <p className="mt-3 text-muted">See what we’ve built for homeowners around San Antonio.</p>
          </div>
          <Link to="/gallery" className="font-medium text-primary hover:underline">See the full gallery</Link>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {[
            { src: "/images/gallery-23-d.webp", alt: "Herringbone floor kitchen after remodel" },
            { src: "/images/gallery-17-a.webp", alt: "Navy island kitchen with gold fixtures" },
            { src: "/images/gallery-03-a.webp", alt: "Charcoal and gray remodeled kitchen" },
          ].map((photo) => (
            <Link key={photo.src} to="/gallery" className="overflow-hidden rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <Photo src={photo.src} alt={photo.alt} loading="lazy" className="aspect-[4/3] w-full object-cover" />
            </Link>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3">
          <Link to="/kitchen" className="font-medium text-primary hover:underline">Kitchen remodeling</Link>
          <Link to="/bathroom" className="font-medium text-primary hover:underline">Bathroom remodeling</Link>
          <Link to="/services" className="font-medium text-primary hover:underline">Other services</Link>
        </div>
      </section>

      <section className="bg-surface px-4 py-12 md:py-16">
        <div className="mx-auto max-w-3xl">
          <h2 className="font-display text-3xl font-semibold text-fg md:text-4xl">
            Reviews
          </h2>
          <p className="mt-4 text-muted">
            In-house design. Experienced contractors. Hear from a repeat customer.
          </p>
          <figure className="mt-8 rounded-2xl border border-primary/25 bg-bg p-6 md:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
              Three years of trust
            </p>
            <blockquote className="mt-4 font-display text-2xl leading-relaxed text-fg md:text-3xl">
              &ldquo;{FEATURED_REVIEW.excerpt}&rdquo;
            </blockquote>
            <figcaption className="mt-4 text-sm">
              <span className="font-medium text-fg">{FEATURED_REVIEW.name}</span>
              <span className="text-subtle"> · {FEATURED_REVIEW.source}</span>
            </figcaption>
            <Link to="/testimonials" className="mt-4 inline-block text-sm font-medium text-primary hover:underline">
              Read her full review
            </Link>
          </figure>

        </div>
      </section>

      <section
        id="send-job"
        className="scroll-mt-28 border-b border-border bg-surface px-4 py-12 md:py-16"
      >
        <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-2 md:items-start md:gap-14">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
              Send the job
            </p>
            <h2 className="mt-3 font-display text-2xl font-semibold text-fg md:text-3xl">
              Tell us what you need.
            </h2>
            <p className="mt-3 text-muted">
              Neighborhood, the room, and what you want to change. We call or
              text you back.
            </p>
            <div className="mt-6 hidden md:block">
              <CallLink className="text-lg font-semibold text-primary hover:text-primary-hover">
                Prefer the phone? Call <CallNumber />
              </CallLink>
            </div>
          </div>
          <div className="rounded-2xl bg-bg p-5 shadow-[var(--shadow-border)] md:p-7">
            <LeadForm
              sent={sent}
              nextPath="/"
              source="homepage"
              compact
              messagePlaceholder="Neighborhood, the job, and when you want someone out."
            />
          </div>
        </div>
      </section>
    </div>
  );
}
