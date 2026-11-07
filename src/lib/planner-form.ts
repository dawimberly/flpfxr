import {
  COUNTER_MATERIALS,
  FLOOR_MATERIALS,
  PROJECT_SERVICES,
  PROJECT_SIZES,
  SHOWER_MATERIALS,
  getVanity,
  parseBoxCount,
  parseSqft,
  scopeAreaError,
  type ExteriorCoats,
  type ProjectInputs,
  type ProjectService,
  type ProjectSize,
  type ScopeAreas,
} from "./public-estimate-options.ts";
import { projectPlanningEstimate } from "./public-pricing.ts";

export const OCCUPANCY_OPTIONS = [
  { id: "occupied", label: "We live in the home" },
  { id: "vacant", label: "The home is vacant" },
  { id: "tenant", label: "A tenant lives there" },
] as const;

export const TIMING_OPTIONS = [
  { id: "ready", label: "Ready to start" },
  { id: "soon", label: "One to three months" },
  { id: "planning", label: "Still planning" },
] as const;

export const DECISION_OPTIONS = [
  { id: "ready", label: "I can say yes" },
  { id: "shared", label: "I need to check with someone else" },
] as const;

export type StoredPlanner = {
  v: 1;
  project: ProjectInputs;
  address: string;
  note: string;
  occupancy: string;
  timing: string;
  decision: string;
};

const cleanLine = (value: string, max: number) =>
  value.replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, "").trim().slice(0, max);

function cleanNote(value: string): string {
  return value
    .replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, (ch) => (ch === "\n" || ch === "\t" ? ch : ""))
    .trim()
    .slice(0, 2000);
}

function str(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
}

function choice(form: FormData, key: string, options: readonly { id: string; label: string }[]): string {
  const id = str(form, key).trim();
  return options.some((row) => row.id === id) ? id : "";
}

export function choiceLabel(options: readonly { id: string; label: string }[], id: string): string {
  return options.find((row) => row.id === id)?.label ?? "";
}

export function plannerAnswers(form: FormData): Pick<StoredPlanner, "address" | "note" | "occupancy" | "timing" | "decision"> {
  return {
    address: cleanLine(str(form, "address"), 200),
    note: cleanNote(str(form, "note")),
    occupancy: choice(form, "occupancy", OCCUPANCY_OPTIONS),
    timing: choice(form, "timing", TIMING_OPTIONS),
    decision: choice(form, "decision", DECISION_OPTIONS),
  };
}

