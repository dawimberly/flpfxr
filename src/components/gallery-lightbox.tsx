import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  galleryJobs,
  type GalleryJob,
  type ServiceId,
} from "@/lib/site";
import { Photo } from "@/components/photo";
import { cn } from "@/lib/utils";

export function GalleryGrid({
  service,
}: {
  service?: ServiceId;
}) {
  const jobs = useMemo(() => galleryJobs(service), [service]);
  const photos = useMemo(() => jobs.flatMap((job) => job.photos), [jobs]);
  const [index, setIndex] = useState<number | null>(null);

  useEffect(() => {
    setIndex(null);
  }, [service]);

  useEffect(() => {
    if (index === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        setIndex((i) => (i === null ? i : (i + 1) % photos.length));
      }
      if (e.key === "ArrowLeft") {
        setIndex((i) =>
          i === null ? i : (i - 1 + photos.length) % photos.length,
        );
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, photos.length]);

  const active = index !== null ? photos[index] : null;

  const openPhoto = (job: GalleryJob, photoSrc: string) => {
    const start = photos.findIndex((item) => item.src === photoSrc);
    setIndex(start === -1 ? 0 : start);
  };

  if (jobs.length === 0) {
    return (
      <p className="text-muted">
        No photos for this yet. Call and we'll walk the job.
      </p>
    );
  }

  return (
    <>
      <div className="space-y-12">
        {jobs.map((job, jobIndex) => (
          <article key={job.id}>
            <h3 className="font-display text-xl text-fg">{job.title}</h3>
            <div
              className={cn(
                "mt-4 grid gap-3",
                job.photos.length === 1 && "max-w-xl sm:grid-cols-1",
                job.photos.length === 2 && "sm:grid-cols-2",
                job.photos.length >= 3 && "sm:grid-cols-3",
              )}
            >
              {job.photos.map((item, photoIndex) => (
                <button
                  key={item.src}
                  type="button"
                  onClick={() => openPhoto(job, item.src)}
                  className="group overflow-hidden rounded-xl text-left"
                >
                  <Photo
                    src={item.src}
                    alt={item.alt}
                    loading={jobIndex === 0 && photoIndex < 3 ? "eager" : "lazy"}
                    className="photo-frame h-56 w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03] md:h-64"
                  />
                  {item.caption && item.caption !== item.title ? (
                    <span className="mt-2 block text-xs text-muted">
                      {item.caption}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          </article>
        ))}
      </div>

      <Dialog
        open={index !== null}
        onOpenChange={(open) => {
          if (!open) setIndex(null);
        }}
      >
        <DialogContent className="bg-bg p-0 sm:p-0">
          {active ? (
            <div>
              <Photo
                src={active.src}
                alt={active.alt}
                className="max-h-[70vh] w-full rounded-t-2xl object-contain"
              />
              <div className="flex items-start justify-between gap-4 p-5 pr-14">
                <div>
                  <DialogTitle>{active.title}</DialogTitle>
                  {active.caption !== active.title ? (
                    <p className="mt-1 text-sm text-muted">{active.caption}</p>
                  ) : null}
                </div>
                {photos.length > 1 ? (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="flex size-11 items-center justify-center rounded-lg bg-surface text-fg hover:bg-surface-2"
                      aria-label="Previous photo"
                      onClick={() =>
                        setIndex((i) =>
                          i === null
                            ? 0
                            : (i - 1 + photos.length) % photos.length,
                        )
                      }
                    >
                      <ChevronLeft className="size-5" />
                    </button>
                    <button
                      type="button"
                      className="flex size-11 items-center justify-center rounded-lg bg-surface text-fg hover:bg-surface-2"
                      aria-label="Next photo"
                      onClick={() =>
                        setIndex((i) =>
                          i === null ? 0 : (i + 1) % photos.length,
                        )
                      }
                    >
                      <ChevronRight className="size-5" />
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
