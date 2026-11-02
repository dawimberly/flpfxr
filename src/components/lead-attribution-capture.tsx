import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";
import { captureFirstTouchFromWindow } from "@/lib/lead-attribution";

/**
 * Saves the first-party lead-source note for this tab.
 * Session storage only. Nothing here is sent to analytics.
 */
export function LeadAttributionCapture() {
  const locationKey = useRouterState({
    select: (s) => `${s.location.pathname}${s.location.searchStr}`,
  });

  useEffect(() => {
    try {
      captureFirstTouchFromWindow();
    } catch {
      // The note is optional. A storage failure must not affect the page.
    }
  }, [locationKey]);

  return null;
}
