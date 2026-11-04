import { createFileRoute, Link } from "@tanstack/react-router";
import { LeadForm } from "@/components/lead-form";
import { OwnerTodo } from "@/components/owner-todo";
import { CallLink, CallNumber } from "@/components/call-link";
import { PageIntro } from "@/components/site-shell";
import { CREW, SITE } from "@/lib/site";

const INSURANCE_BODY =
  "We are insurance claim specialists. After fire or storm damage we rebuild from tear-out through finish and catch scope the carrier left out.";

export const Route = createFileRoute("/insurance-claims")({
  component: InsuranceClaimsPage,
  validateSearch: (search: Record<string, unknown>) => {
    const sent = search.sent === "1" || search.sent === true;
    return sent ? { sent: true as const } : {};
  },
  head: () => ({
    links: [{ rel: "canonical", href: `${SITE.url}/insurance-claims` }],
    meta: [
      { title: `Insurance claim rebuilds in San Antonio | ${SITE.name}` },
      {
        name: "description",
        content: `Fire and storm damage rebuilds in San Antonio. Call ${SITE.phoneDisplay}. We rebuild from tear-out through finish.`,
      },
    ],
  }),
});

function InsuranceClaimsPage() {
  const { sent } = Route.useSearch();
  const dan = CREW.find((person) => person.name === "Dan Wimberly");
  return (
    <div>
      <PageIntro eyebrow="Insurance claims" title="Insurance claim rebuilds in San Antonio">
        <p>{INSURANCE_BODY}</p>
        <p className="mt-4">
          That is the description already used on the services page and the contact form. It covers
          fire and storm damage. It does not name a carrier, a claim number, or a promise about
          what an insurer will approve.
        </p>
      </PageIntro>

      <article className="mx-auto max-w-3xl space-y-8 px-4 pb-12 text-left">
        <section>
          <h2 className="font-display text-2xl text-fg">Scope the carrier left out</h2>
          <p className="mt-3 text-lg leading-relaxed text-muted">
            {dan ? dan.bio : "Dan Wimberly writes the scope and works the job."} That record stays
            his. It is not a guarantee, and it is not a review.
          </p>
          <p className="mt-3">
            <Link to="/about" className="font-medium text-primary hover:underline">
              About the crew
            </Link>
          </p>
        </section>

        <section>
          <h2 className="font-display text-2xl text-fg">How a rebuild starts</h2>
          <p className="mt-3 text-lg leading-relaxed text-muted">
            Call or text {SITE.phoneDisplay}, or send the form. Tell us the address, what happened,
            and when you want someone out. We walk the house the same way we do for any other job:
            look at the work, then a clear price for the scope we are rebuilding.
          </p>
          <p className="mt-3 text-lg leading-relaxed text-muted">
            A published Nextdoor review describes a repair that avoided a claim. That is a different
            job from a rebuild.{" "}
            <Link to="/testimonials" className="font-medium text-primary hover:underline">
              Read it on the reviews page
            </Link>
            .
          </p>
        </section>

        <OwnerTodo
          items={[
            "Water damage is not claimed on this page. Say whether water-damage rebuilds should be listed, and the sentence you want published, before that is added.",
            "Working with adjusters is not described on the site. Add the steps you actually take with an adjuster, and anything you will not promise, or leave the page as tear-out through finish and scope the carrier left out.",
            "Keep the 20-50% line attributed to Dan's bio. Do not turn it into a guarantee or add review stars to the page.",
          ]}
        />
      </article>

      <section id="send-job" className="scroll-mt-28 border-t border-border bg-surface px-4 py-12 md:py-16">
        <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-2 md:items-start">
          <div>
            <h2 className="font-display text-2xl font-semibold text-fg">Tell us what happened.</h2>
            <p className="mt-3 text-muted">
              Address, the damage, and when you want someone out. We call or text you back.
            </p>
            <CallLink className="mt-6 hidden text-lg font-semibold text-primary hover:text-primary-hover md:inline-block">
              Prefer the phone? Call <CallNumber />
            </CallLink>
          </div>
          <div className="rounded-2xl bg-bg p-5 shadow-[var(--shadow-border)] md:p-7">
            <LeadForm
              sent={sent}
              nextPath="/insurance-claims"
              service="insurance-claims"
              source="insurance-claims"
              compact
              messagePlaceholder="Address, what happened, and when you want someone out."
            />
          </div>
        </div>
      </section>
    </div>
  );
}
