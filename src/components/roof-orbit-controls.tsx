import { Compass, RotateCcw, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { wrapDeg } from "@/lib/photo-view";
import { cn } from "@/lib/utils";

export function RoofOrbitControls({
  heading,
  tilt = 0,
  onRotate,
  onNorth,
  onTilt,
  className,
}: {
  heading: number;
  tilt?: number;
  onRotate: (delta: number) => void;
  onNorth: () => void;
  onTilt?: () => void;
  className?: string;
}) {
  const deg = wrapDeg(heading);
  return (
    <div className={cn("flex flex-col items-end gap-1", className)}>
      <div className="flex overflow-hidden rounded-md bg-white/95 shadow-border">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-9 rounded-none px-2"
          aria-label="Rotate left"
          onClick={() => onRotate(-15)}
        >
          <RotateCcw className="size-4" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-9 min-w-12 rounded-none px-2 font-mono text-xs tabular-nums"
          aria-label="Reset north"
          onClick={onNorth}
        >
          <Compass className="size-3.5" />
          {Math.round(deg)} deg
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-9 rounded-none px-2"
          aria-label="Rotate right"
          onClick={() => onRotate(15)}
        >
          <RotateCw className="size-4" />
        </Button>
      </div>
      {onTilt ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 bg-white/95"
          onClick={onTilt}
        >
          {tilt >= 20 ? "Top" : "Tilt"}
        </Button>
      ) : null}
    </div>
  );
}
