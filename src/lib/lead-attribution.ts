/**
 * First-party lead-source note, adapted from the lead-attribution starter.
 * Session storage only (no new cookies, no analytics calls).
 * The server re-checks every field. A failure here must not block the form.
 */
import { SITE } from "./site.ts";

/** Site-scoped version of the starter key `lead-attribution:first-touch:v1`. */
export const STORAGE_KEY = "ff-lead-attribution:first-touch:v1";

export const HEARD_FROM_OPTIONS = [
  "Google search",
  "Google Ads",
  "Google Maps / Business Profile",
  "Referral from friend/family",
  "Past customer",
  "Social media",
  "Other",
] as const;

export const FIXED_SOURCE_LABELS = [
  "Google Ads",
  "Business Profile",
  "Google organic",
  "Direct/unknown",
] as const;

const CLICK_KEYS = ["gclid", "gbraid", "wbraid"] as const;
const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
] as const;
const FIRST_TOUCH_KEYS = [...CLICK_KEYS, ...UTM_KEYS, "referrer", "landing_path"] as const;

/** Starter bound: trim, flatten line breaks, and cap length. */
const BOUND = 500;
const TOKEN_RE = /^[A-Za-z0-9._~+-]+$/;
const UTM_RE = /^[A-Za-z0-9][A-Za-z0-9 ._+~-]*$/;
const DEVICES = new Set(["mobile", "tablet", "desktop"]);

/**
 * Starter Business Profile markers, after lowercasing and turning
 * spaces, underscores, and hyphens into single spaces.
 * utm_term and utm_content are not consulted. "google my business"
 * does not match this list.
 */
const BUSINESS_PROFILE_MARKERS = new Set([
  "gbp",
  "gmb",
  "google business profile",
  "google business",
  "google maps",
]);

/** Starter Google organic host check. Subdomains such as maps.google.com do not match. */
const GOOGLE_ORGANIC_HOST =
  /^(?:www\.)?google\.(?:com|[a-z]{2,3}|co\.[a-z]{2}|com\.[a-z]{2})$/;

const LEGACY_KEYS = [
  "gclid",
  "gbraid",
  "wbraid",
  "utm_source",
  "utm_campaign",
  "utm_medium",
] as const;

export type LeadAttribution = {
  gclid?: string;
  gbraid?: string;
  wbraid?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  referrer?: string;
  landing_path?: string;
  page_url?: string;
  submitting_path?: string;
  device?: string;
  heard_from?: string;
  source_label?: string;
};

type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

export type CaptureLocation = {
  pathname?: string;
  hostname?: string;
  search?: string;
};

export type CaptureEnv = {
  location?: CaptureLocation;
  referrer?: string;
  storage?: StorageLike | null;
};

let memory: Record<string, string> | undefined;

export function resetMemoryForTests(): void {
  memory = undefined;
}

function withoutControls(value: string): string {
  let out = "";
  for (const ch of value) {
    const code = ch.codePointAt(0) ?? 0;
    out += code <= 31 || code === 127 ? " " : ch;
  }
  return out;
}

function bound(value: unknown): string {
  if (typeof value !== "string") return "";
  return withoutControls(value).replace(/\s+/g, " ").trim().slice(0, BOUND);
}

export function sanitizeToken(value: unknown): string {
  const cleaned = bound(value);
  return TOKEN_RE.test(cleaned) ? cleaned : "";
}

export function sanitizeUtm(value: unknown): string {
  const cleaned = bound(value);
  return UTM_RE.test(cleaned) ? cleaned : "";
}

export function sanitizeDomain(value: unknown): string {
  const cleaned = bound(value).toLowerCase().replace(/\.$/, "");
  if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/.test(cleaned)) {
    return "";
  }
  return cleaned;
}

