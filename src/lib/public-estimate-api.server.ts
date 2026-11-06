import { CANONICAL_ORIGIN } from "./canonical-host.ts";
import { publicPlannerPath } from "./estimate-landing.ts";
import { PRELIMINARY_ESTIMATE_WORDING } from "./public-estimate-display.ts";
import { validatePublicEstimateInput } from "./public-estimate-input.ts";
import {
  COUNTER_MATERIALS, DEFAULT_PROJECT_INPUTS, FLOOR_MATERIALS, PROJECT_SIZES,
  SHOWER_MATERIALS, projectScope, vanityForSize,
  type ProjectInputs, type ProjectService, type ProjectSize,
} from "./public-estimate-options.ts";
import { projectEstimateLeadMessage, projectPlanningEstimate } from "./public-pricing.ts";
import { publicEstimateResult } from "./public-estimate-result.server.ts";

/** PepoChat calls this from its own servers. These headers only help a browser test. */
export const PUBLIC_ESTIMATE_CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type, accept",
  "access-control-max-age": "86400",
} as const;

const SERVICE_ALIASES: Record<string, ProjectService> = {
  kitchen: "kitchen",
  "kitchen remodeling": "kitchen",
  bathroom: "bathroom",
  bath: "bathroom",
  "bathroom remodeling": "bathroom",
  flooring: "flooring",
  floor: "flooring",
  "interior-paint": "interior-paint",
  "interior paint": "interior-paint",
  painting: "interior-paint",
  "exterior-paint": "exterior-paint",
  "exterior paint": "exterior-paint",
  custom: "custom",
  other: "custom",
  handyman: "custom",
};

const FLOOR_ALIASES: Record<string, ProjectInputs["floor"]> = {
  ...Object.fromEntries(FLOOR_MATERIALS.map(row => [row.id, row.id])),
  "luxury vinyl": "lvp",
  "luxury vinyl plank": "lvp",
  "vinyl plank": "lvp",
  vinyl: "lvp",
  "engineered hardwood": "wood",
  hardwood: "wood",
};

const COUNTER_ALIASES: Record<string, ProjectInputs["counter"]> = {
  ...Object.fromEntries(COUNTER_MATERIALS.map(row => [row.id, row.id])),
  "butcher block": "butcher",
};

const SHOWER_ALIASES: Record<string, ProjectInputs["shower"]> = {
  ...Object.fromEntries(SHOWER_MATERIALS.map(row => [row.id, row.id])),
  "ceramic tile": "ceramic",
  "porcelain tile": "porcelain",
  "stone slab": "stone",
};

const NEXT_STEP = "We can schedule a free walkthrough with Jon to confirm the final price.";
const REMOVAL_NOTE = "Existing flooring removal, including old snap-together flooring, is extra and is confirmed on site.";

function invalidEstimate(): Response {
  return json({
    error: "invalid_estimate_input",
    message: "Choose valid project selections and measurements.",
  }, 400);
}

export function withPublicEstimateCors(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(PUBLIC_ESTIMATE_CORS)) headers.set(key, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function json(body: unknown, status = 200): Response {
  const response = Response.json(body, { status, headers: { "cache-control": "no-store" } });
  return withPublicEstimateCors(response);
}

function isBlank(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value !== "string") return false;
  const text = value.trim().toLowerCase();
  return text === "" || text === "n/a" || text === "na" || text === "none" || text === "unknown";
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function field(record: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    if (Object.hasOwn(record, key)) return record[key];
  }
  return undefined;
}

/** Nearest flooring size example. Ties stay with the smaller example. Medium is 400 sq ft today. */
function deriveFlooringSize(roomSqft: number): ProjectSize {
  let best: ProjectSize = "Medium";
  let bestDistance = Infinity;
  for (const size of PROJECT_SIZES) {
    const sqft = projectScope("flooring", size)?.floor;
    if (sqft == null) continue;
    const distance = Math.abs(sqft - roomSqft);
    if (distance < bestDistance) {
      best = size;
      bestDistance = distance;
    }
  }
  return best;
}

function normalizeService(value: unknown): string {
  if (isBlank(value)) return "";
  const token = text(value);
  return SERVICE_ALIASES[token] ?? (typeof value === "string" ? value.trim() : "");
}

function normalizeSize(value: unknown, service: string, roomSqft: number | undefined): string {
  const token = text(value);
  if (token === "small" || token === "medium" || token === "large") {
    return token.charAt(0).toUpperCase() + token.slice(1);
  }
  if (!isBlank(value) && value != null) return typeof value === "string" ? value.trim() : String(value);
  if (service === "flooring" && roomSqft != null) return deriveFlooringSize(roomSqft);
  return "Medium";
}

