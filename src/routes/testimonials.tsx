import { createFileRoute } from "@tanstack/react-router";
import { CtaBand, PageIntro } from "@/components/site-shell";
import { SITE, TESTIMONIALS, FEATURED_REVIEW } from "@/lib/site";

export const Route = createFileRoute("/testimonials")({
  component: TestimonialsPage,
  head: () => ({
    links: [{ rel: "canonical", href: `${SITE.url}/testimonials` }],
    meta: [
      { title: `Reviews | ${SITE.legalName}` },
      {
        name: "description",
        content:
          "What San Antonio homeowners say about The Flip Fixer. Fast, clean, and the job actually got finished.",
      },
    ],
  }),
});

function TestimonialsPage() {
  return (
    <div>
      <PageIntro eyebrow="Reviews" title="What people said." />

      <section aria-labelledby="featured-review-title" className="mx-auto max-w-6xl px-4 pb-10">
        <figure className="rounded-2xl border border-primary/25 bg-surface p-7 md:p-10">
          <h2 id="featured-review-title" className="font-display text-2xl font-semibold text-fg md:text-3xl">
            Three years of projects. A relationship built on trust.
          </h2>
          <blockquote className="mt-6 whitespace-pre-line leading-relaxed text-fg/90">
            {FEATURED_REVIEW.quote}
          </blockquote>
          <figcaption className="mt-6">
            <p className="font-semibold text-fg">{FEATURED_REVIEW.name}</p>
            <p className="text-sm text-subtle">{FEATURED_REVIEW.source}</p>
          </figcaption>
        </figure>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-4 pb-16 md:grid-cols-2 lg:grid-cols-3">
        {TESTIMONIALS.map((t) => (
          <blockquote
            key={t.name}
            className="flex flex-col rounded-2xl bg-surface p-7 shadow-[var(--shadow-border)]"
          >
            <span
              aria-hidden
              className="font-display text-6xl leading-none text-primary/40"
            >
              &ldquo;
            </span>
            <p className="-mt-4 flex-1 text-fg/90">{t.quote}</p>
            <footer className="mt-6">
              <p className="font-semibold text-fg">{t.name}</p>
              <p className="text-sm text-subtle">{t.place}</p>
            </footer>
          </blockquote>
        ))}
      </section>

      <CtaBand />
    </div>
  );
}