export function sanitizePath(value: unknown): string {
  let cleaned = bound(value);
  if (!cleaned) return "";
  if (/^https?:\/\//i.test(cleaned)) {
    try {
      cleaned = new URL(cleaned).pathname;
    } catch {
      return "";
    }
  }
  const pathOnly = cleaned.split(/[?#]/, 1)[0];
  if (!pathOnly.startsWith("/")) return "";
  if (pathOnly.includes("\\") || pathOnly.includes("..") || pathOnly.includes("//")) return "";
  if (!/^\/[A-Za-z0-9._~/-]*$/.test(pathOnly)) return "";
  return pathOnly.slice(0, BOUND);
}

export function sanitizeDevice(value: unknown): string {
  const cleaned = bound(value).toLowerCase();
  return DEVICES.has(cleaned) ? cleaned : "";
}

export function sanitizeHeardFrom(value: unknown): string {
  const cleaned = bound(value);
  return (HEARD_FROM_OPTIONS as readonly string[]).includes(cleaned) ? cleaned : "";
}

export function siteHosts(): string[] {
  try {
    const host = new URL(SITE.url).hostname.toLowerCase().replace(/\.$/, "");
    const apex = host.startsWith("www.") ? host.slice(4) : host;
    return [host, apex, `www.${apex}`];
  } catch {
    return [];
  }
}

export function isOwnHost(domain: string): boolean {
  return siteHosts().includes(domain.toLowerCase().replace(/\.$/, ""));
}

export function isGoogleOrganicHost(domain: string): boolean {
  return GOOGLE_ORGANIC_HOST.test(domain.toLowerCase().replace(/\.$/, ""));
}

function normMarker(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, " ");
}

function isBusinessProfileMarker(value: string): boolean {
  return BUSINESS_PROFILE_MARKERS.has(normMarker(value));
}

/**
 * Starter precedence, after charset checks:
 * click id, then recognized GBP UTMs, then a Google host referrer,
 * then any other referrer, otherwise Direct/unknown.
 * This site's own host is treated as no referrer.
 */
export function sourceLabel(data: LeadAttribution = {}): string {
  if (
    sanitizeToken(data.gclid ?? "") ||
    sanitizeToken(data.gbraid ?? "") ||
    sanitizeToken(data.wbraid ?? "")
  ) {
    return "Google Ads";
  }

  const source = normMarker(sanitizeUtm(data.utm_source ?? ""));
  const campaign = normMarker(sanitizeUtm(data.utm_campaign ?? ""));
  const medium = normMarker(sanitizeUtm(data.utm_medium ?? ""));
  if (
    isBusinessProfileMarker(source) ||
    (source === "google" && (isBusinessProfileMarker(campaign) || isBusinessProfileMarker(medium)))
  ) {
    return "Business Profile";
  }

  const host = sanitizeDomain(data.referrer ?? "");
  if (!host || isOwnHost(host)) return "Direct/unknown";
  if (isGoogleOrganicHost(host)) return "Google organic";
  return `Referral: ${host}`;
}

function assignIf(target: LeadAttribution, key: keyof LeadAttribution, value: string) {
  if (value) target[key] = value;
}

export function sanitizeLeadAttribution(input: unknown): LeadAttribution {
  const rec =
    input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const clean: LeadAttribution = {};
  for (const key of CLICK_KEYS) assignIf(clean, key, sanitizeToken(rec[key]));
  for (const key of UTM_KEYS) assignIf(clean, key, sanitizeUtm(rec[key]));
  const referrer = sanitizeDomain(rec.referrer);
  if (referrer && !isOwnHost(referrer)) assignIf(clean, "referrer", referrer);
  assignIf(clean, "landing_path", sanitizePath(rec.landing_path));
  assignIf(clean, "page_url", sanitizePath(rec.page_url));
  assignIf(clean, "submitting_path", sanitizePath(rec.submitting_path));
  assignIf(clean, "device", sanitizeDevice(rec.device));
  assignIf(clean, "heard_from", sanitizeHeardFrom(rec.heard_from));
  clean.source_label = sourceLabel(clean);
  return clean;
}

export function canonicalizeSourceLabel(label: unknown): string {
  const cleaned = bound(typeof label === "string" ? label : "");
  if ((FIXED_SOURCE_LABELS as readonly string[]).includes(cleaned)) return cleaned;
  const match = /^Referral: ([a-z0-9.-]+)$/.exec(cleaned);
  if (!match) return "Direct/unknown";
  const domain = sanitizeDomain(match[1]);
  if (!domain || domain !== match[1] || isOwnHost(domain) || isGoogleOrganicHost(domain)) {
    return "Direct/unknown";
  }
  return `Referral: ${domain}`;
}

function oneLine(value: string, max: number, fallback: string): string {
  const cleaned = bound(value);
  return (cleaned || fallback).slice(0, max);
}

export function buildAttributionSubject(service: string, source: string, label?: string): string {
  const safeService = oneLine(service, 80, "job");
  const safeSource = oneLine(source, 40, "contact");
  const safeLabel = canonicalizeSourceLabel(label);
  return `${SITE.legalName} — ${safeService} (${safeSource}) [${safeLabel}]`;
}

export function formatLeadSource(input: unknown = {}): string {
  const ad = sanitizeLeadAttribution(input);
  const fields = [
    "gclid",
    "gbraid",
    "wbraid",
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    "referrer",
    "landing_path",
    "submitting_path",
    "device",
  ] as const;
  return [
    "--- Lead source ---",
    `Source: ${ad.source_label || "Direct/unknown"}`,
    `How did you hear about us: ${ad.heard_from || "(not provided)"}`,
    ...fields.map((key) => `${key}: ${ad[key] || "(none)"}`),
  ].join("\n");
}

function referrerHost(referrer: string, currentHost?: string): string {
  if (typeof referrer !== "string" || !referrer || referrer.length > 2000) return "";
  let host = "";
  try {
    host = new URL(referrer).hostname;
  } catch {
    return "";
  }
  const domain = sanitizeDomain(host);
  if (!domain || isOwnHost(domain)) return "";
  const current = (currentHost || "").toLowerCase().replace(/\.$/, "");
  if (current && domain === current) return "";
  return domain;
}

function publicFromUnknown(value: unknown): Record<string, string> {
  const clean = sanitizeLeadAttribution(value);
  const out: Record<string, string> = {};
  for (const key of FIRST_TOUCH_KEYS) {
    const field = clean[key];
    if (field) out[key] = field;
  }
  return out;
}

function readLegacy(storage: StorageLike): Record<string, string> | null {
  const seeded: Record<string, string> = {};
  for (const key of LEGACY_KEYS) {
    const raw = storage.getItem(`ff-${key}`);
    const value = key.startsWith("utm_") ? sanitizeUtm(raw ?? "") : sanitizeToken(raw ?? "");
    if (value) seeded[key] = value;
  }
  return Object.keys(seeded).length ? seeded : null;
}

function buildFromLocation(location?: CaptureLocation, referrer = ""): Record<string, string> {
  const data: Record<string, string> = {};
  const path = sanitizePath(location?.pathname || "/");
  if (path) data.landing_path = path;
  const params = new URLSearchParams((location?.search || "").replace(/^\?/, "").slice(0, 4000));
  for (const key of CLICK_KEYS) {
    const value = sanitizeToken(params.get(key) ?? "");
    if (value) data[key] = value;
  }
  for (const key of UTM_KEYS) {
    const value = sanitizeUtm(params.get(key) ?? "");
    if (value) data[key] = value;
  }
  const host = referrerHost(referrer, location?.hostname);
  if (host) data.referrer = host;
  return data;
}

function remember(data: Record<string, string>, storage?: StorageLike | null) {
  memory = { ...data };
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Blocked storage keeps the in-memory note for this page only.
  }
}

