import catalogJson from "@/data/catalog.json";
import roomTypesJson from "@/data/room-types.json";
import { cabinetLineItems, isCabinetCategory, type CabinetPick } from "@/lib/cabinets";

export const LABOR_RATE_PER_HOUR = 55;
export const OP_PERCENT = 20;
export const PRICE_LIST = "TXSA8X Sep 2026";
export const PRICE_AS_OF = "September 2026";

export const COMPANY = {
  name: "The Flip Fixer",
  mark: "FF",
  tagline: "Scan. Price. Flip.",
  email: "jon@theflipfixer.com",
  web: "theflipfixer.com",
  region: "San Antonio & the Hill Country",
  license: "Fully licensed & insured",
} as const;

export type CatalogOption = {
  name: string;
  unit: string;
  cost_per_unit: number;
};

export type CatalogCategory = {
  display_name: string;
  options: CatalogOption[];
};

export type Catalog = Record<string, CatalogCategory>;

export type RoomType = {
  room_id: string;
  display_name: string;
  typical_categories: string[];
};

export type Opening = {
  id: string;
  widthFt: number;
  heightFt: number;
};

export type ClientInfo = {
  name: string;
  address: string;
  phone: string;
  email: string;
  propertyName: string;
  propertyAddress: string;
};

export type SelectionValue = { name: string; quantity: number | null };

export type CategorySelections = SelectionValue | SelectionValue[];

export type Selection = {
  category: string;
  name: string;
  quantity: number | null;
};

export type LineItem = {
  description: string;
  quantity: number;
  unit: string;
  unitCost: number;
  lineTotal: number;
  kind: "material" | "labor";
  category: string;
};

export type JobLineItem = LineItem & {
  roomId: string;
  roomLabel: string;
};

export type ParsedScan = {
  floorArea: number;
  wallArea: number;
  perimeter: number;
};

export type Estimate = {
  lineItems: LineItem[];
  materialsSubtotal: number;
  laborSubtotal: number;
  grandTotal: number;
  laborRate: number;
  opPercent: number;
  warnings: string[];
};

export type JobRoom = {
  id: string;
  label: string;
  roomTypeId: string;
  lengthFt: number;
  widthFt: number;
  heightFt: number;
  doors: Opening[];
  windows: Opening[];
  extraCategories: string[];
  selections: Record<string, CategorySelections>;
  cabinetFinishId: string;
  cabinets: CabinetPick[];
};

export type RoomEstimate = {
  room: JobRoom;
  typeName: string;
  scan: ParsedScan;
  estimate: Estimate;
};

export type JobEstimate = {
  rooms: RoomEstimate[];
  completeLineItems: JobLineItem[];
  materialsSubtotal: number;
  laborSubtotal: number;
  grandTotal: number;
  warnings: string[];
};

export const catalog = catalogJson as Catalog;
export const roomTypes = roomTypesJson as RoomType[];

const AREA_KEYS: Record<string, keyof ParsedScan> = {
  "flooring|sq ft": "floorArea",
  "walls|sq ft": "wallArea",
  "walls/paint|sq ft": "wallArea",
  "drywall|sq ft": "wallArea",
  "ceiling|sq ft": "floorArea",
  "insulation|sq ft": "wallArea",
  "cleanup|sq ft": "floorArea",
};

const PERIMETER_CATEGORIES = new Set(["trim/baseboards", "cleanup"]);

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function openingArea(items: Opening[]) {
  return items.reduce((sum, item) => sum + item.widthFt * item.heightFt, 0);
}

export function parseScan(input: {
  lengthFt: number;
  widthFt: number;
  heightFt: number;
  doors: Opening[];
  windows: Opening[];
}): ParsedScan {
  const floorArea = input.lengthFt * input.widthFt;
  const perimeter = 2 * (input.lengthFt + input.widthFt);
  const grossWall = perimeter * input.heightFt;
  const netWall = grossWall - openingArea(input.doors) - openingArea(input.windows);
  return {
    floorArea: round2(floorArea),
    wallArea: round2(Math.max(0, netWall)),
    perimeter: round2(perimeter),
  };
}

