import { useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";

const PUBLIC_CHAT_PATHS = new Set([
  "/", "/about", "/bathroom", "/contact", "/estimate", "/gallery",
  "/kitchen", "/northville", "/services", "/testimonials",
]);

type WidgetOptions = {
  organizationId: string;
  position: "bottom-left";
  preload: false;
};

export function PepoChat() {
  const organizationId = import.meta.env.VITE_PEPOCHAT_ORGANIZATION_ID?.trim();
  const enabled = useRouterState({
    select: (state) => PUBLIC_CHAT_PATHS.has(state.location.pathname.replace(/\/+$/, "") || "/"),
  });

  useEffect(() => {
    if (!organizationId || !enabled) return;

    const host = window as Window & {
      EchoWidget?: { init: (options: WidgetOptions) => void; destroy: () => void };
    };
    const options: WidgetOptions = { organizationId, position: "bottom-left", preload: false };
    const script = document.createElement("script");

    if (host.EchoWidget) {
      host.EchoWidget.init(options);
    } else {
      script.src = "https://widget.pepochat.com/widget.js";
      script.async = true;
      script.dataset.organizationId = organizationId;
      script.dataset.position = options.position;
      script.dataset.preload = String(options.preload);
      document.body.appendChild(script);
    }

    return () => {
      script.remove();
      host.EchoWidget?.destroy();
    };
  }, [enabled, organizationId]);

  return null;
}
