import {
  createBlankRoom,
  uniqueRoomLabel,
  type ClientInfo,
  type JobRoom,
} from "@/lib/estimator";
import type { RoofSummary } from "@/lib/roof-math";
import { roofingSelectionsFromSummary } from "@/lib/roof-line-items";

export const ROOF_ROOM_TYPE = "exterior_outdoor";
export const ROOF_ROOM_LABEL = "Roof";
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
): { rooms: JobRoom[]; client: ClientInfo; roomId: string } {
  const selections = { roofing: roofingSelectionsFromSummary(summary) };
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
            extraCategories: room.extraCategories.includes("roofing")
              ? room.extraCategories
              : [...room.extraCategories, "roofing"],
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
      extraCategories: blank.extraCategories.includes("roofing")
        ? blank.extraCategories
        : [...blank.extraCategories, "roofing"],
      selections,
    };
    roomId = room.id;
    nextRooms = [...rooms, room];
  }
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
