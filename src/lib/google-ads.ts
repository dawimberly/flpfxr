/** GA4 measurement ID — primary gtag.js loader. */
export const GA4_MEASUREMENT_ID = "G-548WLW4MEK";

/** Google Ads destination tag for The Flip Fixer (account 514-833-8223). */
export const GOOGLE_ADS_ID = "AW-18251288464";

/**
 * Primary Ads conversions. Anything else (homepage view, Contact visit,
 * click-to-call, text) must not be sent — Tag Manager was counting those too.
 * Click and text stay in GA4 only. Calls count when they last 60 seconds.
 */
export const GOOGLE_ADS_LEAD_SEND_TO =
  "AW-18251288464/XOc8CJqR8-8cEJCf8v5D";

/** "Calls from website (60s+)" — Google forwarding number, counts answered calls. */
export const GOOGLE_ADS_WEBSITE_CALL_SEND_TO =
  "AW-18251288464/9UoFCLGyuY4dEJCf8v5D";

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

/** Page views go to GA4 and the Ads tag, never to a conversion label. */
const PAGE_VIEW_DESTINATIONS = [GA4_MEASUREMENT_ID, GOOGLE_ADS_ID] as const;

function ga4Event(name: string, params: Record<string, unknown> = {}) {
  gtag("event", name, { ...params, send_to: GA4_MEASUREMENT_ID });
}

/** SPA navigations do not reload the document, so config's automatic page_view is not enough. */
export function trackPageView(path: string, title?: string) {
  if (typeof window === "undefined") return;
  const payload = {
    page_path: path,
    page_title: title || document.title,
    page_location: window.location.href,
  };
  for (const sendTo of PAGE_VIEW_DESTINATIONS) {
    gtag("event", "page_view", { ...payload, send_to: sendTo });
  }
}

export function trackFormStart() {
  if (!oncePerSession("ff-form-start")) return;
  ga4Event("form_start", {
    form_id: "lead",
    form_name: "contact",
  });
}

/** Normalized user data for Google Ads Enhanced Conversions (gtag hashes server-side). */
export type EnhancedUserData = {
  email?: string;
  phone?: string;
  name?: string;
};

/**
 * Set first-party user data before a conversion event so Google can match
 * leads more accurately (Enhanced Conversions). Pass plain text; gtag hashes.
 */
export function setEnhancedUserData(data: EnhancedUserData) {
  if (typeof window === "undefined") return;

  const userData: Record<string, unknown> = {};

  const email = data.email?.trim().toLowerCase();
  if (email && email.includes("@")) {
    userData.email = email;
  }

  if (data.phone) {
    const digits = data.phone.replace(/\D/g, "");
    if (digits.length === 10) {
      userData.phone_number = `+1${digits}`;
    } else if (digits.length === 11 && digits.startsWith("1")) {
      userData.phone_number = `+${digits}`;
    } else if (digits.length > 10) {
      userData.phone_number = `+${digits}`;
    }
  }

  if (data.name?.trim()) {
    const parts = data.name.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (parts.length > 0) {
      const address: Record<string, string> = { first_name: parts[0] };
      if (parts.length > 1) {
        address.last_name = parts.slice(1).join(" ");
      }
      userData.address = address;
    }
  }

  if (Object.keys(userData).length === 0) return;

  gtag("set", "user_data", userData);
}

const LEAD_PENDING_KEY = "ff-ads-lead-pending";

/**
 * Native FormSubmit navigates away before gtag can send. Mark the submit so
 * the thank-you page can fire after the saved draft is back in memory.
 * Opening an old `?sent=1` link does not set this flag.
 */
export function markLeadSubmitPending(nextPath = "/contact") {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(LEAD_PENDING_KEY, JSON.stringify({ nextPath, createdAt: Date.now() }));
  } catch {
    // private mode — the ajax success path still counts in this document
  }
}

export function consumePendingLeadSubmit(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const stored = sessionStorage.getItem(LEAD_PENDING_KEY);
    if (!stored) return false;
    sessionStorage.removeItem(LEAD_PENDING_KEY);
    const pending = JSON.parse(stored) as { nextPath?: string; createdAt?: number };
    const current = new URL(window.location.href);
    const age = Date.now() - (pending.createdAt ?? 0);
    return current.pathname === pending.nextPath &&
      current.searchParams.get("sent") === "1" && age >= 0 && age < 10 * 60 * 1000;
  } catch {
    return false;
  }
}

/** Fire once per browser session so refresh doesn't double-count. */
export function trackContactFormSubmit(userData?: EnhancedUserData) {
  if (!oncePerSession("ff-ads-lead")) return;

  if (userData) {
    setEnhancedUserData(userData);
  }

  ga4Event("generate_lead", {
    currency: "USD",
    value: 1.0,
  });
  gtag("event", "conversion", {
    send_to: GOOGLE_ADS_LEAD_SEND_TO,
    value: 1.0,
    currency: "USD",
  });
}

/** GA4 only. A tap is not an Ads conversion; the 60s call tag counts answered calls. */
export function trackPhoneClick() {
  if (typeof window === "undefined") return;
  ga4Event("click", {
    link_url: "tel:+12104369117",
    link_type: "tel",
    outbound: false,
  });
}

/** GA4 only. Texting is not an Ads conversion. */
export function trackSmsClick() {
  if (typeof window === "undefined") return;
  ga4Event("click", {
    link_url: "sms:+12104369117",
    link_type: "sms",
    outbound: false,
  });
}
