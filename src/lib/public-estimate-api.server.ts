import { CANONICAL_ORIGIN } from "./canonical-host.ts";
import { publicPlannerPath } from "./estimate-landing.ts";
import { PRELIMINARY_ESTIMATE_WORDING } from "./public-estimate-display.ts";
import { validatePublicEstimateInput } from "./public-estimate-input.ts";
import {
  COUNTER_MATERIALS, DEFAULT_PROJECT_INPUTS, FLOOR_MATERIALS, PROJECT_SIZES,
  SHOWER_MATERIALS, projectScope, vanityForSize,
  type ProjectInputs, type ProjectService, type ProjectSize,
} from "./public-estimate-options.ts";
import { actLabel } from "./line-act.ts";
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
const INSTALL_ONLY_NOTE = "This preliminary total is install only on a prepared surface. Floor demolition is not included.";
const RR_NOTE = "This preliminary total is install only. Removing the existing floor, including old snap-together flooring, is extra and is confirmed on site.";
const DETACH_NOTE = "Detach and reattach of fixtures or trim is extra and is confirmed on site.";

/**
 * Good / Better / Best are quality grades of one flooring material.
 * The public planner has one price per material, so every grade uses that price.
 */
export const FLOOR_GRADES = {
  good: "Good",
  better: "Better",
  best: "Best",
} as const;

export type FloorTier = keyof typeof FLOOR_GRADES;
/** Visitor act. `rr` and install-only use the catalog act names; detach is not a priced catalog act. */
export type PublicFloorAct = "rr" | "detach" | "install-only";

export type PublicEstimateContext = {
  act: PublicFloorAct | null;
  existing: string | null;
  tier: FloorTier | null;
};

const TIER_ALIASES: Record<string, FloorTier> = {
  good: "good",
  better: "better",
  best: "best",
};

function normalizeTier(value: unknown): FloorTier | null {
  if (isBlank(value)) return null;
  return TIER_ALIASES[text(value)] ?? null;
}

function gradeTitle(tier: FloorTier, floor: ProjectInputs["floor"]): string {
  const material = FLOOR_MATERIALS.find(row => row.id === floor)?.label ?? floor;
  return `${FLOOR_GRADES[tier]} ${material.toLowerCase()}`;
}

function normalizeAct(value: unknown): PublicFloorAct | null {
  const token = text(value).replace(/&/g, " and ").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  if (!token || isBlank(value)) return null;
  if (/^(rr|r and r|remove and replace|remove replace|tear out|tearout)$/.test(token)) return "rr";
  if (/^(detach|detach and reattach|reattach|reset)$/.test(token)) return "detach";
  if (/^(install only|install|plus|\+)$/.test(token)) return "install-only";
  return null;
}

/** What is on the floor today. Coverings that must come out map to remove & replace. */
export function classifyExistingFloor(value: unknown): string | null {
  if (isBlank(value)) return null;
  const token = text(value);
  if (!token) return null;
  if (/^(none|nothing|prepared|bare|virgin|subfloor|new)$/.test(token) || /prepared|bare|virgin|no existing|no floor|nothing down/.test(token)) {
    return "prepared";
  }
  if (/snap/.test(token)) return "snap-together";
  if (/laminate|snaplock/.test(token)) return "laminate";
  if (/trim|baseboard|toilet|fixture|detach|reattach/.test(token)) return "fixtures-or-trim";
  if (/carpet/.test(token)) return "carpet";
  if (/tile/.test(token)) return "tile";
  if (/hardwood|\bwood\b/.test(token)) return "wood";
  if (/vinyl|lvp|plank|old floor|existing/.test(token)) return "other";
  return "other";
}

export function actForExistingFloor(existing: string | null): PublicFloorAct | null {
  if (!existing) return null;
  if (existing === "prepared") return "install-only";
  if (existing === "fixtures-or-trim") return "detach";
  return "rr";
}

export function readPublicEstimateContext(data: unknown): PublicEstimateContext {
  if (!data || typeof data !== "object" || Array.isArray(data)) return { act: null, existing: null, tier: null };
  const record = data as Record<string, unknown>;
  const existing = classifyExistingFloor(field(record, "existing", "existingFloor", "existing_floor"));
  const explicit = normalizeAct(field(record, "act"));
  const tier = normalizeTier(field(record, "tier"));
  return { act: explicit ?? actForExistingFloor(existing), existing, tier };
}

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
  const rawFloor = field(record, "floor");
  const floorIsTier = normalizeTier(rawFloor) != null;
  const body: Record<string, unknown> = {
    service,
    size: normalizeSize(field(record, "size"), service, typeof roomSqft === "number" ? roomSqft : undefined),
    floor: normalizeChoice(floorIsTier ? undefined : rawFloor, FLOOR_ALIASES, floorFallback),
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

function flooringNotes(act: PublicFloorAct | null) {
  if (act === "rr") return { removalNote: RR_NOTE, detachNote: null as string | null };
  if (act === "detach") return { removalNote: INSTALL_ONLY_NOTE, detachNote: DETACH_NOTE };
  if (act === "install-only") return { removalNote: INSTALL_ONLY_NOTE, detachNote: null as string | null };
  return { removalNote: REMOVAL_NOTE, detachNote: null as string | null };
}

export function visitorPublicEstimate(input: ProjectInputs, context: PublicEstimateContext = { act: null, existing: null, tier: null }) {
  const priced = publicEstimateResult(input);
  const built = projectPlanningEstimate(input);
  const plannerUrl = new URL(publicPlannerPath(input), CANONICAL_ORIGIN).toString();
  const flooring = input.service === "flooring";
  const tier = flooring ? context.tier : null;
  const act = flooring ? context.act : null;
  const notes = flooring ? flooringNotes(act) : { removalNote: null as string | null, detachNote: null as string | null };
  // Catalog actUnitCost can add a remove rate, but public flooring has no remove
  // rate and the catalog book does not match this planner. The dollars stay install-only.
  const pricedAct = flooring && priced ? "install-only" as const : null;
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
      detachNote: null,
      nextStep: NEXT_STEP,
      plannerUrl,
      tier,
      tierLabel: tier ? gradeTitle(tier, input.floor) : null,
      act,
      actLabel: act === "detach" ? "Detach & reattach" : act === "rr" ? actLabel("rr") : act === "install-only" ? actLabel("plus") : null,
      pricedAct,
      existing: flooring ? context.existing : null,
      removalPriced: flooring ? false : null,
      detachPriced: flooring ? false : null,
    };
  }
  return {
    ok: true as const,
    preliminary: true as const,
    total: priced.total,
    low: built.low,
    high: built.high,
    leadMessage: priced.leadMessage,
    disclaimer: PRELIMINARY_ESTIMATE_WORDING,
    exclusions: notes.removalNote ? `${built.scope.exclusions} ${notes.removalNote}` : built.scope.exclusions,
    removalNote: notes.removalNote,
    detachNote: notes.detachNote,
    nextStep: NEXT_STEP,
    plannerUrl,
    tier,
    tierLabel: tier ? gradeTitle(tier, input.floor) : null,
    act,
    actLabel: act === "detach" ? "Detach & reattach" : act === "rr" ? actLabel("rr") : act === "install-only" ? actLabel("plus") : null,
    pricedAct,
    existing: flooring ? context.existing : null,
    removalPriced: flooring ? false : null,
    detachPriced: flooring ? false : null,
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
    return json(visitorPublicEstimate(input, readPublicEstimateContext(payload)));
  } catch (err) {
    if (err instanceof Response) return withPublicEstimateCors(err);
    throw err;
  }
}
