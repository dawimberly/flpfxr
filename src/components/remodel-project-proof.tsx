import { Link } from "@tanstack/react-router";
import { Photo } from "@/components/photo";
import { GALLERY } from "@/lib/site-rest-a";

const kitchenPhotos = [
  "/images/gallery-23-d.webp",
  "/images/gallery-01-a.webp",
  "/images/gallery-02-a.webp",
];

export function RemodelProjectProof({ service }: { service: "kitchen" | "bathroom" }) {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-12" aria-label="Project fit and completed work">
      <div className="mb-8 rounded-2xl border border-primary/25 bg-surface p-6">
        <h2 className="font-display text-2xl text-fg">Planning a larger indoor remodel?</h2>
        <p className="mt-2 max-w-3xl text-muted">
          Our focus is indoor remodeling projects with budgets of $10,000 and up. Tell us what you
          want to change and your planning budget. We scope and price your project after a
          walkthrough.
        </p>
        <a
          href="#send-job"
          className="mt-4 inline-flex font-semibold text-primary underline underline-offset-4"
        >
          Tell us about your project
        </a>
      </div>
      {service === "kitchen" && (
        <div>
          <h2 className="font-display text-3xl text-fg">Kitchens we have remodeled.</h2>
          <p className="mt-2 text-muted">
            Real work by The Flip Fixer. See the finishes and details before you get in touch.
          </p>
          <div className="mt-6 grid gap-5 md:grid-cols-3">
            {kitchenPhotos.map((src) => {
              const photo = GALLERY.find((item) => item.src === src)!;
              return (
                <figure key={src} className="overflow-hidden rounded-2xl bg-surface">
                  <Photo
                    src={photo.src}
                    alt={photo.alt}
                    loading="lazy"
                    width={800}
                    height={600}
                    className="aspect-[4/3] w-full object-cover"
                  />
                  <figcaption className="p-4 font-medium text-fg">{photo.title}</figcaption>
                </figure>
              );
            })}
          </div>
          <Link
            to="/gallery"
            search={{ service: "kitchen-bath" }}
            className="mt-5 inline-flex font-semibold text-primary underline underline-offset-4"
          >
            See more project photos
          </Link>
        </div>
      )}
    </section>
  );
}

export function RemodelInquiryIntro() {
  return (
    <div className="mb-6">
      <h2 className="font-display text-3xl text-fg">Start with the room and your plan.</h2>
      <p className="mt-3 max-w-2xl text-muted">
        Send your neighborhood, what you want to change, and your approximate budget. We call or
        text you back to discuss the job and arrange a walkthrough. Then we define the scope and
        price.
      </p>
      <Link
        to="/testimonials"
        className="mt-3 inline-flex text-primary underline underline-offset-4"
      >
        Read customer feedback
      </Link>
    </div>
  );
}
