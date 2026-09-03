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
    /* stay local until signed in */
  }
}

export async function deleteJobFromCloud(id: string) {
  try {
    await deleteCloudJob({ data: { id } });
  } catch {
    /* stay local */
  }
}

export async function syncDraftFromCloud(): Promise<EstimateDraft | null> {
  const local = loadDraft();
  try {
    const result = await pullCloudDraft();
    if (!result.ok) return local;
    if (!local) return result.draft;
    if (!result.draft) {
      await pushCloudDraft({ data: { draft: local } }).catch(() => null);
      return local;
    }
    return local;
  } catch {
    return local;
  }
}

export async function pushDraftToCloud(draft: EstimateDraft) {
  saveDraft(draft);
  try {
    await pushCloudDraft({ data: { draft } });
  } catch {
    /* stay local */
  }
}
