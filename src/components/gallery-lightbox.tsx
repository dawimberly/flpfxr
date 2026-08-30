import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { GALLERY } from "@/lib/site";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export function GalleryGrid({
  items = GALLERY,
  limit,
}: {
  items?: typeof GALLERY;
  limit?: number;
}) {
  const shown = limit ? items.slice(0, limit) : items;
  const [index, setIndex] = useState<number | null>(null);

  useEffect(() => {
    if (index === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        setIndex((i) => (i === null ? i : (i + 1) % shown.length));
      }
      if (e.key === "ArrowLeft") {
        setIndex((i) =>
          i === null ? i : (i - 1 + shown.length) % shown.length,
        );
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, shown.length]);

  const active = index !== null ? shown[index] : null;

  return (
    <>
      <div className="columns-1 gap-4 sm:columns-2 lg:columns-3">
        {shown.map((item, i) => (
          <button
            key={item.src}
            type="button"
            onClick={() => setIndex(i)}
            className="group relative mb-4 block w-full break-inside-avoid overflow-hidden rounded-xl text-left"
          >
            <img
              src={item.src}
              alt=""
              className="photo-frame w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
            />
            <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-bg via-bg/50 to-transparent px-4 pb-4 pt-10">
              <span className="block text-sm font-medium text-fg">
                {item.title}
              </span>
              <span className="mt-0.5 block text-xs text-muted">
                {item.category}
              </span>
            </span>
          </button>
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
              <img
                src={active.src}
                alt={active.alt}
                className="max-h-[70vh] w-full rounded-t-2xl object-contain"
              />
              <div className="flex items-start justify-between gap-4 p-5 pr-14">
                <div>
                  <DialogTitle>{active.title}</DialogTitle>
                  <p className="mt-1 text-sm text-muted">{active.caption}</p>
                  <Badge className="mt-3">{active.category}</Badge>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="flex size-11 items-center justify-center rounded-lg bg-surface text-fg hover:bg-surface-2"
                    aria-label="Previous photo"
                    onClick={() =>
                      setIndex((i) =>
                        i === null ? 0 : (i - 1 + shown.length) % shown.length,
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
                        i === null ? 0 : (i + 1) % shown.length,
                      )
                    }
                  >
                    <ChevronRight className="size-5" />
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

export function SpotlightCard({
  src,
  title,
  caption,
  className,
}: {
  src: string;
  title: string;
  caption: string;
  className?: string;
}) {
  return (
    <article
      className={cn(
        "overflow-hidden rounded-2xl bg-surface shadow-[var(--shadow-border)]",
        className,
      )}
    >
      <img src={src} alt={title} className="photo-frame h-72 w-full object-cover" />
      <div className="p-6">
        <h3 className="font-display text-xl text-fg">{title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted">{caption}</p>
      </div>
    </article>
  );
}