export function lookupOption(category: string, name: string): (CatalogOption & { category: string; displayName: string }) | null {
  const block = catalog[category];
  if (!block) return null;
  const nameKey = name.trim().toLowerCase();
  const option = block.options.find((item) => item.name.trim().toLowerCase() === nameKey);
  if (!option) return null;
  return { ...option, category, displayName: block.display_name };
}

export function canInferQuantity(category: string, unit: string) {
  if (unit === "linear ft") return PERIMETER_CATEGORIES.has(category);
  return `${category}|${unit}` in AREA_KEYS;
}

export function inferredQuantity(scan: ParsedScan, category: string, unit: string): number | null {
  if (unit === "linear ft" && PERIMETER_CATEGORIES.has(category)) return scan.perimeter;
  const key = AREA_KEYS[`${category}|${unit}`];
  if (!key) return null;
  return scan[key];
}

export function getRoom(roomId: string) {
  return roomTypes.find((room) => room.room_id === roomId) ?? roomTypes[0];
}

export function categoryDisplayName(categoryId: string) {
  return catalog[categoryId]?.display_name ?? categoryId;
}

export function uniqueRoomLabel(base: string, rooms: JobRoom[]) {
  const names = new Set(rooms.map((room) => room.label));
  if (!names.has(base)) return base;
  let n = 2;
  while (names.has(`${base} ${n}`)) n += 1;
  return `${base} ${n}`;
}

/**
 * Surfaces every interior room has. Always shown; SKUs stay empty until picked.
 * Room-type extras (cabinets, tile, …) stack on top. Odd lines → “Add another category”.
 * Framing / AI description: later.
 */
export const UNIVERSAL_SURFACE_CATEGORIES = [
  "flooring",
  "drywall",
  "walls/paint",
  "ceiling",
] as const;

const NO_UNIVERSAL_SURFACES = new Set(["exterior_outdoor"]);

export function visibleCategoriesFor(room: JobRoom) {
  const type = getRoom(room.roomTypeId);
  const surfaces = NO_UNIVERSAL_SURFACES.has(type.room_id)
    ? []
    : [...UNIVERSAL_SURFACE_CATEGORIES];
  const ids = [
    ...surfaces,
    ...type.typical_categories,
    ...room.extraCategories,
    ...Object.keys(room.selections),
  ];
  return [...new Set(ids)].filter((id) => catalog[id]);
}

function listSelections(value: CategorySelections | undefined): SelectionValue[] {
  if (!value) return [];
  const list = Array.isArray(value) ? value : [value];
  return list.filter((item) => Boolean(item?.name?.trim()));
}

export function selectionsFromRoom(room: JobRoom): Selection[] {
  return visibleCategoriesFor(room)
    .filter((category) => !isCabinetCategory(category))
    .flatMap((category) =>
      listSelections(room.selections[category]).map((item) => ({
        category,
        name: item.name,
        quantity: item.quantity,
      })),
    );
}

