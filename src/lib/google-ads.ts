/** GA4 measurement ID — primary gtag.js loader. */
export const GA4_MEASUREMENT_ID = "G-548WLW4MEK";

/** Google Ads destination tag for The Flip Fixer (account 514-833-8223). */
export const GOOGLE_ADS_ID = "AW-18251288464";

/** Conversion labels from Ads → Submit lead form / Click to call. */
export const GOOGLE_ADS_LEAD_SEND_TO =
  "AW-18251288464/XOc8CJqR8-8cEJCf8v5D";
export const GOOGLE_ADS_PHONE_SEND_TO =
  "AW-18251288464/8MtLCJ2R8-8cEJCf8v5D";

declare global {
  interface Window {
    dataLayer: IArguments[];
    gtag: (...args: unknown[]) => void;
  }
}

function ensureGtag() {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer || [];
  if (typeof window.gtag !== "function") {
    window.gtag = function gtag() {
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer.push(arguments);
    };
  }
}

export function gtag(...args: unknown[]) {
  if (typeof window === "undefined") return;
  ensureGtag();
  window.gtag(...args);
}

export function pagePathFromLocation(pathname: string, search = ""): string {
  const path = pathname || "/";
  if (!search || search === "?") return path;
  return `${path}${search.startsWith("?") ? search : `?${search}`}`;
}

function oncePerSession(key: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (sessionStorage.getItem(key)) return false;
    sessionStorage.setItem(key, "1");
  } catch {
    // sessionStorage blocked — still fire once this load
  }
  return true;
}

/** SPA navigations do not reload the document, so config's automatic page_view is not enough. */
export function trackPageView(path: string, title?: string) {
  if (typeof window === "undefined") return;
  gtag("event", "page_view", {
    page_path: path,
    page_title: title || document.title,
    page_location: window.location.href,
  });
}

export function trackFormStart() {
  if (!oncePerSession("ff-form-start")) return;
  gtag("event", "form_start", {
    form_id: "lead",
    form_name: "contact",
  });
}

export type LinkLocation =
  | "header" | "mobile_bar" | "hero" | "footer" | "cta_band"
  | "contact_page" | "lead_form" | "community" | "other";

export type ToolName = "roof_quote" | "quote_estimator";

/** Path only (no query string), so nothing user-typed can end up in an event. */
function currentPath(): string {
  if (typeof window === "undefined") return "";
  return window.location?.pathname || "/";
}

/** Short, fixed-vocabulary strings only. Never pass names, emails, phones, or addresses. */
function cleanParam(value: string | undefined, fallback: string): string {
  const v = (value ?? "").trim().slice(0, 40);
  return v || fallback;
}

/** Fire once per browser session so refresh doesn't double-count. */
export function trackContactFormSubmit(opts?: { leadSource?: string; service?: string }) {
  if (!oncePerSession("ff-ads-lead")) return;
  gtag("event", "generate_lead", {
    currency: "USD",
    value: 1.0,
    lead_source: cleanParam(opts?.leadSource, "contact_form"),
    service: cleanParam(opts?.service, "unspecified"),
    page_path: currentPath(),
  });
  gtag("event", "conversion", { send_to: GOOGLE_ADS_LEAD_SEND_TO, value: 1.0, currency: "USD" });
}

export function trackPhoneClick(linkLocation: LinkLocation = "other") {
  if (typeof window === "undefined") return;
  gtag("event", "phone_click", {
    link_url: "tel:+12104369117",
    link_location: linkLocation,
    page_path: currentPath(),
  });
  gtag("event", "conversion", { send_to: GOOGLE_ADS_PHONE_SEND_TO, value: 1.0, currency: "USD" });
}

export function trackSmsClick(linkLocation: LinkLocation = "other") {
  if (typeof window === "undefined") return;
  gtag("event", "sms_click", {
    link_url: "sms:+12104369117",
    link_location: linkLocation,
    page_path: currentPath(),
  });
}

/** tool_start / tool_complete, once per browser session per tool and step. */
export function trackToolUse(tool: ToolName, step: "start" | "complete") {
  if (!oncePerSession(`ff-tool-${tool}-${step}`)) return;
  gtag("event", `tool_${step}`, { tool_name: tool, page_path: currentPath() });
}
