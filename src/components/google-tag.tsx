import { useEffect } from "react";
import { GOOGLE_ADS_ID, gtag } from "@/lib/google-ads";

const SCRIPT_ID = "google-ads-gtag";

/** Loads the Google Ads tag once and configures the destination. */
export function GoogleTag() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    gtag("js", new Date());
    gtag("config", GOOGLE_ADS_ID);

    if (!document.getElementById(SCRIPT_ID)) {
      const script = document.createElement("script");
      script.id = SCRIPT_ID;
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ADS_ID}`;
      document.head.appendChild(script);
    }
  }, []);

  return null;
}