export function buildEstimate(
  scan: ParsedScan,
  selections: Selection[],
  opPercent = OP_PERCENT,
  cabinets?: { finishId: string; picks: CabinetPick[] },
): Estimate {
  const lineItems: LineItem[] = [];
  const warnings: string[] = [];

  for (const selection of selections) {
    if (!selection.name) continue;
    if (isCabinetCategory(selection.category)) continue;
    const item = lookupOption(selection.category, selection.name);
    if (!item) {
      warnings.push(`No catalog option named \u201c${selection.name}\u201d in ${selection.category}.`);
      continue;
    }

    let qty: number | null = selection.quantity;
    if (qty == null) {
      qty = inferredQuantity(scan, item.category, item.unit);
    }
    if (qty == null || qty <= 0) {
      warnings.push(`Enter a quantity for ${item.name}.`);
      continue;
    }

    const quantity = round2(qty);
    const unitCost = item.cost_per_unit;
    lineItems.push({
      description: item.name,
      quantity,
      unit: item.unit,
      unitCost,
      lineTotal: round2(quantity * unitCost),
      kind: "material",
      category: item.category,
    });
  }

  if (cabinets) {
    const extra = cabinetLineItems(cabinets.finishId, cabinets.picks);
    lineItems.push(...extra.lines);
    warnings.push(...extra.warnings);
  }

  const materialsSubtotal = round2(lineItems.reduce((sum, line) => sum + line.lineTotal, 0));
  const laborSubtotal = round2(materialsSubtotal * (opPercent / 100));

  return {
    lineItems,
    materialsSubtotal,
    laborSubtotal,
    grandTotal: round2(materialsSubtotal + laborSubtotal),
    laborRate: opPercent,
    opPercent,
    warnings,
  };
}

export function estimateJobRoom(room: JobRoom, opPercent = OP_PERCENT): RoomEstimate {
  const scan = parseScan(room);
  return {
    room,
    typeName: getRoom(room.roomTypeId).display_name,
    scan,
    estimate: buildEstimate(scan, selectionsFromRoom(room), opPercent, {
      finishId: room.cabinetFinishId ?? "gs",
      picks: room.cabinets ?? [],
    }),
  };
}

export function estimateJob(rooms: JobRoom[], opPercent = OP_PERCENT): JobEstimate {
  const roomEstimates = rooms.map((room) => estimateJobRoom(room, opPercent));
  const completeLineItems: JobLineItem[] = roomEstimates.flatMap((entry) =>
    entry.estimate.lineItems.map((line) => ({
      ...line,
      roomId: entry.room.id,
      roomLabel: entry.room.label,
    })),
  );
  const materialsSubtotal = round2(roomEstimates.reduce((sum, entry) => sum + entry.estimate.materialsSubtotal, 0));
  const laborSubtotal = round2(roomEstimates.reduce((sum, entry) => sum + entry.estimate.laborSubtotal, 0));
  return {
    rooms: roomEstimates,
    completeLineItems,
    materialsSubtotal,
    laborSubtotal,
    grandTotal: round2(materialsSubtotal + laborSubtotal),
    warnings: roomEstimates.flatMap((entry) =>
      entry.estimate.warnings.map((warning) => `${entry.room.label}: ${warning}`),
    ),
  };
}

