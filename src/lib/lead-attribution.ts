export type LeadAttribution = {
  gclid?: string; gbraid?: string; wbraid?: string;
  utm_source?: string; utm_medium?: string; utm_campaign?: string; utm_term?: string; utm_content?: string;
  referrer?: string; landing_path?: string; submitting_path?: string; device?: string; heard_from?: string;
};

const KEY = "ff-first-touch-v1";
const keys = ["gclid", "gbraid", "wbraid", "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const;

export function sourceLabel(data: LeadAttribution): string {
  if (data.gclid || data.gbraid || data.wbraid) return "Google Ads";
  const utm = (data.utm_source || "").trim().toLowerCase().replace(/[\s_-]+/g, " ");
  const profileMarker = (value: string) => /^(gbp|gmb|google business profile|google business|google maps)$/.test(value.trim().toLowerCase().replace(/[\s_-]+/g, " "));
  if (profileMarker(utm) || (utm === "google" && [data.utm_medium || "", data.utm_campaign || ""].some(profileMarker))) return "Business Profile";
  const host = (data.referrer || "").trim().toLowerCase();
  if (/^(?:www\.)?google\.(?:com|[a-z]{2,3}|co\.[a-z]{2}|com\.[a-z]{2})$/.test(host)) return "Google organic";
  return host ? "Referral: " + host : "Direct/unknown";
}

export function captureFirstTouch(): LeadAttribution {
  if (typeof window === "undefined") return {};
  try {
    const existing = sessionStorage.getItem(KEY);
    if (existing !== null) return JSON.parse(existing) as LeadAttribution;
    const params = new URLSearchParams(window.location.search);
    const data: LeadAttribution = { landing_path: window.location.pathname };
    for (const key of keys) { const value = params.get(key)?.trim(); if (value) data[key] = value.slice(0, 500); }
    try { if (document.referrer) data.referrer = new URL(document.referrer).hostname; } catch { /* Invalid referrer. */ }
    sessionStorage.setItem(KEY, JSON.stringify(data));
    return data;
  } catch { return {}; }
}

export function submissionAttribution(): LeadAttribution {
  const first = captureFirstTouch();
  if (typeof window === "undefined") return first;
  const width = window.innerWidth;
  const ua = navigator.userAgent;
  const device = /iPad|Tablet/i.test(ua) || (width >= 768 && width < 1024) ? "tablet" : /Mobile|iPhone|Android/i.test(ua) || width < 768 ? "mobile" : "desktop";
  return { ...first, submitting_path: window.location.pathname, device };
}
