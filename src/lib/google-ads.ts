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

/** Fire once per browser session so refresh doesn't double-count. */
export function trackContactFormSubmit() {
  if (typeof window === "undefined") return;
  const key = "ff-ads-lead";
  try {
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
  } catch {
    // sessionStorage blocked — still fire once this load
  }
  gtag("event", "conversion", {
    send_to: GOOGLE_ADS_LEAD_SEND_TO,
    value: 1.0,
    currency: "USD",
  });
}

export function trackPhoneClick() {
  if (typeof window === "undefined") return;
  gtag("event", "conversion", {
    send_to: GOOGLE_ADS_PHONE_SEND_TO,
    value: 1.0,
    currency: "USD",
  });
}
