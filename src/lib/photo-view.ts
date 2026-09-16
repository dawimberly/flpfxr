/** CSS rotate() is clockwise with y-down. Invert that to map a screen click back onto the image. */

export function wrapDeg(deg: number) {
  return ((deg % 360) + 360) % 360;
}

/** Scale a rotated layer so it still covers the viewport (no empty corners). */
export function coverScale(viewW: number, viewH: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  const c = Math.abs(Math.cos(rad));
  const s = Math.abs(Math.sin(rad));
  if (viewW < 2 || viewH < 2) return 1;
  return Math.max(c + (viewH / viewW) * s, (viewW / viewH) * s + c);
}

export function imageFit(
  viewW: number,
  viewH: number,
  naturalW: number,
  naturalH: number,
): { fit: number; drawW: number; drawH: number; ox: number; oy: number } {
  const fit = Math.min(viewW / naturalW, viewH / naturalH);
  const drawW = naturalW * fit;
  const drawH = naturalH * fit;
  return {
    fit: fit > 0 ? fit : 1,
    drawW,
    drawH,
    ox: (viewW - drawW) / 2,
    oy: (viewH - drawH) / 2,
  };
}

export function clientToImagePx(
  clientX: number,
  clientY: number,
  view: { left: number; top: number; width: number; height: number },
  naturalW: number,
  naturalH: number,
  deg = 0,
): [number, number] | null {
  if (!naturalW || !naturalH || view.width < 2 || view.height < 2) return null;
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const scale = coverScale(view.width, view.height, deg);
  const dx = (clientX - (view.left + view.width / 2)) / scale;
  const dy = (clientY - (view.top + view.height / 2)) / scale;
  const ux = dx * cos + dy * sin;
  const uy = -dx * sin + dy * cos;
  const { fit, ox, oy } = imageFit(view.width, view.height, naturalW, naturalH);
  const x = (view.width / 2 + ux - ox) / fit;
  const y = (view.height / 2 + uy - oy) / fit;
  if (x < -2 || y < -2 || x > naturalW + 2 || y > naturalH + 2) return null;
  return [Math.min(naturalW, Math.max(0, x)), Math.min(naturalH, Math.max(0, y))];
}

export function pointerAngle(a: { x: number; y: number }, b: { x: number; y: number }) {
  return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
}
