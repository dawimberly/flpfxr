import { CABINET_FINISHES } from "./cabinets.ts";
import {
  COUNTER_MATERIALS, DEFAULT_PROJECT_INPUTS, FLOOR_MATERIALS, SHOWER_MATERIALS,
  presetAreas, scopeAreaError, vanityForSize,
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
  /** Set only when the URL names a floor this project can use. */
  floor?: ProjectInputs["floor"];
  counter?: ProjectInputs["counter"];
  cabinetFinish?: ProjectInputs["cabinetFinish"];
  shower?: ProjectInputs["shower"];
  /** Measured areas copied only when they sit inside the planner's range. */
  roomSqft?: number;
  floorSqft?: number;
  showerSqft?: number;
  counterSqft?: number;
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

const FLOOR_IDS = FLOOR_MATERIALS.map(row => row.id);
const COUNTER_IDS = COUNTER_MATERIALS.map(row => row.id);
const SHOWER_IDS = SHOWER_MATERIALS.map(row => row.id);
const MEASUREMENT_KEYS = ["floor", "counter", "shower", "cabinetFinish", "roomSqft", "floorSqft", "showerSqft", "counterSqft"];

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  const token = text(value);
  return allowed.find(item => item === token);
}

function queryNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return undefined;
  const token = value.trim().replace(/,/g, "");
  if (!/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(token)) return undefined;
  const number = Number(token);
  return Number.isFinite(number) ? number : undefined;
}

function floorAllowed(service: ProjectService, floor: ProjectInputs["floor"]): boolean {
  if (service === "bathroom") return floor === "tile" || floor === "lvp";
  if (service === "kitchen") return floor !== "carpet";
  return service === "flooring";
}

function measuredFromSearch(service: ProjectService, raw: Record<string, unknown>): Pick<EstimateLanding, "roomSqft" | "floorSqft" | "showerSqft" | "counterSqft"> {
  const roomSqft = queryNumber(raw.roomSqft);
  const floorSqft = queryNumber(raw.floorSqft);
  const showerSqft = queryNumber(raw.showerSqft);
  const counterSqft = queryNumber(raw.counterSqft);
  if (service === "flooring" || service === "interior-paint" || service === "exterior-paint") {
    if (roomSqft != null && !scopeAreaError(service, { roomSqft })) return { roomSqft };
    return {};
  }
  if (service === "bathroom") {
    const areas: Pick<EstimateLanding, "floorSqft" | "showerSqft"> = {};
    if (floorSqft != null) areas.floorSqft = floorSqft;
    if (showerSqft != null) areas.showerSqft = showerSqft;
    if ((areas.floorSqft != null || areas.showerSqft != null) && !scopeAreaError(service, areas)) return areas;
    return {};
  }
  if (service === "kitchen") {
    const areas: Pick<EstimateLanding, "floorSqft" | "counterSqft"> = {};
    if (floorSqft != null) areas.floorSqft = floorSqft;
    if (counterSqft != null) areas.counterSqft = counterSqft;
    if ((areas.floorSqft != null || areas.counterSqft != null) && !scopeAreaError(service, areas)) return areas;
    if (floorSqft != null && !scopeAreaError(service, { floorSqft })) return { floorSqft };
    return {};
  }
  return {};
}

/** Known project and size. Anything else falls back to kitchen / medium. */
export function estimateLandingFromSearch(search: URLSearchParams | Record<string, unknown>): EstimateLanding {
  const raw = asRecord(search);
  const service = SERVICE_FROM_QUERY[text(raw.service)];
  const size = SIZE_FROM_QUERY[text(raw.size)];
  const resolved = service ?? "kitchen";
  const floor = oneOf(raw.floor, FLOOR_IDS);
  const counter = oneOf(raw.counter, COUNTER_IDS);
  const shower = oneOf(raw.shower, SHOWER_IDS);
  const cabinetFinish = oneOf(raw.cabinetFinish, CABINET_FINISHES.map(finish => finish.id));
  return {
    service: resolved,
    size: size ?? "Medium",
    explicitService: Boolean(service),
    explicitSize: Boolean(size),
    ...(floor && floorAllowed(resolved, floor) ? { floor } : {}),
    ...(counter && (resolved === "kitchen" || resolved === "bathroom") ? { counter } : {}),
    ...(shower && resolved === "bathroom" ? { shower } : {}),
    ...(cabinetFinish && resolved === "kitchen" ? { cabinetFinish } : {}),
    ...measuredFromSearch(resolved, raw),
  };
}

