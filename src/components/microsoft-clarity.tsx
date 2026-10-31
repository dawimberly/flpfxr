import { useEffect } from "react";

/** Optional, non-blocking Clarity install for all client-side routes. */
export function MicrosoftClarity() {
  useEffect(() => {
    if (location.pathname.startsWith("/estimator") || location.pathname.startsWith("/login")) return;
    const projectId = import.meta.env.VITE_CLARITY_PROJECT_ID?.trim();
    if (!projectId || document.getElementById("microsoft-clarity")) return;

    // Official Clarity queue stub: events are buffered until the async script loads.
    const win = window as Window & { clarity?: (...args: unknown[]) => void };
    const queued: unknown[][] = [];
    win.clarity = win.clarity || Object.assign((...args: unknown[]) => { queued.push(args); }, { q: queued });
    const script = document.createElement("script");
    script.id = "microsoft-clarity";
    script.async = true;
    script.src = `https://www.clarity.ms/tag/${encodeURIComponent(projectId)}`;
    document.head.appendChild(script);
  }, []);
  return null;
}