/** First page in this tab wins. Later params do not replace or fill the note. */
export function captureFirstTouch({
  location,
  referrer = "",
  storage = null,
}: CaptureEnv = {}): Record<string, string> {
  try {
    if (storage) {
      let saved: string | null = null;
      try {
        saved = storage.getItem(STORAGE_KEY);
      } catch {
        if (memory) return { ...memory };
        const data = buildFromLocation(location, referrer);
        memory = { ...data };
        return data;
      }

      if (saved != null) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            return publicFromUnknown(parsed);
          }
        } catch {
          // Corrupt note. Capture again below.
        }
      } else {
        try {
          const legacy = readLegacy(storage);
          if (legacy) {
            const data = { ...legacy };
            if (!data.landing_path) {
              const path = sanitizePath(location?.pathname || "/");
              if (path) data.landing_path = path;
            }
            if (!data.referrer) {
              const host = referrerHost(referrer, location?.hostname);
              if (host) data.referrer = host;
            }
            remember(data, storage);
            return { ...data };
          }
        } catch {
          // Legacy keys are optional.
        }
      }
    }
  } catch {
    if (memory) return { ...memory };
  }

  if (memory) return { ...memory };
  const data = buildFromLocation(location, referrer);
  remember(data, storage);
  return { ...data };
}

export function captureFirstTouchFromWindow(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    let storage: StorageLike | null = null;
    try {
      storage = window.sessionStorage;
    } catch {
      storage = null;
    }
    return captureFirstTouch({
      location: window.location,
      referrer: typeof document !== "undefined" ? document.referrer || "" : "",
      storage,
    });
  } catch {
    return {};
  }
}

/** Starter device buckets. Android matches mobile even on a wide screen. */
export function deviceType(width?: number, ua = ""): "mobile" | "tablet" | "desktop" {
  const agent = typeof ua === "string" ? ua.slice(0, BOUND) : "";
  const w = typeof width === "number" && Number.isFinite(width) ? width : Number.NaN;
  if (/iPad|Tablet/i.test(agent) || (w >= 768 && w < 1024)) return "tablet";
  if (/Mobile|iPhone|Android/i.test(agent) || w < 768) return "mobile";
  return "desktop";
}

export function submissionAttribution(
  first: Record<string, string> | null | undefined,
  {
    pathname = "",
    width = 1024,
    userAgent = "",
    heardFrom = "",
  }: { pathname?: string; width?: number; userAgent?: string; heardFrom?: string } = {},
): Record<string, string> {
  const fields = publicFromUnknown(first ?? {});
  const submit = sanitizePath(pathname);
  if (submit) {
    fields.submitting_path = submit;
    fields.page_url = submit;
  }
  fields.device = deviceType(width, userAgent);
  const heard = sanitizeHeardFrom(heardFrom);
  if (heard) fields.heard_from = heard;
  return fields;
}

export function attributionFieldsForSubmit(): Record<string, string> {
  try {
    const first = captureFirstTouchFromWindow();
    if (typeof window === "undefined") return first;
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    return submissionAttribution(first, {
      pathname: window.location.pathname || "/",
      width: window.innerWidth,
      userAgent: ua,
    });
  } catch {
    return {};
  }
}
