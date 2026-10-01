import { Link } from "@tanstack/react-router";
import { Photo } from "@/components/photo";

const HOME_BEST_WORK: Array<{ src: string; alt: string; title: string }> = [
  {
    src: "/images/gallery-23-d.webp",
    alt: "Herringbone floor kitchen after remodel",
    title: "Kitchen remodel",
  },
  {
    src: "/images/gallery-17-a.webp",
    alt: "Navy island kitchen with gold fixtures",
    title: "Kitchen remodel",
  },
  {
    src: "/images/gallery-01-a.webp",
    alt: "Farmhouse kitchen with large island",
    title: "Kitchen remodel",
  },
  {
    src: "/images/gallery-03-a.webp",
    alt: "Charcoal and gray remodeled kitchen",
    title: "Kitchen remodel",
  },
];

export function BestWorkBand() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 md:py-24">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-display text-3xl font-semibold text-fg md:text-4xl">
            Recent work
          </h2>
          <p className="mt-3 max-w-xl text-muted">
            Kitchens and remodels we&apos;ve finished around San Antonio.
          </p>
        </div>
        <Link
          to="/gallery"
          className="text-sm font-medium text-primary hover:text-primary-hover"
        >
          See the gallery
        </Link>
      </div>
      <div className="mt-10 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {HOME_BEST_WORK.map((photo) => (
          <Link
            key={photo.src}
            to="/gallery"
            className="group block overflow-hidden rounded-xl"
          >
            <div className="aspect-[4/3] overflow-hidden rounded-xl">
              <Photo
                src={photo.src}
                alt={photo.alt}
                loading="lazy"
                className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
              />
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
