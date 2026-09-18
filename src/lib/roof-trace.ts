import {
  createBlankRoom,
  uniqueRoomLabel,
  type ClientInfo,
  type JobRoom,
} from "@/lib/estimator";
import type { RoofSummary } from "@/lib/roof-math";
import { roofingSelectionsFromSummary, type RoofSendExtras } from "@/lib/roof-line-items";

export const ROOF_ROOM_TYPE = "exterior_outdoor";
export const ROOF_ROOM_LABEL = "Roof";

function isEmptyLeftoverKitchen(room: JobRoom): boolean {
  if (room.label !== "Kitchen") return false;
  if ((room.cabinets ?? []).length) return false;
  return Object.keys(room.selections ?? {}).length === 0;
}
export {
  ROOF_SHINGLE,
  ROOF_TEAROFF,
  ROOF_UNDERLAYMENT,
  ROOF_DRIP,
  ROOF_RIDGE_CAP,
  ROOF_VALLEY,
  ROOF_STEEP,
  roofingSelectionsFromSummary,
} from "@/lib/roof-line-items";

export function applyRoofTraceToJob(
  rooms: JobRoom[],
  client: ClientInfo,
  address: string,
  summary: RoofSummary,
  extras: RoofSendExtras = {},
): { rooms: JobRoom[]; client: ClientInfo; roomId: string } {
  const roofing = roofingSelectionsFromSummary(summary, extras);
  const selections = {
    roofing,
    cleanup: { name: "Debris haul-off", quantity: 1, act: "plus" as const },
  };
  const existing = rooms.find(
    (room) => room.roomTypeId === ROOF_ROOM_TYPE && room.label === ROOF_ROOM_LABEL,
  );
  let nextRooms: JobRoom[];
  let roomId: string;
  if (existing) {
    roomId = existing.id;
    nextRooms = rooms.map((room) =>
      room.id === existing.id
        ? {
            ...room,
            extraCategories: [...new Set([...room.extraCategories, "roofing", "cleanup"])],
            selections: { ...room.selections, ...selections },
          }
        : room,
    );
  } else {
    const blank = createBlankRoom(ROOF_ROOM_TYPE, rooms);
    const room: JobRoom = {
      ...blank,
      label: uniqueRoomLabel(ROOF_ROOM_LABEL, rooms),
      doors: [],
      windows: [],
      extraCategories: [...new Set([...blank.extraCategories, "roofing", "cleanup"])],
      selections,
    };
    roomId = room.id;
    nextRooms = [...rooms, room];
  }
  nextRooms = nextRooms.filter((room) => !isEmptyLeftoverKitchen(room));
  const trimmed = address.trim();
  return {
    rooms: nextRooms,
    roomId,
    client: trimmed
      ? {
          ...client,
          propertyAddress: client.propertyAddress.trim() || trimmed,
          address: client.address.trim() || trimmed,
        }
      : client,
  };
}
