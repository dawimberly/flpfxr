import { createFileRoute, Link } from "@tanstack/react-router";
import { PageIntro } from "@/components/site-shell";
import { COMMUNITY, SITE } from "@/lib/site";

const MAIL = `mailto:${SITE.email}?subject=${encodeURIComponent(COMMUNITY.subject)}`;

export const Route = createFileRoute("/community")({
  component: CommunityPage,
  head: () => ({
    meta: [
      { title: `Community | ${SITE.legalName}` },
      {
        name: "description",
        content: COMMUNITY.title + " " + COMMUNITY.intro,
      },
    ],
  }),
});

function CommunityPage() {
  return (
    <div>
      <PageIntro eyebrow="Community" title={COMMUNITY.title}>
        <p>{COMMUNITY.intro}</p>
      </PageIntro>

      <section className="mx-auto max-w-6xl px-4 pb-16">
        <div className="grid gap-4 md:grid-cols-2">
          {COMMUNITY.lanes.map((lane) => (
            <article
              key={lane.title}
              className="rounded-2xl bg-surface p-6 shadow-[var(--shadow-border)]"
            >
              <h2 className="font-display text-xl text-fg">{lane.title}</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted">
                {lane.body}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16">
        <h2 className="font-display text-3xl font-semibold text-fg">
          If this sounds like your house, here is the split
        </h2>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {COMMUNITY.split.map((item) => (
            <article
              key={item.who}
              className="rounded-2xl bg-surface p-6 shadow-[var(--shadow-border)]"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                {item.who}
              </p>
              <p className="mt-3 font-display text-xl leading-snug text-fg">
                {item.what}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-cream px-4 py-16 text-cream-fg md:py-20">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="font-display text-3xl font-semibold md:text-4xl">
            Start the partnership
          </h2>
          <p className="mt-4 text-lg text-cream-muted">
            Email with the subject line &ldquo;{COMMUNITY.subject}.&rdquo;
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href={MAIL}
              className="inline-flex h-12 items-center justify-center rounded-lg bg-primary px-6 text-sm font-semibold text-primary-fg hover:bg-primary-hover"
            >
              Email {SITE.email}
            </a>
            <Link
              to="/contact"
              className="inline-flex h-12 items-center justify-center rounded-lg border border-cream-fg/20 px-6 text-sm font-semibold hover:bg-cream-fg/10"
            >
              Contact
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