export function areasFromLanding(landing: EstimateLanding) {
  const areas = presetAreas(landing.service, landing.size);
  if (landing.service === "flooring" || landing.service === "interior-paint" || landing.service === "exterior-paint") {
    return landing.roomSqft == null ? areas : { ...areas, room: String(landing.roomSqft) };
  }
  if (landing.service === "bathroom") {
    return {
      ...areas,
      ...(landing.floorSqft != null ? { floor: String(landing.floorSqft) } : {}),
      ...(landing.showerSqft != null ? { shower: String(landing.showerSqft) } : {}),
    };
  }
  if (landing.service === "kitchen") {
    return {
      ...areas,
      ...(landing.floorSqft != null ? { floor: String(landing.floorSqft) } : {}),
      ...(landing.counterSqft != null ? { counter: String(landing.counterSqft) } : {}),
    };
  }
  return areas;
}

export function inputsFromLanding(landing: EstimateLanding): ProjectInputs {
  const bathroom = landing.service === "bathroom";
  return {
    ...DEFAULT_PROJECT_INPUTS,
    service: landing.service,
    size: landing.size,
    floor: landing.floor ?? (bathroom ? "tile" : "lvp"),
    counter: landing.counter ?? DEFAULT_PROJECT_INPUTS.counter,
    shower: landing.shower ?? DEFAULT_PROJECT_INPUTS.shower,
    ...(landing.cabinetFinish ? { cabinetFinish: landing.cabinetFinish } : {}),
    vanity: bathroom ? vanityForSize(landing.size) : DEFAULT_PROJECT_INPUTS.vanity,
    ...(landing.roomSqft != null ? { roomSqft: landing.roomSqft } : {}),
    ...(landing.floorSqft != null ? { floorSqft: landing.floorSqft } : {}),
    ...(landing.showerSqft != null ? { showerSqft: landing.showerSqft } : {}),
    ...(landing.counterSqft != null ? { counterSqft: landing.counterSqft } : {}),
  };
}

/** Absolute planner link that reopens the same preliminary estimate. */
export function publicPlannerPath(input: ProjectInputs): string {
  const params = new URLSearchParams();
  params.set("service", serviceToQuery(input.service));
  params.set("size", input.size.toLowerCase());
  if (floorAllowed(input.service, input.floor)) params.set("floor", input.floor);
  if (input.service === "kitchen" || input.service === "bathroom") params.set("counter", input.counter);
  if (input.service === "bathroom") params.set("shower", input.shower);
  if (input.service === "kitchen" && input.cabinetFinish) params.set("cabinetFinish", input.cabinetFinish);
  if (input.roomSqft != null && (input.service === "flooring" || input.service === "interior-paint" || input.service === "exterior-paint")) {
    params.set("roomSqft", String(input.roomSqft));
  }
  if (input.floorSqft != null && (input.service === "kitchen" || input.service === "bathroom")) params.set("floorSqft", String(input.floorSqft));
  if (input.showerSqft != null && input.service === "bathroom") params.set("showerSqft", String(input.showerSqft));
  if (input.counterSqft != null && input.service === "kitchen") params.set("counterSqft", String(input.counterSqft));
  return `/estimate?${params.toString()}`;
}

/**
 * Search the route keeps. Service, size, and planner measurements are canonical
 * when valid. Every other string — including ad click ids — is copied unchanged.
 */
export function estimateRouteSearch(search: Record<string, unknown>): Record<string, string | number> {
  const landing = estimateLandingFromSearch(search);
  const next: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(search)) {
    if (key === "service" || key === "size" || MEASUREMENT_KEYS.includes(key)) continue;
    if (typeof value === "string" && value) next[key] = value;
  }
  if (landing.explicitService) next.service = serviceToQuery(landing.service);
  if (landing.explicitSize) next.size = landing.size.toLowerCase();
  if (landing.floor) next.floor = landing.floor;
  if (landing.counter) next.counter = landing.counter;
  if (landing.shower) next.shower = landing.shower;
  if (landing.cabinetFinish) next.cabinetFinish = landing.cabinetFinish;
  // Keep measurements as numbers. The router JSON-parses an unquoted query
  // number, and writing it back as a string redirects to a quoted value.
  if (landing.roomSqft != null) next.roomSqft = landing.roomSqft;
  if (landing.floorSqft != null) next.floorSqft = landing.floorSqft;
  if (landing.showerSqft != null) next.showerSqft = landing.showerSqft;
  if (landing.counterSqft != null) next.counterSqft = landing.counterSqft;
  return next;
}

/** Path and query for history.replaceState. Ad params stay as they are. */
export function estimateLandingUrl(href: string, service: ProjectService, size: ProjectSize): string {
  const url = new URL(href, "https://theflipfixer.com");
  url.searchParams.set("service", serviceToQuery(service));
  url.searchParams.set("size", size.toLowerCase());
  // A size or project click refills the example areas, so a deep-linked measurement must not stick.
  for (const key of ["roomSqft", "floorSqft", "showerSqft", "counterSqft"]) url.searchParams.delete(key);
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
