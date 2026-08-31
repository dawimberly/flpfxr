import { createFileRoute } from "@tanstack/react-router";
import { CtaBand, PageIntro } from "@/components/site-shell";
import { PROCESS, SITE, AREA_LINE } from "@/lib/site";

export const Route = createFileRoute("/about")({
  component: AboutPage,
  head: () => ({
    meta: [
      { title: `About | ${SITE.legalName}` },
      {
        name: "description",
        content:
          `Flip Fixer remodels kitchens and baths, designs the work in-house, and gets rentals and listings ready to show. 30+ years on the tools. ${AREA_LINE}`,
      },
    ],
  }),
});

function AboutPage() {
  return (
    <div>
      <PageIntro eyebrow="About" title="Flip Fixer">
        <p>
          We remodel kitchens and baths, fix what's broken, and get
          rentals and listings ready to show. Design is handled in-house.
          30+ years on the tools. No middleman. No speeches. You get a
          price, a plan, and the job finished.
        </p>
      </PageIntro>

      <section className="mx-auto max-w-6xl px-4 pb-16">
        <h2 className="font-display text-3xl font-semibold text-fg">
          How a job goes
        </h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PROCESS.map((item) => (
            <article
              key={item.step}
              className="rounded-2xl bg-surface p-6 shadow-[var(--shadow-border)]"
            >
              <p className="font-display text-5xl font-semibold text-primary">
                {item.step}.
              </p>
              <h3 className="mt-3 font-display text-xl text-fg">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">
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