export function parsePlannerProject(
  form: FormData,
): { ok: true; project: ProjectInputs } | { ok: false; message: string } {
  const service = str(form, "service").trim() as ProjectService;
  const size = str(form, "size").trim() as ProjectSize;
  const floor = str(form, "floor").trim() as ProjectInputs["floor"];
  const counter = str(form, "counter").trim() as ProjectInputs["counter"];
  const shower = str(form, "shower").trim() as ProjectInputs["shower"];
  if (!PROJECT_SERVICES.some((row) => row.id === service)) {
    return { ok: false, message: "Choose a project type." };
  }
  if (!PROJECT_SIZES.includes(size)) {
    return { ok: false, message: "Choose a starting size." };
  }
  if (!FLOOR_MATERIALS.some((row) => row.id === floor)) {
    return { ok: false, message: "Choose a flooring type." };
  }
  if (!COUNTER_MATERIALS.some((row) => row.id === counter)) {
    return { ok: false, message: "Choose a countertop type." };
  }
  if (!SHOWER_MATERIALS.some((row) => row.id === shower)) {
    return { ok: false, message: "Choose a shower wall." };
  }
  const coats = str(form, "exterior_coats").trim();
  if (coats !== "1" && coats !== "2") {
    return { ok: false, message: "Choose how many finish coats." };
  }
  const vanityRaw = str(form, "vanity").trim();
  if (vanityRaw && !getVanity(vanityRaw)) {
    return { ok: false, message: "Choose a vanity size." };
  }
  const areas: ScopeAreas = {};
  const takeSqft = (key: string, field: keyof ScopeAreas) => {
    const raw = str(form, key);
    if (!raw.trim()) return null;
    const parsed = parseSqft(raw);
    if (parsed.error || parsed.value == null) return parsed.error || "Use a number of square feet.";
    areas[field] = parsed.value;
    return null;
  };
  const takeBoxes = (key: string, field: "cabinetBoxes" | "xlFridgeBoxes") => {
    const raw = str(form, key);
    if (!raw.trim()) return null;
    const parsed = parseBoxCount(raw);
    if (parsed.error || parsed.value == null) return parsed.error || "Use a whole number of boxes.";
    areas[field] = parsed.value;
    return null;
  };
  const areaError =
    takeSqft("floor_sqft", "floorSqft") ||
    takeSqft("shower_sqft", "showerSqft") ||
    takeSqft("counter_sqft", "counterSqft") ||
    takeSqft("room_sqft", "roomSqft") ||
    takeBoxes("cabinet_boxes", "cabinetBoxes") ||
    takeBoxes("xl_fridge_boxes", "xlFridgeBoxes");
  if (areaError) return { ok: false, message: areaError };
  const rangeError = scopeAreaError(service, areas);
  if (rangeError) return { ok: false, message: rangeError };

  const includeRaw = str(form, "include_flooring").trim().toLowerCase();
  const includeFlooring = service === "flooring"
    ? true
    : includeRaw === "1" || includeRaw === "true" || includeRaw === "yes";
  const project: ProjectInputs = {
    service,
    size,
    floor,
    counter,
    shower,
    prime: str(form, "prime") !== "0",
    exteriorCoats: Number(coats) as ExteriorCoats,
    delivery: 0,
    specialist: 0,
    newToilet: str(form, "new_toilet") !== "0",
    includeFlooring,
    ...(vanityRaw ? { vanity: vanityRaw } : {}),
    ...areas,
  };
  if (service !== "custom" && !projectPlanningEstimate(project)) {
    return { ok: false, message: "Finish the project details before buying the estimate." };
  }
  return { ok: true, project };
}

export function parseStoredPlanner(form: FormData): { ok: true; planner: StoredPlanner } | { ok: false; message: string } {
  const project = parsePlannerProject(form);
  if (!project.ok) return project;
  return { ok: true, planner: { v: 1, project: project.project, ...plannerAnswers(form) } };
}

export function storedPlannerFromUnknown(value: unknown): StoredPlanner | null {
  if (!value || typeof value !== "object") return null;
  const rec = value as Record<string, unknown>;
  const project = rec.project;
  if (!project || typeof project !== "object") return null;
  const row = project as Record<string, unknown>;
  const data = new FormData();
  const set = (key: string, field: unknown) => {
    if (typeof field === "string" || typeof field === "number") data.set(key, String(field));
  };
  set("service", row.service);
  set("size", row.size);
  set("floor", row.floor);
  set("counter", row.counter);
  set("shower", row.shower);
  data.set("prime", row.prime === false ? "0" : "1");
  set("exterior_coats", row.exteriorCoats);
  data.set("new_toilet", row.newToilet === false ? "0" : "1");
  set("vanity", row.vanity);
  set("floor_sqft", row.floorSqft);
  set("shower_sqft", row.showerSqft);
  set("counter_sqft", row.counterSqft);
  set("room_sqft", row.roomSqft);
  set("cabinet_boxes", row.cabinetBoxes);
  set("xl_fridge_boxes", row.xlFridgeBoxes);
  const parsed = parsePlannerProject(data);
  if (!parsed.ok) return null;
  const text = (field: unknown, max: number) => (typeof field === "string" ? cleanLine(field, max) : "");
  return {
    v: 1,
    project: parsed.project,
    address: text(rec.address, 200),
    note: typeof rec.note === "string" ? cleanNote(rec.note) : "",
    occupancy: OCCUPANCY_OPTIONS.some((item) => item.id === rec.occupancy) ? String(rec.occupancy) : "",
    timing: TIMING_OPTIONS.some((item) => item.id === rec.timing) ? String(rec.timing) : "",
    decision: DECISION_OPTIONS.some((item) => item.id === rec.decision) ? String(rec.decision) : "",
  };
}
