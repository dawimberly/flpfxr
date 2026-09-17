/** 2519 Blue Quail St (Anderson). St, not Way. */

import { feetRing, type PhotoFacet, type Px, type RoofFacet } from "./roof-math.ts";

export const BLUE_QUAIL = {
  address: "2519 Blue Quail St, San Antonio, TX 78232",
  center: { lat: 29.5803375, lng: -98.4516699 },
  /** Two 8x7 garage doors + post. EV AA1/AA2; XM sketch 18' 5". */
  garageWidthFt: "18.5",
  /** Vinyl soffit 220 SF / 115 LF fascia. Front and rear called oversized. */
  eaveOverhangIn: "23",
  rakeOverhangIn: "12",
  /** Isabel Luna laminated gable: R&R Gable cornice strip 24 LF. */
  corniceStripLf: "24",
  corniceReturnEa: "",
  ev: {
    squares: 28.66,
    pitch: "5/12",
    facets: 9,
    ridgeFt: 78,
    hipFt: 7,
    valleyFt: 34,
    rakeFt: 141,
    eaveFt: 190,
  },
} as const;

/**
 * South 20+20 on plan-diagram.jpg are green rakes. EV prints 3D lengths, so those
 * 40 ft are not a plan scale. Seeded planes still use this span as a pixel origin.
 */
const DIAGRAM_SCALE: { a: Px; b: Px; feet: number } = {
  a: [39, 446],
  b: [288, 446],
  feet: 40,
};

/** Level 41 ft ridge (red, N–S). 3D = plan, so this matches EagleView’s printed 41. */
export const BLUE_QUAIL_LENGTH_SCALE: { a: Px; b: Px; feet: number } = {
  a: [187, 33],
  b: [187, 306],
  feet: 41,
};

const FT_PER_PX = DIAGRAM_SCALE.feet / (DIAGRAM_SCALE.b[0] - DIAGRAM_SCALE.a[0]);
const OX = DIAGRAM_SCALE.a[0];
const OY = DIAGRAM_SCALE.a[1];

function px(east: number, north: number): Px {
  return [OX + east / FT_PER_PX, OY - north / FT_PER_PX];
}

function plane(
  id: string,
  feet: [number, number][],
  slopeDeg: number,
): PhotoFacet {
  return {
    id,
    points: feet.map(([east, north]) => px(east, north)),
    pitch: "5/12",
    slopeDeg,
  };
}

/** First-pass trace of the EV length diagram. Four main 5/12 planes plus the east porch. */
export function blueQuailDiagramPlanes(): Array<{
  id: string;
  feet: [number, number][];
  slopeDeg: number;
}> {
  return [
    { id: "bq-sw", feet: [[0, 0], [20, 0], [20, 22], [0, 22]], slopeDeg: 270 },
    { id: "bq-se", feet: [[20, 0], [40, 0], [40, 20], [20, 22]], slopeDeg: 90 },
    { id: "bq-nw", feet: [[0, 22], [20, 22], [20, 63], [0, 63]], slopeDeg: 270 },
    { id: "bq-ne", feet: [[20, 22], [39, 22], [39, 63], [20, 63]], slopeDeg: 90 },
    { id: "bq-east-porch", feet: [[39, 24], [43.5, 24], [43.5, 38], [39, 38]], slopeDeg: 90 },
  ];
}

export function blueQuailDiagramTrace(): {
  scaleA: Px;
  scaleB: Px;
  scaleFeet: string;
  facets: PhotoFacet[];
} {
  return {
    scaleA: DIAGRAM_SCALE.a,
    scaleB: DIAGRAM_SCALE.b,
    scaleFeet: String(DIAGRAM_SCALE.feet),
    facets: blueQuailDiagramPlanes().map((row) => plane(row.id, row.feet, row.slopeDeg)),
  };
}

/**
 * Street from 2511→2527 Blue Quail is about 115°. Diagram +east is the street
 * face, so diagram +north is 25° east of true north.
 */
export const BLUE_QUAIL_HEADING_DEG = 25;

/**
 * Mid of the 40×63 main mass / 41 ft ridge. Averaging every seed vertex
 * sat south-east of that and dropped the overlay on the neighbor.
 */
export const BLUE_QUAIL_MAP_ORIGIN: [number, number] = [20, 31.5];

function rotateLocalFt(east: number, north: number, headingDeg: number): [number, number] {
  const rad = (headingDeg * Math.PI) / 180;
  const s = Math.sin(rad);
  const c = Math.cos(rad);
  return [east * c + north * s, -east * s + north * c];
}

/** EV diagram planes on the real lot, for the map tracer. */
export function blueQuailMapTrace(): RoofFacet[] {
  const planes = blueQuailDiagramPlanes();
  const [cx, cy] = BLUE_QUAIL_MAP_ORIGIN;
  const heading = BLUE_QUAIL_HEADING_DEG;
  return planes.map((row) => {
    const local = row.feet.map(([east, north]) => rotateLocalFt(east - cx, north - cy, heading));
    return {
      id: row.id,
      latlngs: feetRing(local, BLUE_QUAIL.center.lat, BLUE_QUAIL.center.lng),
      pitch: BLUE_QUAIL.ev.pitch,
      slopeDeg: (row.slopeDeg + heading) % 360,
    };
  });
}
