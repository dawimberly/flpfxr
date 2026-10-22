import { Link } from "@tanstack/react-router";
import { Photo } from "@/components/photo";
import { Button } from "@/components/ui/button";
import { GALLERY } from "@/lib/site-rest-a";

const kitchenPhotos = [
  "/images/gallery-23-d.webp",
  "/images/gallery-01-a.webp",
  "/images/gallery-02-a.webp",
];
const bathroomPhotos = [
  "/images/gallery-26-b.webp",
  "/images/gallery-26-a.webp",
  "/images/gallery-27-a.webp",
];

function photosFor(service: "kitchen" | "bathroom") {
  return service === "kitchen" ? kitchenPhotos : bathroomPhotos;
}

function ProjectFigure({
  src,
  service,
  eager = false,
}: {
  src: string;
  service: "kitchen" | "bathroom";
  eager?: boolean;
}) {
  const photo = GALLERY.find((item) => item.src === src)!;
  return (
    <figure className="overflow-hidden rounded-2xl bg-surface">
      <Photo
        src={photo.src}
        alt={photo.alt}
        loading={eager ? "eager" : "lazy"}
        width={800}
        height={600}
        className="aspect-[4/3] w-full object-cover"
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
      <ProjectFigure src={src} service={service} eager />
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
      <div className="mt-6 grid gap-5 md:grid-cols-2">
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
