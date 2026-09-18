import { createFileRoute, Link } from "@tanstack/react-router";
import { RoofPublicQuote } from "@/components/roof-public-quote";
import { CtaBand, PageIntro } from "@/components/site-shell";
import { AREA_LINE, SITE } from "@/lib/site";

export const Route = createFileRoute("/roof")({
  component: RoofPage,
  head: () => ({
    meta: [
      { title: `Roof | ${SITE.legalName}` },
      {
        name: "description",
        content: `Type your address for a San Antonio roof planning range. Low, medium, or steep. 3-tab, architectural, or designer. ${AREA_LINE} Call (210) 436-9117.`,
      },
    ],
  }),
});

function RoofPage() {
  return (
    <div>
      <PageIntro eyebrow="Roof" title="What's on the house?">
        <p>
          Type the address. We pull that roof's outline: one roof, even on a
          two-story. Pick how steep it is and the shingle. You get a planning
          range, then we walk it.
        </p>
      </PageIntro>

      <section className="mx-auto max-w-6xl px-4 pb-16">
        <RoofPublicQuote />
        <p className="mt-6 text-center text-sm text-muted">
          Kitchen, bath, and the rest of the list are on{" "}
          <Link to="/contact" className="font-medium text-primary">
            Contact
          </Link>
          .
        </p>
      </section>

      <CtaBand
        title="Want the work done?"
        body="Send the range or call. We'll walk the roof if you want a bid."
      />
    </div>
  );
}
