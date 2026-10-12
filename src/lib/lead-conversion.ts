/**
 * Form → Ads lead conversion helpers.
 *
 * Primary Ads action: AW-18251288464/XOc8CJqR8-8cEJCf8v5D
 * Count only after FormSubmit accepts (ajax), or after a native redirect that
 * this submit marked pending. A bare ?sent=1 visit must not count.
 */

export const LEAD_PENDING_KEY = "ff-ads-lead-pending";
export const LEAD_PENDING_MAX_AGE_MS = 10 * 60 * 1000;

export type LeadPending = {
  nextPath: string;
  createdAt: number;
};

export function normalizeLeadPath(path: string): string {
  if (!path) return "/";
  const bare = path.split("?", 1)[0]?.split("#", 1)[0] || "/";
  if (bare.length > 1 && bare.endsWith("/")) return bare.slice(0, -1) || "/";
  return bare || "/";
}

export function buildLeadPending(nextPath: string, createdAt = Date.now()): LeadPending {
  return { nextPath: normalizeLeadPath(nextPath), createdAt };
}

export function serializeLeadPending(pending: LeadPending): string {
  return JSON.stringify(pending);
}

export function parseLeadPending(raw: string | null | undefined): LeadPending | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { nextPath?: string; createdAt?: number };
    if (typeof parsed.nextPath !== "string" || typeof parsed.createdAt !== "number") {
      return null;
    }
    return {
      nextPath: normalizeLeadPath(parsed.nextPath),
      createdAt: parsed.createdAt,
    };
  } catch {
    return null;
  }
}

/**
 * Decide whether a thank-you URL may fire the Ads lead conversion.
 * Does not mutate storage — caller removes the pending record only on match.
 */
export function canCountLeadThankYou(args: {
  pending: LeadPending | null;
  pathname: string;
  search: string;
  now?: number;
}): boolean {
  const { pending, pathname, search } = args;
  const now = args.now ?? Date.now();
  if (!pending) return false;
  const params = new URLSearchParams(
    search.startsWith("?") ? search.slice(1) : search,
  );
  if (params.get("sent") !== "1") return false;
  if (normalizeLeadPath(pathname) !== pending.nextPath) return false;
  const age = now - pending.createdAt;
  return age >= 0 && age < LEAD_PENDING_MAX_AGE_MS;
}

/** Explicit FormSubmit acceptance only — empty 2xx bodies do not count. */
export function isAcceptedFormSubmit(result: {
  ok: boolean;
  needsConfirm: boolean;
}): boolean {
  return result.ok && !result.needsConfirm;
}
