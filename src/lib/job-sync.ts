import {
  loadDraft,
  loadEstimateLog,
  replaceEstimateLog,
  saveDraft,
  type EstimateDraft,
  type SavedEstimate,
} from "@/lib/estimate-log";
import {
  deleteCloudJob,
  pullCloudDraft,
  pullCloudJobs,
  pushCloudDraft,
  pushCloudJob,
} from "@/lib/job-cloud";

function mergeJobs(local: SavedEstimate[], remote: SavedEstimate[]) {
  const map = new Map<string, SavedEstimate>();
  for (const item of [...local, ...remote]) {
    const existing = map.get(item.id);
    if (!existing || item.savedAt > existing.savedAt) map.set(item.id, item);
  }
  return [...map.values()].sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

function draftTime(draft: EstimateDraft | null | undefined, fallbackIso?: string | null): number {
  const raw = draft?.updatedAt ?? fallbackIso ?? "";
  const n = Date.parse(raw);
  return Number.isFinite(n) ? n : 0;
}

/** Merge phone + laptop saved logs. Newer savedAt wins per job id. */
export async function syncJobsFromCloud() {
  try {
    const result = await pullCloudJobs();
    if (!result.ok) return loadEstimateLog();
    const local = loadEstimateLog();
    const merged = mergeJobs(local, result.jobs);
    replaceEstimateLog(merged);
    const remoteIds = new Set(result.jobs.map((item) => item.id));
    await Promise.all(
      merged
        .filter((item) => !remoteIds.has(item.id))
        .map((item) => pushCloudJob({ data: { job: item } }).catch(() => null)),
    );
    return merged;
  } catch {
    return loadEstimateLog();
  }
}

export async function pushJobToCloud(job: SavedEstimate) {
  try {
    await pushCloudJob({ data: { job } });
  } catch {
    /* stay local until signed in / tables ready */
  }
}

export async function deleteJobFromCloud(id: string) {
  try {
    await deleteCloudJob({ data: { id } });
  } catch {
    /* stay local */
  }
}

/**
 * Cross-device in-progress work. Newer updatedAt wins so truck phone edits
 * replace a stale laptop draft (and the other way around).
 */
export async function syncDraftFromCloud(): Promise<EstimateDraft | null> {
  const local = loadDraft();
  try {
    const result = await pullCloudDraft();
    if (!result.ok) return local;

    if (!result.draft) {
      if (local) await pushCloudDraft({ data: { draft: local } }).catch(() => null);
      return local;
    }

    if (!local) {
      saveDraft(result.draft);
      return result.draft;
    }

    const remoteMs = draftTime(result.draft, result.updatedAt);
    const localMs = draftTime(local);

    if (remoteMs > localMs) {
      saveDraft(result.draft);
      return result.draft;
    }
    if (localMs > remoteMs) {
      await pushCloudDraft({ data: { draft: local } }).catch(() => null);
      return local;
    }
    return local;
  } catch {
    return local;
  }
}

export async function pushDraftToCloud(draft: EstimateDraft) {
  const stamped: EstimateDraft = {
    ...draft,
    updatedAt: draft.updatedAt ?? new Date().toISOString(),
  };
  saveDraft(stamped);
  try {
    await pushCloudDraft({ data: { draft: stamped } });
  } catch {
    /* stay local */
  }
}
