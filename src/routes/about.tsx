import { createFileRoute } from "@tanstack/react-router";
import { CtaBand, PageIntro } from "@/components/site-shell";
import { SITE, AREA_LINE } from "@/lib/site";

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

      <CtaBand />
    </div>
  );
}
