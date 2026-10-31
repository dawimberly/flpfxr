import { Link } from "@tanstack/react-router";
import { BeforeAfterSlider } from "@/components/before-after-slider";
import { GALLERY } from "@/lib/site";

const BEFORE_AFTER = GALLERY.filter((photo) => photo.caption.toLowerCase() === "before").map((before) => {
  const stem = before.src.match(/gallery-(\\d+)/)?.[1];
  const after = GALLERY.find((photo) => photo.caption.toLowerCase() === "after" && stem && photo.src.includes(`gallery-${stem}-`));
  return after ? { title: before.title, before: before.src, after: after.src, beforeAlt: before.alt, afterAlt: after.alt } : null;
}).filter((job): job is NonNullable<typeof job> => job !== null).slice(0, 2);

export function BeforeAfterBand() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 md:py-24">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-display text-3xl font-semibold text-fg md:text-4xl">
            Before and after
          </h2>
          <p className="mt-3 max-w-xl text-muted">
            Drag the slider. Same room. Same crew.
          </p>
        </div>
        <Link
          to="/gallery"
          search={{ view: "before-after" }}
          className="text-sm font-medium text-primary hover:text-primary-hover"
        >
          See the jobs
        </Link>
      </div>
      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        {BEFORE_AFTER.map((job) => (
          <article key={job.title}>
            <BeforeAfterSlider
              beforeSrc={job.before}
              afterSrc={job.after}
              beforeAlt={job.beforeAlt}
              afterAlt={job.afterAlt}
            />
            <h3 className="mt-4 font-display text-xl text-fg">{job.title}</h3>
          </article>
        ))}
      </div>
    </section>
  );
}
