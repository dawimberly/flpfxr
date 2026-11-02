import {
  DEFAULT_PROJECT_INPUTS, vanityForSize,
  type ProjectInputs, type ProjectService, type ProjectSize,
} from "./public-estimate-options.ts";

/** Query tokens ads can use. `other` is the public name for the custom project. */
const SERVICE_FROM_QUERY: Record<string, ProjectService> = {
  kitchen: "kitchen",
  bathroom: "bathroom",
  flooring: "flooring",
  "interior-paint": "interior-paint",
  "exterior-paint": "exterior-paint",
  other: "custom",
};

const SIZE_FROM_QUERY: Record<string, ProjectSize> = {
  small: "Small",
  medium: "Medium",
  large: "Large",
};

const HEADLINES: Record<ProjectService, string> = {
  kitchen: "Plan your kitchen remodel.",
  bathroom: "Plan your bathroom remodel.",
  flooring: "Plan your flooring project.",
  "interior-paint": "Plan your interior painting.",
  "exterior-paint": "Plan your exterior painting.",
  custom: "Plan your other project.",
};

export const DEFAULT_ESTIMATE_HEADLINE = "Plan your next project.";
export const ESTIMATE_INTRO = "Choose a project size and materials. The range is a preliminary estimate for the whole job.";

const TRUST_ORDER = ["San Antonio", "Boerne", "Alamo Heights"];

export type EstimateLanding = {
  service: ProjectService;
  size: ProjectSize;
  /** True only when the URL named a known project. Invalid values do not count. */
  explicitService: boolean;
  explicitSize: boolean;
};

export function serviceToQuery(service: ProjectService): string {
  return service === "custom" ? "other" : service;
}

export function headlineFor(service: ProjectService): string {
  return HEADLINES[service];
}

function asRecord(search: URLSearchParams | Record<string, unknown>): Record<string, unknown> {
  if (search instanceof URLSearchParams) return Object.fromEntries(search.entries());
  return search;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

/** Known project and size. Anything else falls back to kitchen / medium. */
export function estimateLandingFromSearch(search: URLSearchParams | Record<string, unknown>): EstimateLanding {
  const raw = asRecord(search);
  const service = SERVICE_FROM_QUERY[text(raw.service)];
  const size = SIZE_FROM_QUERY[text(raw.size)];
  return {
    service: service ?? "kitchen",
    size: size ?? "Medium",
    explicitService: Boolean(service),
    explicitSize: Boolean(size),
  };
}

export function inputsFromLanding(landing: EstimateLanding): ProjectInputs {
  const bathroom = landing.service === "bathroom";
  return {
    ...DEFAULT_PROJECT_INPUTS,
    service: landing.service,
    size: landing.size,
    floor: bathroom ? "tile" : "lvp",
    vanity: bathroom ? vanityForSize(landing.size) : DEFAULT_PROJECT_INPUTS.vanity,
  };
}

/**
 * Search the route keeps. Service and size are canonical when valid, and every
 * other string — including ad click ids — is copied unchanged.
 */
export function estimateRouteSearch(search: Record<string, unknown>): Record<string, string> {
  const landing = estimateLandingFromSearch(search);
  const next: Record<string, string> = {};
  for (const [key, value] of Object.entries(search)) {
    if (key === "service" || key === "size") continue;
    if (typeof value === "string" && value) next[key] = value;
  }
  if (landing.explicitService) next.service = serviceToQuery(landing.service);
  if (landing.explicitSize) next.size = landing.size.toLowerCase();
  return next;
}

/** Path and query for history.replaceState. Ad params stay as they are. */
export function estimateLandingUrl(href: string, service: ProjectService, size: ProjectSize): string {
  const url = new URL(href, "https://theflipfixer.com");
  url.searchParams.set("service", serviceToQuery(service));
  url.searchParams.set("size", size.toLowerCase());
  return `${url.pathname}${url.search}${url.hash}`;
}

/** gclid, gbraid, wbraid, and any utm_* value, copied without rewriting. */
export function retainedAdSearch(search: URLSearchParams | Record<string, unknown>): Record<string, string> {
  const entries = search instanceof URLSearchParams
    ? [...search.entries()]
    : Object.entries(asRecord(search)).flatMap(([key, value]) => typeof value === "string" ? [[key, value] as const] : []);
  const out: Record<string, string> = {};
  for (const [key, value] of entries) {
    if (!value) continue;
    if (key === "gclid" || key === "gbraid" || key === "wbraid" || key.startsWith("utm_")) out[key] = value;
  }
  return out;
}

export function estimateHandoffSearch<S extends string>(
  current: URLSearchParams | Record<string, unknown>,
  handoff: { service: S; side: "interior" | "exterior" },
) {
  const ads = retainedAdSearch(current);
  return {
    service: handoff.service,
    side: handoff.side,
    origin: "estimate" as const,
    ...(ads.gclid ? { gclid: ads.gclid } : {}),
    ...(ads.gbraid ? { gbraid: ads.gbraid } : {}),
    ...(ads.wbraid ? { wbraid: ads.wbraid } : {}),
    ...(ads.utm_source ? { utm_source: ads.utm_source } : {}),
    ...(ads.utm_medium ? { utm_medium: ads.utm_medium } : {}),
    ...(ads.utm_campaign ? { utm_campaign: ads.utm_campaign } : {}),
    ...(ads.utm_term ? { utm_term: ads.utm_term } : {}),
    ...(ads.utm_content ? { utm_content: ads.utm_content } : {}),
    ...(ads.utm_id ? { utm_id: ads.utm_id } : {}),
  };
}

/** A few places already listed on the site. No city is added here. */
export function estimateTrustLine(areas: readonly string[]): string {
  const preferred = TRUST_ORDER.filter(name => areas.includes(name));
  const names = preferred.length ? preferred : areas.slice(0, 3);
  if (!names.length) return "";
  return `Serving ${names.join(", ")} and nearby.`;
}
