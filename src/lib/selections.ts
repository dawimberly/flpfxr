import type { SelectionValue } from "@/lib/estimator";

export type SelectionInput = SelectionValue | SelectionValue[] | undefined;

export function selectionList(value: SelectionInput): SelectionValue[] {
  if (!value) return [];
  const list = Array.isArray(value) ? value : [value];
  return list.filter((item) => Boolean(item?.name?.trim()));
}

export function normalizeSelections(
  raw: Record<string, SelectionInput> | undefined,
): Record<string, SelectionValue[]> {
  const out: Record<string, SelectionValue[]> = {};
  if (!raw) return out;
  for (const [key, value] of Object.entries(raw)) {
    const list = selectionList(value);
    if (list.length) {
      out[key] = list.map((item) => ({
        name: item.name,
        quantity: item.quantity ?? null,
      }));
    }
  }
  return out;
}

export function normalizeRoom<T extends { selections?: Record<string, SelectionInput> }>(room: T): T {
  return {
    ...room,
    selections: normalizeSelections(room.selections),
  };
}

export function normalizeRooms<T extends { selections?: Record<string, SelectionInput> }>(rooms: T[]): T[] {
  return rooms.map((room) => normalizeRoom(room));
}
