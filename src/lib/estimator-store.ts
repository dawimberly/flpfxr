import { create } from "zustand";
import {
  deleteSavedEstimate,
  getSavedEstimate,
  loadDraft,
  loadEstimateLog,
  saveDraft,
  seedSampleEstimateIfEmpty,
  snapshotFromJob,
  upsertSavedEstimate,
  type SavedEstimate,
} from "@/lib/estimate-log";
import {
  blankJob,
  cloneRoom,
  createBlankRoom,
  getRoom,
  sampleJob,
  uniqueRoomLabel,
  type ClientInfo,
  type JobRoom,
  type Opening,
  type SelectionValue,
} from "@/lib/estimator";

type JobSlice = {
  rooms: JobRoom[];
  activeRoomId: string;
  laborRate: number;
  client: ClientInfo;
};

type EstimatorState = JobSlice & {
  currentSavedId: string | null;
  lastSavedAt: string | null;
  log: SavedEstimate[];
  hydrated: boolean;
  selectRoom: (id: string) => void;
  addRoom: (roomTypeId: string) => void;
  duplicateRoom: (id: string) => void;
  removeRoom: (id: string) => void;
  renameRoom: (id: string, label: string) => void;
  setRoomType: (roomTypeId: string) => void;
  setDimension: (key: "lengthFt" | "widthFt" | "heightFt", value: number) => void;
  setOpPercent: (value: number) => void;
  setOpening: (kind: "doors" | "windows", id: string, patch: Partial<Opening>) => void;
  addOpening: (kind: "doors" | "windows") => void;
  removeOpening: (kind: "doors" | "windows", id: string) => void;
  setSelection: (category: string, patch: Partial<SelectionValue>) => void;
  clearSelection: (category: string) => void;
  addCategory: (category: string) => void;
  setCabinetFinish: (finishId: string) => void;
  addCabinet: (sku: string) => void;
  setCabinetQty: (id: string, quantity: number) => void;
  removeCabinet: (id: string) => void;
  setClient: (patch: Partial<ClientInfo>) => void;
  loadSample: () => void;
  startOver: () => void;
  hydrate: () => void;
  refreshLog: () => void;
  saveToLog: (asNew?: boolean) => SavedEstimate | null;
  openSaved: (id: string) => boolean;
  deleteSaved: (id: string) => void;
};

function patchActive(state: EstimatorState, patch: Partial<JobRoom>): Partial<EstimatorState> {
  return {
    rooms: state.rooms.map((room) => (room.id === state.activeRoomId ? { ...room, ...patch } : room)),
  };
}

function jobSlice(state: JobSlice): JobSlice {
  return {
    rooms: state.rooms,
    activeRoomId: state.activeRoomId,
    laborRate: state.laborRate,
    client: state.client,
  };
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;
let persistBound = false;

function bindDraftPersist() {
  if (persistBound) return;
  persistBound = true;
  useEstimatorStore.subscribe((state) => {
    if (!state.hydrated) return;
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      saveDraft({
        ...jobSlice(state),
        currentSavedId: state.currentSavedId,
      });
    }, 250);
  });
}

