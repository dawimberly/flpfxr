/** Public canonical origin. www and plain HTTP should 301 here. */
export const CANONICAL_ORIGIN = "https://theflipfixer.com";

const PRODUCTION_HOSTS = new Set(["theflipfixer.com", "www.theflipfixer.com"]);

function firstToken(value: string | null | undefined): string {
  return (value ?? "").split(",")[0]?.trim().toLowerCase() ?? "";
}

function hostnameOf(host: string): string {
  if (host.startsWith("[")) return host;
  return host.replace(/:\d+$/, "");
}

/**
 * Location for a 301 to the apex HTTPS origin, or null when the request should
 * stay put.
 *
 * GET and HEAD only. A 301 on POST is replayed as GET by browsers and would
 * drop lead, auth, and Stripe webhook bodies. Those clients should call the
 * apex host directly.
 *
 * Non-production hosts (localhost, preview, Vercel deployment URLs) are left
 * alone so dev and preview keep working.
 */
export function canonicalRedirectTarget(input: {
  method: string;
  host: string | null;
  proto: string | null;
  pathname: string;
  search: string;
}): string | null {
  const method = input.method.toUpperCase();
  if (method !== "GET" && method !== "HEAD") return null;

  const host = hostnameOf(firstToken(input.host));
  if (!PRODUCTION_HOSTS.has(host)) return null;

  const proto = firstToken(input.proto).replace(/:$/, "");
  const onApexHttps = host === "theflipfixer.com" && proto !== "http";
  if (onApexHttps) return null;

  const pathname = input.pathname.startsWith("/") ? input.pathname : `/${input.pathname}`;
  const search = input.search
    ? input.search.startsWith("?")
      ? input.search
      : `?${input.search}`
    : "";
  return `${CANONICAL_ORIGIN}${pathname}${search}`;
}
