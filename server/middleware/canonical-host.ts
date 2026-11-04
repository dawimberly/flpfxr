import { canonicalRedirectTarget } from "../../src/lib/canonical-host.ts";

interface CanonicalEvent {
  url: URL;
  req: { method?: string; headers: Headers };
}

/**
 * Backup for the vercel.json host redirect. Vercel's platform still answers
 * plain HTTP with its own 308 to HTTPS on the same host before project
 * redirects run. This catches www (and http, if the request reaches the app)
 * with a 301 for GET and HEAD.
 */
export default function canonicalHostMiddleware(
  event: CanonicalEvent,
  next: () => unknown,
): unknown {
  const target = canonicalRedirectTarget({
    method: event.req.method ?? "GET",
    host: event.req.headers.get("x-forwarded-host") ?? event.req.headers.get("host"),
    proto: event.req.headers.get("x-forwarded-proto") ?? event.url.protocol,
    pathname: event.url.pathname,
    search: event.url.search,
  });
  if (!target) return next();
  return new Response(null, {
    status: 301,
    headers: {
      Location: target,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