export function newId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Math.random().toString(36).slice(2, 10)}`;
}

export function createBlankRoom(roomTypeId = "kitchen", existing: JobRoom[] = []): JobRoom {
  const type = getRoom(roomTypeId);
  return {
    id: newId(),
    label: uniqueRoomLabel(type.display_name, existing),
    roomTypeId: type.room_id,
    lengthFt: 12,
    widthFt: 10,
    heightFt: 8,
    doors: [{ id: newId(), widthFt: 2.5, heightFt: 6.67 }],
    windows: [{ id: newId(), widthFt: 3, heightFt: 4 }],
    extraCategories: [],
    selections: {},
    cabinetFinishId: "gs",
    cabinets: [],
  };
}

export function cloneRoom(room: JobRoom, existing: JobRoom[]): JobRoom {
  return {
    ...room,
    id: newId(),
    label: uniqueRoomLabel(room.label, existing),
    doors: room.doors.map((item) => ({ ...item, id: newId() })),
    windows: room.windows.map((item) => ({ ...item, id: newId() })),
    extraCategories: [...room.extraCategories],
    selections: Object.fromEntries(
      Object.entries(room.selections).map(([key, value]) => [
        key,
        Array.isArray(value) ? value.map((item) => ({ ...item })) : { ...value },
      ]),
    ),
    cabinets: (room.cabinets ?? []).map((item) => ({ ...item, id: newId() })),
  };
}

export const SAMPLE_CLIENT: ClientInfo = {
  name: "Jordan Hale",
  address: "4412 Market Street, Springfield, IL 62701",
  phone: "(217) 555-0198",
  email: "jordan.hale@example.com",
  propertyName: "123 Oak St remodel",
  propertyAddress: "123 Oak St, Springfield, IL 62701",
};

export const EMPTY_CLIENT: ClientInfo = {
  name: "",
  address: "",
  phone: "",
  email: "",
  propertyName: "",
  propertyAddress: "",
};

export function sampleKitchenRoom(): JobRoom {
  return {
    id: "room-kitchen",
    label: "Kitchen",
    roomTypeId: "kitchen",
    lengthFt: 14,
    widthFt: 12,
    heightFt: 8,
    doors: [
      { id: "sample-door-1", widthFt: 2.67, heightFt: 6.67 },
      { id: "sample-door-2", widthFt: 2.5, heightFt: 6.67 },
    ],
    windows: [{ id: "sample-window-1", widthFt: 4, heightFt: 3 }],
    extraCategories: [],
    selections: {
      flooring: { name: "Luxury vinyl plank \u2014 installed", quantity: null },
      "walls/paint": { name: "Prime (1 coat) then paint (2 coats) drywall", quantity: null },
      countertops: { name: "Quartz countertop \u2014 installed", quantity: 32 },
      "trim/baseboards": [
        { name: "Baseboard \u2014 3 1/4 in", quantity: null },
        { name: "Seal (1 coat) & paint (2 coats) baseboard", quantity: null },
      ],
      lighting: { name: "Recessed light fixture", quantity: 4 },
    },
    cabinetFinishId: "gs",
    cabinets: [
      { id: "cab-sb36", sku: "SB36", quantity: 1 },
      { id: "cab-b24", sku: "B24", quantity: 2 },
      { id: "cab-b18", sku: "B18", quantity: 2 },
      { id: "cab-b12", sku: "B12", quantity: 1 },
      { id: "cab-db15", sku: "DB15-3", quantity: 1 },
      { id: "cab-w3030", sku: "W3030", quantity: 4 },
      { id: "cab-w3612", sku: "W3612", quantity: 1 },
    ],
  };
}

export function sampleBathroomRoom(): JobRoom {
  return {
    id: "room-bathroom",
    label: "Bathroom",
    roomTypeId: "bathroom",
    lengthFt: 10,
    widthFt: 8,
    heightFt: 8,
    doors: [{ id: "sample-bath-door", widthFt: 2.5, heightFt: 6.67 }],
    windows: [{ id: "sample-bath-window", widthFt: 2, heightFt: 3 }],
    extraCategories: [],
    selections: {
      flooring: { name: "Tile floor covering \u2014 2x2", quantity: null },
      "walls/paint": { name: "Prime (1 coat) then paint (2 coats) drywall", quantity: null },
      plumbing: { name: "Toilet", quantity: 1 },
      "tile/shower surround": { name: "Shower faucet \u2014 standard grade", quantity: 1 },
      lighting: { name: "Vanity light strip \u2014 stainless", quantity: 1 },
      "trim/baseboards": { name: "Baseboard \u2014 3 1/4 in", quantity: null },
    },
    cabinetFinishId: "gs",
    cabinets: [{ id: "cab-va36", sku: "VA362134", quantity: 1 }],
  };
}

export function sampleJob() {
  const rooms = [sampleKitchenRoom(), sampleBathroomRoom()];
  return {
    rooms,
    activeRoomId: rooms[0].id,
    laborRate: OP_PERCENT,
    client: { ...SAMPLE_CLIENT },
  };
}

export const MENDEZ_CLIENT: ClientInfo = {
  name: "William Mendez",
  address: "3303 Shady Springs dr. San Antonio 78230",
  phone: "2103864699",
  email: "wmendez2487@gmail.com",
  propertyName: "Make ready",
  propertyAddress: "3303 Shady Springs dr. San Antonio 78230",
};

function winInsert() {
  return {
    name: "Vinyl insert dual pane — asbestos cement siding, interior only, do not disturb exterior",
    quantity: 1,
  };
}

function cheapBase() {
  return [
    { name: "Baseboard — 2 1/4 in MDF", quantity: null },
    { name: "Seal (1 coat) & paint (2 coats) baseboard", quantity: null },
  ];
}

function popcornAndCeilingPaint() {
  return [
    { name: "Popcorn ceiling removal — scrape only, no sand", quantity: null },
    { name: "Paint ceiling — 2 coats", quantity: null },
  ];
}

export function sampleShadySpringsJob() {
  /** Rebuild of Flip-Fixer-make-ready contractor/customer PDFs — target $45,623.31. */
  const lvp = { name: "Luxury vinyl plank — installed", quantity: null };
  const paint1 = { name: "Paint drywall — one coat", quantity: null };
  const fan = { name: "Ceiling fan (labor only, existing box, owner supplied)", quantity: 1 };
  const bathFan = { name: "Bathroom ventilation fan", quantity: 1 };
  const carpetDemo = { name: "Carpet removal and haul-off", quantity: null };
  const rooms: JobRoom[] = [
    {
      id: "ss-kitchen",
      label: "Kitchen",
      roomTypeId: "kitchen",
      lengthFt: 15,
      widthFt: 8,
      heightFt: 8,
      doors: [{ id: "ss-k-d", widthFt: 2.5, heightFt: 6.67 }],
      windows: [{ id: "ss-k-w", widthFt: 3, heightFt: 4 }],
      extraCategories: ["windows"],
      selections: {
        flooring: lvp,
        "walls/paint": paint1,
        "trim/baseboards": cheapBase(),
        // One fan in kitchen (not two fixtures). Matching fan lives in Dining.
        lighting: fan,
        ceiling: popcornAndCeilingPaint(),
        windows: winInsert(),
      },
      cabinetFinishId: "gs",
      cabinets: [],
    },
    {
      id: "ss-master",
      label: "Master",
      roomTypeId: "bedroom",
      lengthFt: 10,
      widthFt: 14,
      heightFt: 8,
      doors: [{ id: "ss-m-d", widthFt: 2.5, heightFt: 6.67 }],
      windows: [{ id: "ss-m-w", widthFt: 3, heightFt: 4 }],
      extraCategories: ["windows"],
      selections: {
        flooring: lvp,
        "walls/paint": paint1,
        "trim/baseboards": cheapBase(),
        doors: { name: "Interior door unit — standard grade", quantity: 1 },
        ceiling: popcornAndCeilingPaint(),
        windows: winInsert(),
      },
      cabinetFinishId: "gs",
      cabinets: [],
    },
    {
      id: "ss-living",
      label: "Living Room",
      roomTypeId: "living_room",
      lengthFt: 18,
      widthFt: 14,
      heightFt: 8,
      doors: [{ id: "ss-l-d", widthFt: 2.5, heightFt: 6.67 }],
      windows: [
        { id: "ss-l-w1", widthFt: 3, heightFt: 4 },
        { id: "ss-l-w2", widthFt: 3, heightFt: 4 },
      ],
      extraCategories: ["windows"],
      selections: {
        flooring: [lvp, carpetDemo],
        "walls/paint": paint1,
        "trim/baseboards": cheapBase(),
        lighting: fan,
        drywall: {
          name: "5/8 in drywall — hung, taped, ready for texture",
          quantity: 192,
        },
        ceiling: popcornAndCeilingPaint(),
        windows: { ...winInsert(), quantity: 2 },
      },
      cabinetFinishId: "gs",
      cabinets: [],
    },
    {
      id: "ss-mbath",
      label: "Master bath",
      roomTypeId: "bathroom",
      lengthFt: 5,
      widthFt: 8,
      heightFt: 8,
      doors: [{ id: "ss-mb-d", widthFt: 2.5, heightFt: 6.67 }],
      windows: [],
      extraCategories: [],
      selections: {
        flooring: [
          { name: "Underlayment — 1/4 in cement board", quantity: 8 },
          { name: "Tile floor covering — 2x2", quantity: 8 },
        ],
        "walls/paint": paint1,
        "tile/shower surround": [
          { name: "Ceramic tile removal — wall", quantity: 68 },
          { name: "Ceramic tile removal — floor", quantity: 8 },
          { name: "Cement board — 1/2 in shower/tub walls", quantity: 68 },
          { name: "Waterproofing membrane — liquid applied (RedGard)", quantity: 76 },
          { name: "Ceramic tile — wall, installed", quantity: 68 },
          { name: "Shower curb — site-built ceramic/porcelain", quantity: 2.5 },
        ],
        lighting: bathFan,
        ceiling: popcornAndCeilingPaint(),
      },
      cabinetFinishId: "gs",
      cabinets: [],
    },
    {
      id: "ss-br2",
      label: "Bedroom 2",
      roomTypeId: "bedroom",
      lengthFt: 10,
      widthFt: 10,
      heightFt: 8,
      doors: [{ id: "ss-b2-d", widthFt: 2.5, heightFt: 6.67 }],
      windows: [{ id: "ss-b2-w", widthFt: 3, heightFt: 4 }],
      extraCategories: ["windows"],
      selections: {
        flooring: lvp,
        "walls/paint": paint1,
        "trim/baseboards": cheapBase(),
        lighting: fan,
        ceiling: popcornAndCeilingPaint(),
        windows: winInsert(),
      },
      cabinetFinishId: "gs",
      cabinets: [],
    },
    {
      id: "ss-gbath",
      label: "Guest Bath",
      roomTypeId: "bathroom",
      lengthFt: 7,
      widthFt: 5,
      heightFt: 8,
      doors: [{ id: "ss-gb-d", widthFt: 2.5, heightFt: 6.67 }],
      // Insert window is priced as a line; do not cut it out of wall area (matches PDF).
      windows: [],
      extraCategories: ["windows"],
      selections: {
        flooring: lvp,
        "walls/paint": paint1,
        "tile/shower surround": [
          { name: "Ceramic tile removal — floor", quantity: 35 },
          { name: "Ceramic tile removal — wall", quantity: 70 },
          { name: "Cement board — 1/2 in shower/tub walls", quantity: 70 },
          { name: "Waterproofing membrane — liquid applied (RedGard)", quantity: 70 },
          { name: "Ceramic tile — wall, installed", quantity: 70 },
          { name: "Bathtub reglaze", quantity: 1 },
        ],
        lighting: bathFan,
        ceiling: popcornAndCeilingPaint(),
        windows: winInsert(),
      },
      cabinetFinishId: "gs",
      cabinets: [],
    },
    {
      id: "ss-dining",
      label: "Dining Room",
      roomTypeId: "dining_room",
      lengthFt: 12,
      widthFt: 12,
      heightFt: 8,
      doors: [{ id: "ss-di-d", widthFt: 6, heightFt: 6.67 }],
      windows: [],
      extraCategories: ["doors"],
      selections: {
        flooring: lvp,
        "walls/paint": paint1,
        "trim/baseboards": cheapBase(),
        lighting: fan,
        ceiling: popcornAndCeilingPaint(),
        doors: {
          name: "Vinyl sliding patio door — dual pane, interior insert, do not disturb siding",
          quantity: 1,
        },
      },
      cabinetFinishId: "gs",
      cabinets: [],
    },
    {
      id: "ss-br3",
      label: "Bedroom 3",
      roomTypeId: "bedroom",
      lengthFt: 10,
      widthFt: 14,
      heightFt: 8,
      doors: [{ id: "ss-b3-d", widthFt: 2.5, heightFt: 6.67 }],
      windows: [{ id: "ss-b3-w", widthFt: 3, heightFt: 4 }],
      extraCategories: ["windows"],
      selections: {
        flooring: lvp,
        "walls/paint": paint1,
        "trim/baseboards": cheapBase(),
        lighting: fan,
        ceiling: popcornAndCeilingPaint(),
        windows: winInsert(),
      },
      cabinetFinishId: "gs",
      cabinets: [],
    },
    {
      id: "ss-hall",
      label: "Hallway by 2nd bath",
      roomTypeId: "hallway_entryway",
      lengthFt: 7,
      widthFt: 5,
      heightFt: 8,
      doors: [
        { id: "ss-h-d1", widthFt: 2.5, heightFt: 6.67 },
        { id: "ss-h-d2", widthFt: 2.5, heightFt: 6.67 },
      ],
      windows: [],
      extraCategories: [],
      selections: {
        flooring: lvp,
        "walls/paint": paint1,
        "trim/baseboards": cheapBase(),
        ceiling: popcornAndCeilingPaint(),
      },
      cabinetFinishId: "gs",
      cabinets: [],
    },
    {
      // Combined closet floor area ≈ 108 sf — flooring, walls/paint, trim, ceilings.
      id: "ss-closets",
      label: "Closets (combined)",
      roomTypeId: "closet",
      lengthFt: 12,
      widthFt: 9,
      heightFt: 8,
      doors: [
        { id: "ss-cl-d1", widthFt: 2.5, heightFt: 6.67 },
        { id: "ss-cl-d2", widthFt: 2.5, heightFt: 6.67 },
      ],
      windows: [],
      extraCategories: [],
      selections: {
        flooring: lvp,
        "walls/paint": paint1,
        "trim/baseboards": cheapBase(),
        ceiling: popcornAndCeilingPaint(),
      },
      cabinetFinishId: "gs",
      cabinets: [],
    },
    {
      id: "ss-garage",
      label: "Garage",
      roomTypeId: "garage",
      lengthFt: 20,
      widthFt: 12,
      heightFt: 8,
      doors: [{ id: "ss-g-d", widthFt: 3, heightFt: 7 }],
      windows: [{ id: "ss-g-w", widthFt: 3, heightFt: 3 }],
      extraCategories: ["windows", "roofing", "cleanup"],
      selections: {
        doors: [
          { name: "Garage door — single car, painted steel, 7x7", quantity: 1 },
          { name: "Garage door opener — add if existing is dead", quantity: 1 },
        ],
        roofing: {
          name: "Roof patch — garage gable eave, missing shingles (not a reroof)",
          quantity: 1,
        },
        insulation: {
          name: "Attic insulation — allowance until depth is measured",
          quantity: 1,
        },
        windows: {
          name: "Vinyl replacement dual pane — CMU / block opening",
          quantity: 1,
        },
        cleanup: { name: "Debris haul-off", quantity: 1 },
      },
      cabinetFinishId: "gs",
      cabinets: [],
    },
  ];
  return {
    rooms,
    activeRoomId: rooms[0].id,
    laborRate: OP_PERCENT,
    client: { ...MENDEZ_CLIENT },
  };
}

export function blankJob() {
  const room: JobRoom = {
    id: "room-1",
    label: "Kitchen",
    roomTypeId: "kitchen",
    lengthFt: 12,
    widthFt: 10,
    heightFt: 8,
    doors: [{ id: "door-1", widthFt: 2.5, heightFt: 6.67 }],
    windows: [{ id: "window-1", widthFt: 3, heightFt: 4 }],
    extraCategories: [],
    selections: {},
    cabinetFinishId: "gs",
    cabinets: [],
  };
  return {
    rooms: [room],
    activeRoomId: room.id,
    laborRate: OP_PERCENT,
    client: { ...EMPTY_CLIENT },
  };
}
