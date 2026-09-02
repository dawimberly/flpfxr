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
  selections: Record<string, SelectionValue>;
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

export function visibleCategoriesFor(room: JobRoom) {
  const type = getRoom(room.roomTypeId);
  const ids = [...type.typical_categories, ...room.extraCategories, ...Object.keys(room.selections)];
  return [...new Set(ids)].filter((id) => catalog[id]);
}

export function selectionsFromRoom(room: JobRoom): Selection[] {
  return visibleCategoriesFor(room)
    .filter((category) => !isCabinetCategory(category))
    .map((category) => {
      const value = room.selections[category];
      if (!value?.name) return null;
      return { category, name: value.name, quantity: value.quantity };
    })
    .filter((item): item is Selection => item != null);
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
      warnings.push(`No catalog option named “${selection.name}” in ${selection.category}.`);
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
    selections: { ...room.selections },
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
      flooring: { name: "Luxury vinyl plank — installed", quantity: null },
      "walls/paint": { name: "Prime (1 coat) then paint (2 coats) drywall", quantity: null },
      countertops: { name: "Quartz countertop — installed", quantity: 32 },
      "trim/baseboards": { name: "Baseboard — 3 1/4 in", quantity: null },
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
      flooring: { name: "Tile floor covering — 2x2", quantity: null },
      "walls/paint": { name: "Prime (1 coat) then paint (2 coats) drywall", quantity: null },
      plumbing: { name: "Toilet", quantity: 1 },
      "tile/shower surround": { name: "Shower faucet — standard grade", quantity: 1 },
      lighting: { name: "Vanity light strip — stainless", quantity: 1 },
      "trim/baseboards": { name: "Baseboard — 3 1/4 in", quantity: null },
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
