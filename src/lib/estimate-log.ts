import {
  estimateJob,
  sampleJob,
  type ClientInfo,
  type JobRoom,
} from "@/lib/estimator";

const LOG_KEY = "flipfixer.estimate-log.v1";
const DRAFT_KEY = "flipfixer.estimate-draft.v1";

export type EstimateSnapshot = {
  rooms: JobRoom[];
  laborRate: number;
  client: ClientInfo;
};

export type SavedEstimate = {
  id: string;
  savedAt: string;
  snapshot: EstimateSnapshot;
  summary: {
    customer: string;
    property: string;
    address: string;
    phone: string;
    roomCount: number;
    grandTotal: number;
  };
};

export type EstimateDraft = EstimateSnapshot & {
  activeRoomId: string;
  currentSavedId: string | null;
};

function canUseStorage() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function readJson<T>(key: string): T | null {
  if (!canUseStorage()) return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  if (!canUseStorage()) return;
  localStorage.setItem(key, JSON.stringify(value));
}

export function summarizeSnapshot(snapshot: EstimateSnapshot) {
  const job = estimateJob(snapshot.rooms, snapshot.laborRate);
  const customer = snapshot.client.name.trim();
  const property = snapshot.client.propertyName.trim();
  const address = snapshot.client.propertyAddress.trim() || snapshot.client.address.trim();
  return {
    customer: customer || "Unnamed client",
    property: property || address || "Untitled job",
    address,
    phone: snapshot.client.phone.trim(),
    roomCount: snapshot.rooms.length,
    grandTotal: job.grandTotal,
  };
}

function isSavedEstimate(value: unknown): value is SavedEstimate {
  if (!value || typeof value !== "object") return false;
  const item = value as SavedEstimate;
  return Boolean(item.id && item.savedAt && item.snapshot?.rooms && item.snapshot.client);
}

export function loadEstimateLog(): SavedEstimate[] {
  const raw = readJson<unknown>(LOG_KEY);
  const list = Array.isArray(raw) ? raw.filter(isSavedEstimate) : [];
  return list.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

function writeEstimateLog(list: SavedEstimate[]) {
  writeJson(LOG_KEY, list);
}

export function loadDraft(): EstimateDraft | null {
  const draft = readJson<EstimateDraft>(DRAFT_KEY);
  if (!draft?.rooms?.length || !draft.client) return null;
  return draft;
}

export function saveDraft(draft: EstimateDraft) {
  writeJson(DRAFT_KEY, cloneJson(draft));
}

export function snapshotFromJob(input: EstimateSnapshot): EstimateSnapshot {
  return cloneJson({
    rooms: input.rooms,
    laborRate: input.laborRate,
    client: input.client,
  });
}

export function upsertSavedEstimate(
  snapshot: EstimateSnapshot,
  id?: string | null,
): SavedEstimate {
  const list = loadEstimateLog();
  const record: SavedEstimate = {
    id: id && list.some((item) => item.id === id) ? id : crypto.randomUUID(),
    savedAt: new Date().toISOString(),
    snapshot: snapshotFromJob(snapshot),
    summary: summarizeSnapshot(snapshot),
  };
  writeEstimateLog([record, ...list.filter((item) => item.id !== record.id)]);
  return record;
}

export function deleteSavedEstimate(id: string) {
  writeEstimateLog(loadEstimateLog().filter((item) => item.id !== id));
}

export function getSavedEstimate(id: string) {
  return loadEstimateLog().find((item) => item.id === id) ?? null;
}

export function searchEstimateLog(query: string, list = loadEstimateLog()) {
  const needle = query.trim().toLowerCase();
  if (!needle) return list;
  return list.filter((item) => {
    const haystack = [
      item.summary.customer,
      item.summary.property,
      item.summary.address,
      item.summary.phone,
      item.snapshot.client.email,
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(needle);
  });
}

export function seedSampleEstimateIfEmpty() {
  if (loadEstimateLog().length > 0) return loadEstimateLog();
  const sample = sampleJob();
  upsertSavedEstimate({
    rooms: sample.rooms,
    laborRate: sample.laborRate,
    client: sample.client,
  });
  return loadEstimateLog();
}

export function formatSavedAt(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
