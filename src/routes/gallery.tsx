import { createFileRoute } from "@tanstack/react-router";
import { BeforeAfterSlider } from "@/components/before-after-slider";
import { GalleryGrid, SpotlightCard } from "@/components/gallery-lightbox";
import { CtaBand, PageIntro } from "@/components/site-shell";
import { SITE } from "@/lib/site";

export const Route = createFileRoute("/gallery")({
  component: GalleryPage,
  head: () => ({
    meta: [
      { title: `Gallery | ${SITE.legalName}` },
      {
        name: "description",
        content:
          "Kitchens, baths, patios, and carpentry from The Flip Fixer in San Antonio. Real jobs, finished.",
      },
    ],
  }),
});

function GalleryPage() {
  return (
    <div>
      <PageIntro eyebrow="Gallery" title="Jobs.">
        <p>Kitchen, bath, outdoor, and the rest.</p>
      </PageIntro>

      <section className="mx-auto max-w-3xl px-4 pb-16">
        <h2 className="mb-6 text-center font-display text-2xl text-fg">
          Kitchen
        </h2>
        <BeforeAfterSlider
          beforeSrc="/images/kitchenbefore.jpg"
          afterSrc="/images/kitchenafter.jpg"
          beforeAlt="Kitchen before"
          afterAlt="Kitchen after"
        />
        <p className="mt-4 text-center text-sm text-muted">
          Before and after.
        </p>
      </section>

      <section className="bg-surface px-4 py-16">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-8 font-display text-2xl text-fg">More</h2>
          <div className="grid gap-6 md:grid-cols-2">
            <SpotlightCard
              src="/images/gallery-11-b.jpg"
              title="Spa bath"
              caption="Soaking tub and walk-in shower."
            />
            <SpotlightCard
              src="/images/gallery-01-a.jpg"
              title="Farmhouse kitchen"
              caption="Quartz island, wood beam, blue wall."
            />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="mb-8 font-display text-2xl text-fg">More jobs</h2>
        <GalleryGrid />
      </section>

      <CtaBand />
    </div>
  );
}
