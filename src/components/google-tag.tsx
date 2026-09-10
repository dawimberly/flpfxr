import { useEffect } from "react";
import { GA4_MEASUREMENT_ID, GOOGLE_ADS_ID, gtag } from "@/lib/google-ads";

const SCRIPT_ID = "google-gtag";

/**
 * Single gtag install for the whole SPA (root layout only).
 * Loads once: GA4 G-548WLW4MEK + Google Ads AW-18251288464.
 */
export function GoogleTag() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    gtag("js", new Date());
    gtag("config", GA4_MEASUREMENT_ID);
    gtag("config", GOOGLE_ADS_ID);

    if (!document.getElementById(SCRIPT_ID)) {
      const script = document.createElement("script");
      script.id = SCRIPT_ID;
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${GA4_MEASUREMENT_ID}`;
      document.head.appendChild(script);
    }
  }, []);

  return null;
}
