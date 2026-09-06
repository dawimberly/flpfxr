/** Google Ads destination tag for The Flip Fixer (account 514-833-8223). */
export const GOOGLE_ADS_ID = "AW-18251288464";

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
  // Named events for Ads Goals → Google tag → Event matching.
  gtag("event", "generate_lead", {
    currency: "USD",
    value: 1,
  });
  gtag("event", "conversion", {
    send_to: GOOGLE_ADS_ID,
  });
}

export function trackPhoneClick() {
  if (typeof window === "undefined") return;
  gtag("event", "phone_call_lead");
  gtag("event", "conversion", {
    send_to: GOOGLE_ADS_ID,
  });
}
