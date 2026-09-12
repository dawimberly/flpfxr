import { createFileRoute, Link } from "@tanstack/react-router";
import { Photo } from "@/components/photo";
import { CtaBand, PageIntro } from "@/components/site-shell";
import { CREW, PROCESS, SITE, AREA_LINE } from "@/lib/site";

export const Route = createFileRoute("/about")({
  component: AboutPage,
  head: () => ({
    meta: [
      { title: `About | ${SITE.legalName}` },
      {
        name: "description",
        content:
          `The Flip Fixer remodels kitchens and baths, designs the work in-house, and gets rentals and listings ready to show. 30+ years on the tools. ${AREA_LINE}`,
      },
    ],
  }),
});

function AboutPage() {
  return (
    <div>
      <PageIntro eyebrow="About" title={SITE.name}>
        <p>
          We remodel kitchens and baths, fix what's broken, and get
          rentals and listings ready to show. Design is handled in-house.
          30+ years on the tools. No middleman. No speeches. You get a
          price, a plan, and the job finished.
        </p>
        <p className="mt-4">
          We donate design and labor on group homes and CASA houses when a
          partner covers materials.{" "}
          <Link to="/community" className="font-medium text-primary">
            Community
          </Link>
          .
        </p>
      </PageIntro>

      <section className="mx-auto max-w-4xl px-4 pb-16">
        <h2 className="font-display text-3xl font-semibold text-fg">
          Who shows up
        </h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          {CREW.map((person) => (
            <article key={person.name}>
              <Photo
                src={person.src}
                alt={person.name}
                className="photo-frame aspect-[3/4] w-full object-cover object-top"
              />
              <h3 className="mt-4 font-display text-2xl text-fg">{person.name}</h3>
              {person.line ? (
                <p className="mt-1 text-sm text-muted">{person.line}</p>
              ) : null}
            </article>
          ))}
        </div>
      </section>

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
