import { Link } from "@tanstack/react-router";
import { Photo } from "@/components/photo";
import { Button } from "@/components/ui/button";
import { GALLERY } from "@/lib/site-rest-a";

const kitchenPhotos = [
  "/images/gallery-23-d.webp",
  "/images/gallery-01-a.webp",
  "/images/gallery-02-a.webp",
] as const;
const bathroomPhotos = [
  "/images/gallery-26-b.webp",
  "/images/gallery-26-a.webp",
  "/images/gallery-27-a.webp",
] as const;

type ProjectSrc = (typeof kitchenPhotos)[number] | (typeof bathroomPhotos)[number];

/** Intrinsic frames. Landscape kitchens stay 4:3. Portrait photos stay portrait, including the 3:4 bathroom shots. */
const photoSize: Record<ProjectSrc, { width: number; height: number }> = {
  "/images/gallery-23-d.webp": { width: 1500, height: 1126 },
  "/images/gallery-01-a.webp": { width: 1600, height: 1200 },
  "/images/gallery-02-a.webp": { width: 1200, height: 1600 },
  "/images/gallery-26-b.webp": { width: 1170, height: 1591 },
  "/images/gallery-26-a.webp": { width: 1170, height: 1361 },
  "/images/gallery-27-a.webp": { width: 1170, height: 1556 },
};

function photosFor(service: "kitchen" | "bathroom") {
  return service === "kitchen" ? kitchenPhotos : bathroomPhotos;
}

function ProjectFigure({
  src,
  service,
  eager = false,
}: {
  src: ProjectSrc;
  service: "kitchen" | "bathroom";
  eager?: boolean;
}) {
  const photo = GALLERY.find((item) => item.src === src)!;
  const size = photoSize[src];
  return (
    <figure className="overflow-hidden rounded-2xl bg-surface">
      <Photo
        src={photo.src}
        alt={photo.alt}
        loading={eager ? "eager" : "lazy"}
        width={size.width}
        height={size.height}
        className="h-auto w-full"
      />
      <figcaption className="p-4 font-medium text-fg">
        {photo.title}
        {service === "bathroom" ? ` — ${photo.caption}` : ""}
      </figcaption>
    </figure>
  );
}

export function ProjectTellButton({ className }: { className?: string }) {
  return (
    <Button asChild size="lg" className={className}>
      <a href="#send-job">Tell us about your project</a>
    </Button>
  );
}

/** One real job photo above the form. The rest stay below it. */
export function FeaturedProjectPhoto({ service }: { service: "kitchen" | "bathroom" }) {
  const src = photosFor(service)[0];
  return (
    <div className="mx-auto max-w-6xl px-4 pb-8">
      <div className={service === "bathroom" ? "mx-auto w-full max-w-md" : undefined}>
        <ProjectFigure src={src} service={service} eager />
      </div>
    </div>
  );
}

export function MoreProjectPhotos({ service }: { service: "kitchen" | "bathroom" }) {
  const rest = photosFor(service).slice(1);
  return (
    <section className="mx-auto max-w-6xl px-4 pb-12" aria-label="More completed work">
      <h2 className="font-display text-3xl text-fg">
        {service === "kitchen" ? "More kitchens we have remodeled." : "More bathroom projects."}
      </h2>
      <div className="mt-6 grid items-start gap-5 md:grid-cols-2">
        {rest.map((src) => (
          <ProjectFigure key={src} src={src} service={service} />
        ))}
      </div>
      <Link
        to="/gallery"
        search={{ service: "kitchen-bath" }}
        className="mt-5 inline-flex min-h-11 items-center font-semibold text-primary underline underline-offset-4"
      >
        See more project photos
      </Link>
    </section>
  );
}

export function RemodelInquiryIntro() {
  return (
    <div className="mb-3">
      <h2 className="font-display text-2xl text-fg md:text-3xl">Start with the room and your plan.</h2>
    </div>
  );
}
