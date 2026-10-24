import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";
import { setForwardingNumber } from "@/lib/call-number";
import {
  GA4_MEASUREMENT_ID,
  GOOGLE_ADS_ID,
  GOOGLE_ADS_WEBSITE_CALL_SEND_TO,
  gtag,
  canTrackGoogle,
  pagePathFromLocation,
  trackPageView,
} from "@/lib/google-ads";
import { captureAdClickIds } from "@/lib/formsubmit";
import { SITE } from "@/lib/site";

const SCRIPT_ID = "google-gtag";

/**
 * Single gtag install for the whole SPA (root layout only).
 * Loads once: GA4 G-548WLW4MEK + Google Ads AW-18251288464.
 * Page views fire on every route change — this app does not reload the document.
 */
export function GoogleTag() {
  const path = useRouterState({
    select: (s) => pagePathFromLocation(s.location.pathname, s.location.searchStr),
  });

  useEffect(() => {
    if (!canTrackGoogle()) return;

    gtag("js", new Date());
    gtag("config", GA4_MEASUREMENT_ID, { send_page_view: false });
    // Enhanced Conversions for the primary form lead action.
    gtag("config", GOOGLE_ADS_ID, {
      send_page_view: false,
      allow_enhanced_conversions: true,
    });
    gtag("config", GOOGLE_ADS_WEBSITE_CALL_SEND_TO, {
      phone_conversion_number: SITE.phoneDisplay,
      phone_conversion_callback: setForwardingNumber,
      // A page view must not hit this conversion label.
      send_page_view: false,
    });

    if (!document.getElementById(SCRIPT_ID)) {
      const script = document.createElement("script");
      script.id = SCRIPT_ID;
      script.async = true;
      // Load with the Ads ID so the form conversion tag is present even if the
      // GA4 config line is delayed. GA4 is still configured above.
      script.src = `https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ADS_ID}`;
      document.head.appendChild(script);
    }
  }, []);

  useEffect(() => {
    if (!canTrackGoogle()) return;
    // Refresh safe defaults for automatic GA4 events after SPA navigation.
    gtag("config", GA4_MEASUREMENT_ID, { send_page_view: false, update: true });
    captureAdClickIds();
    trackPageView(path, document.title);
  }, [path]);

  return null;
}
