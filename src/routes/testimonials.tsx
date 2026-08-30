import { createFileRoute } from "@tanstack/react-router";
import { CtaBand, PageIntro } from "@/components/site-shell";
import { SITE, TESTIMONIALS } from "@/lib/site";

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