function normalizeChoice<T extends string>(value: unknown, aliases: Record<string, T>, fallback: T): T | string {
  if (isBlank(value)) return fallback;
  const token = text(value);
  if (aliases[token]) return aliases[token];
  return typeof value === "string" ? value.trim() : String(value);
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean | unknown {
  if (isBlank(value)) return fallback;
  if (typeof value === "boolean") return value;
  const token = text(value);
  if (token === "true" || token === "yes" || token === "1") return true;
  if (token === "false" || token === "no" || token === "0") return false;
  return value;
}

function normalizeCoats(value: unknown): 1 | 2 | unknown {
  if (isBlank(value)) return 1;
  if (value === 1 || value === 2) return value;
  const token = text(value);
  if (token === "1" || token === "one") return 1;
  if (token === "2" || token === "two") return 2;
  return value;
}

function normalizeMoney(value: unknown, fallback: number): number | unknown {
  if (isBlank(value)) return fallback;
  if (typeof value === "number") return value;
  if (typeof value !== "string") return value;
  const token = value.trim().replace(/[$,]/g, "");
  if (!/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(token)) return value;
  return Number(token);
}

/** Blank means "not measured". A real zero is kept so flooring validation can reject it. */
function normalizeArea(value: unknown): number | undefined | unknown {
  if (isBlank(value)) return undefined;
  if (typeof value === "number") return Number.isFinite(value) ? value : value;
  if (typeof value !== "string") return value;
  const token = value.trim().toLowerCase().replace(/,/g, "");
  const match = token.match(/^(\d+(?:\.\d+)?)(?:\s*(?:sq\.?\s*ft\.?|sqft|square feet|sf))?$/);
  if (!match) return value;
  return Number(match[1]);
}

/**
 * Fill planner defaults and accept the text PepoChat collects.
 * The returned object is then checked with validatePublicEstimateInput.
 */
export function normalizePublicEstimateBody(data: unknown): unknown {
  if (!data || typeof data !== "object" || Array.isArray(data)) return data;
  const record = data as Record<string, unknown>;
  const service = normalizeService(field(record, "service"));
  const roomSqft = normalizeArea(field(record, "roomSqft", "room_sqft"));
  const floorSqft = normalizeArea(field(record, "floorSqft", "floor_sqft"));
  const showerSqft = normalizeArea(field(record, "showerSqft", "shower_sqft"));
  const counterSqft = normalizeArea(field(record, "counterSqft", "counter_sqft"));
  const floorFallback = service === "bathroom" ? "tile" : DEFAULT_PROJECT_INPUTS.floor;
  const body: Record<string, unknown> = {
    service,
    size: normalizeSize(field(record, "size"), service, typeof roomSqft === "number" ? roomSqft : undefined),
    floor: normalizeChoice(field(record, "floor"), FLOOR_ALIASES, floorFallback),
    counter: normalizeChoice(field(record, "counter"), COUNTER_ALIASES, DEFAULT_PROJECT_INPUTS.counter),
    shower: normalizeChoice(field(record, "shower"), SHOWER_ALIASES, DEFAULT_PROJECT_INPUTS.shower),
    prime: normalizeBoolean(field(record, "prime"), DEFAULT_PROJECT_INPUTS.prime),
    newToilet: normalizeBoolean(field(record, "newToilet", "new_toilet"), DEFAULT_PROJECT_INPUTS.newToilet),
    exteriorCoats: normalizeCoats(field(record, "exteriorCoats", "exterior_coats")),
    delivery: normalizeMoney(field(record, "delivery"), 0),
    specialist: normalizeMoney(field(record, "specialist"), 0),
  };
  if (roomSqft !== undefined) body.roomSqft = roomSqft;
  if (floorSqft !== undefined) body.floorSqft = floorSqft;
  if (showerSqft !== undefined) body.showerSqft = showerSqft;
  if (counterSqft !== undefined) body.counterSqft = counterSqft;
  const boxes = field(record, "cabinetBoxes", "cabinet_boxes");
  const xl = field(record, "xlFridgeBoxes", "xl_fridge_boxes");
  if (!isBlank(boxes)) body.cabinetBoxes = typeof boxes === "string" && /^\d+$/.test(boxes.trim()) ? Number(boxes) : boxes;
  if (!isBlank(xl)) body.xlFridgeBoxes = typeof xl === "string" && /^\d+$/.test(xl.trim()) ? Number(xl) : xl;
  const vanity = field(record, "vanity");
  if (typeof vanity === "string" && vanity.trim()) body.vanity = vanity.trim();
  else if (service === "bathroom") body.vanity = vanityForSize(body.size === "Small" || body.size === "Large" ? body.size : "Medium");
  return body;
}

export function visitorPublicEstimate(input: ProjectInputs) {
  const priced = publicEstimateResult(input);
  const built = projectPlanningEstimate(input);
  const plannerUrl = new URL(publicPlannerPath(input), CANONICAL_ORIGIN).toString();
  if (!priced || !built) {
    return {
      ok: true as const,
      preliminary: true as const,
      total: null,
      low: null,
      high: null,
      leadMessage: projectEstimateLeadMessage(input),
      disclaimer: PRELIMINARY_ESTIMATE_WORDING,
      exclusions: null,
      removalNote: null,
      nextStep: NEXT_STEP,
      plannerUrl,
    };
  }
  const removalNote = input.service === "flooring" ? REMOVAL_NOTE : null;
  return {
    ok: true as const,
    preliminary: true as const,
    total: priced.total,
    low: built.low,
    high: built.high,
    leadMessage: priced.leadMessage,
    disclaimer: PRELIMINARY_ESTIMATE_WORDING,
    exclusions: removalNote ? `${built.scope.exclusions} ${removalNote}` : built.scope.exclusions,
    removalNote,
    nextStep: NEXT_STEP,
    plannerUrl,
  };
}

export function handlePublicEstimateOptions(): Response {
  return new Response(null, { status: 204, headers: PUBLIC_ESTIMATE_CORS });
}

export async function handlePublicEstimatePost(request: Request): Promise<Response> {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return invalidEstimate();
  }
  try {
    const input = validatePublicEstimateInput(normalizePublicEstimateBody(payload));
    return json(visitorPublicEstimate(input));
  } catch (err) {
    if (err instanceof Response) return withPublicEstimateCors(err);
    throw err;
  }
}
