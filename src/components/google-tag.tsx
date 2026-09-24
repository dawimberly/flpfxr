import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";
import {
  GA4_MEASUREMENT_ID,
  GOOGLE_ADS_ID,
  GOOGLE_ADS_PHONE_SEND_TO,
  gtag,
  pagePathFromLocation,
  trackPageView,
} from "@/lib/google-ads";
import { captureAdClickIds } from "@/lib/formsubmit";

const SCRIPT_ID = "google-gtag";

/**
 * Single gtag install for the whole SPA (root layout only).
 * Loads once: GA4 G-548WLW4MEK + Google Ads AW-18251288464.
 * Page views fire on every route change — this app does not reload the document.
 */
export function GoogleTag() {
  const path = useRouterState({
    select: (s) =>
      pagePathFromLocation(s.location.pathname, s.location.searchStr),
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    gtag("js", new Date());
    gtag("config", GA4_MEASUREMENT_ID, { send_page_view: false });
    gtag("config", GOOGLE_ADS_ID, { send_page_view: false });
    gtag("config", GOOGLE_ADS_PHONE_SEND_TO, {
      phone_conversion_number: "(210) 436-9117",
    });

    if (!document.getElementById(SCRIPT_ID)) {
      const script = document.createElement("script");
      script.id = SCRIPT_ID;
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${GA4_MEASUREMENT_ID}`;
      document.head.appendChild(script);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    captureAdClickIds();
    trackPageView(path, document.title);
  }, [path]);

  return null;
}