export const useEstimatorStore = create<EstimatorState>((set, get) => ({
  ...sampleJob(),
  currentSavedId: null,
  lastSavedAt: null,
  log: [],
  hydrated: false,
  selectRoom: (id) => set({ activeRoomId: id }),
  addRoom: (roomTypeId) =>
    set((state) => {
      const room = createBlankRoom(roomTypeId, state.rooms);
      return { rooms: [...state.rooms, room], activeRoomId: room.id };
    }),
  duplicateRoom: (id) =>
    set((state) => {
      const source = state.rooms.find((room) => room.id === id);
      if (!source) return state;
      const copy = cloneRoom(source, state.rooms);
      const index = state.rooms.findIndex((room) => room.id === id);
      const rooms = [...state.rooms];
      rooms.splice(index + 1, 0, copy);
      return { rooms, activeRoomId: copy.id };
    }),
  removeRoom: (id) =>
    set((state) => {
      if (state.rooms.length <= 1) return state;
      const rooms = state.rooms.filter((room) => room.id !== id);
      const activeRoomId =
        state.activeRoomId === id ? (rooms[0]?.id ?? state.activeRoomId) : state.activeRoomId;
      return { rooms, activeRoomId };
    }),
  renameRoom: (id, label) =>
    set((state) => ({
      rooms: state.rooms.map((room) => (room.id === id ? { ...room, label } : room)),
    })),
  setRoomType: (roomTypeId) =>
    set((state) => {
      const active = state.rooms.find((room) => room.id === state.activeRoomId);
      if (!active) return state;
      const nextType = getRoom(roomTypeId);
      const previousType = getRoom(active.roomTypeId);
      const others = state.rooms.filter((room) => room.id !== active.id);
      const shouldRename =
        active.label === previousType.display_name || active.label.startsWith(`${previousType.display_name} `);
      return patchActive(state, {
        roomTypeId: nextType.room_id,
        label: shouldRename ? uniqueRoomLabel(nextType.display_name, others) : active.label,
      });
    }),
  setDimension: (key, value) =>
    set((state) => patchActive(state, { [key]: Number.isFinite(value) ? value : 0 })),
  setOpPercent: (value) => set({ laborRate: Number.isFinite(value) ? value : 0 }),
  setOpening: (kind, id, patch) =>
    set((state) => {
      const active = state.rooms.find((room) => room.id === state.activeRoomId);
      if (!active) return state;
      return patchActive(state, {
        [kind]: active[kind].map((item) => (item.id === id ? { ...item, ...patch } : item)),
      });
    }),
  addOpening: (kind) =>
    set((state) => {
      const active = state.rooms.find((room) => room.id === state.activeRoomId);
      if (!active) return state;
      return patchActive(state, {
        [kind]: [
          ...active[kind],
          {
            id: crypto.randomUUID(),
            widthFt: kind === "doors" ? 2.5 : 3,
            heightFt: kind === "doors" ? 6.67 : 4,
          },
        ],
      });
    }),
  removeOpening: (kind, id) =>
    set((state) => {
      const active = state.rooms.find((room) => room.id === state.activeRoomId);
      if (!active) return state;
      return patchActive(state, {
        [kind]: active[kind].filter((item) => item.id !== id),
      });
    }),
  setSelection: (category, patch) =>
    set((state) => {
      const active = state.rooms.find((room) => room.id === state.activeRoomId);
      if (!active) return state;
      const current = active.selections[category] ?? { name: "", quantity: null };
      return patchActive(state, {
        selections: {
          ...active.selections,
          [category]: { ...current, ...patch },
        },
      });
    }),
  clearSelection: (category) =>
    set((state) => {
      const active = state.rooms.find((room) => room.id === state.activeRoomId);
      if (!active) return state;
      const selections = { ...active.selections };
      delete selections[category];
      return patchActive(state, {
        selections,
        extraCategories: active.extraCategories.filter((item) => item !== category),
      });
    }),
  addCategory: (category) =>
    set((state) => {
      const active = state.rooms.find((room) => room.id === state.activeRoomId);
      if (!active) return state;
      if (active.extraCategories.includes(category) || active.selections[category]) return state;
      return patchActive(state, {
        extraCategories: [...active.extraCategories, category],
      });
    }),
  setCabinetFinish: (finishId) => set((state) => patchActive(state, { cabinetFinishId: finishId })),
  addCabinet: (sku) =>
    set((state) => {
      const active = state.rooms.find((room) => room.id === state.activeRoomId);
      if (!active) return state;
      const cabinets = active.cabinets ?? [];
      const existing = cabinets.find((item) => item.sku === sku);
      if (existing) {
        return patchActive(state, {
          cabinets: cabinets.map((item) =>
            item.sku === sku ? { ...item, quantity: item.quantity + 1 } : item,
          ),
        });
      }
      return patchActive(state, {
        cabinets: [...cabinets, { id: crypto.randomUUID(), sku, quantity: 1 }],
      });
    }),
  setCabinetQty: (id, quantity) =>
    set((state) => {
      const active = state.rooms.find((room) => room.id === state.activeRoomId);
      if (!active) return state;
      const cabinets = active.cabinets ?? [];
      const next = Number.isFinite(quantity) ? Math.max(0, quantity) : 0;
      return patchActive(state, {
        cabinets: cabinets.map((item) => (item.id === id ? { ...item, quantity: next } : item)),
      });
    }),
  removeCabinet: (id) =>
    set((state) => {
      const active = state.rooms.find((room) => room.id === state.activeRoomId);
      if (!active) return state;
      return patchActive(state, {
        cabinets: (active.cabinets ?? []).filter((item) => item.id !== id),
      });
    }),
  setClient: (patch) => set((state) => ({ client: { ...state.client, ...patch } })),
  loadSample: () => set({ ...sampleJob(), currentSavedId: null, lastSavedAt: null }),
  startOver: () => set({ ...blankJob(), currentSavedId: null, lastSavedAt: null }),
  hydrate: () => {
    if (get().hydrated) return;
    bindDraftPersist();
    const log = seedSampleEstimateIfEmpty();
    const draft = loadDraft();
    if (draft) {
      const activeRoomId = draft.rooms.some((room) => room.id === draft.activeRoomId)
        ? draft.activeRoomId
        : (draft.rooms[0]?.id ?? get().activeRoomId);
      set({
        rooms: draft.rooms,
        activeRoomId,
        laborRate: draft.laborRate,
        client: draft.client,
        currentSavedId: draft.currentSavedId,
        lastSavedAt: log.find((item) => item.id === draft.currentSavedId)?.savedAt ?? null,
        log,
        hydrated: true,
      });
      return;
    }
    set({ log, hydrated: true });
  },
  refreshLog: () => set({ log: loadEstimateLog() }),
  saveToLog: (asNew = false) => {
    if (typeof window === "undefined") return null;
    const state = get();
    const record = upsertSavedEstimate(
      snapshotFromJob({
        rooms: state.rooms,
        laborRate: state.laborRate,
        client: state.client,
      }),
      asNew ? null : state.currentSavedId,
    );
    set({
      currentSavedId: record.id,
      lastSavedAt: record.savedAt,
      log: loadEstimateLog(),
    });
    return record;
  },
  openSaved: (id) => {
    const record = getSavedEstimate(id);
    if (!record) return false;
    const snapshot = snapshotFromJob(record.snapshot);
    const rooms = snapshot.rooms;
    const activeRoomId = rooms[0]?.id ?? get().activeRoomId;
    set({
      rooms,
      activeRoomId,
      laborRate: snapshot.laborRate,
      client: snapshot.client,
      currentSavedId: record.id,
      lastSavedAt: record.savedAt,
    });
    return true;
  },
  deleteSaved: (id) => {
    deleteSavedEstimate(id);
    const state = get();
    set({
      log: loadEstimateLog(),
      currentSavedId: state.currentSavedId === id ? null : state.currentSavedId,
      lastSavedAt: state.currentSavedId === id ? null : state.lastSavedAt,
    });
  },
}));

export function useActiveRoom(): JobRoom | undefined {
  return useEstimatorStore((state) => state.rooms.find((room) => room.id === state.activeRoomId));
}
