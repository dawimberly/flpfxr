import { createFileRoute } from "@tanstack/react-router";
import { CtaBand, PageIntro } from "@/components/site-shell";
import { REVIEWS, SITE, TESTIMONIALS } from "@/lib/site";

export const Route = createFileRoute("/testimonials")({
  component: TestimonialsPage,
  head: () => ({
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

      {REVIEWS.googleUrl ? (
        <div className="mx-auto max-w-6xl -mt-4 px-4 pb-10 text-center">
          <a
            href={REVIEWS.googleUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
          >
            Read all our Google reviews &rarr;
          </a>
        </div>
      ) : null}

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
              <p className="text-sm text-subtle">
                {t.place}
                {t.date ? ` · ${t.date}` : null}
                {t.source ? ` · via ${t.source}` : null}
              </p>
            </footer>
          </blockquote>
        ))}
      </section>

      <CtaBand />
    </div>
  );
}
