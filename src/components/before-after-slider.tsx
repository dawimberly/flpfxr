import { useCallback, useId, useRef, useState, type PointerEvent } from "react";
import { cn } from "@/lib/utils";

type Props = {
  beforeSrc: string;
  afterSrc: string;
  beforeAlt: string;
  afterAlt: string;
  className?: string;
};

export function BeforeAfterSlider({
  beforeSrc,
  afterSrc,
  beforeAlt,
  afterAlt,
  className,
}: Props) {
  const [pos, setPos] = useState(52);
  const track = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const labelId = useId();

  const setFromClientX = useCallback((clientX: number) => {
    const el = track.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const next = ((clientX - rect.left) / rect.width) * 100;
    setPos(Math.min(96, Math.max(4, next)));
  }, []);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    setFromClientX(e.clientX);
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    setFromClientX(e.clientX);
  };

  const onPointerUp = () => {
    dragging.current = false;
  };

  return (
    <div
      ref={track}
      className={cn(
        "photo-frame relative aspect-[4/3] w-full cursor-col-resize overflow-hidden rounded-2xl bg-surface select-none",
        className,
      )}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <img
        src={afterSrc}
        alt={afterAlt}
        className="absolute inset-0 size-full object-cover"
        draggable={false}
      />
      <img
        src={beforeSrc}
        alt={beforeAlt}
        className="absolute inset-0 size-full object-cover"
        style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
        draggable={false}
      />
      <div
        className="absolute inset-y-0 z-10 w-0.5 bg-fg"
        style={{ left: `${pos}%` }}
      >
        <div className="absolute top-1/2 left-1/2 flex size-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-fg text-bg shadow-md">
          <span className="sr-only">Drag to compare</span>
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
            <path
              d="M6 4 L2 9 L6 14 M12 4 L16 9 L12 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </div>
      <span className="pointer-events-none absolute top-4 left-4 rounded-md bg-bg/70 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-fg">
        Before
      </span>
      <span className="pointer-events-none absolute top-4 right-4 rounded-md bg-bg/70 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-fg">
        After
      </span>
      <label htmlFor={labelId} className="sr-only">
        Before and after comparison
      </label>
      <input
        id={labelId}
        type="range"
        min={4}
        max={96}
        value={pos}
        onChange={(e) => setPos(Number(e.target.value))}
        className="absolute inset-x-4 bottom-3 z-20 w-auto accent-primary"
        onPointerDown={(e) => e.stopPropagation()}
      />
    </div>
  );
}
