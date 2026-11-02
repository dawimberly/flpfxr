import {
  COUNTER_MATERIALS,
  FLOOR_MATERIALS,
  PROJECT_SERVICES,
  PROJECT_SIZES,
  SHOWER_MATERIALS,
  presetAreas,
  selectedVanity,
  type ProjectInputs,
  type ProjectService,
  type ProjectSize,
} from "./public-estimate-options.ts";
import {
  PRELIMINARY_ESTIMATE_WORDING,
  formatEstimateRange,
  projectPlanningEstimate,
} from "./public-pricing.ts";
import {
  OCCUPANCY_OPTIONS,
  TIMING_OPTIONS,
  choiceLabel,
  type StoredPlanner,
} from "./planner-form.ts";
import { DESIGNER_MATERIALS_NOTE, FEE_CREDIT_NOTE } from "./offer-copy.ts";

export type LaborLine = {
  area: string;
  label: string;
  detail: string;
  quantity: number;
  quantityLabel: string;
  unit: string;
  amountCents: number;
  rateCents: number;
};

export type LaborTier = {
  size: ProjectSize;
  selected: boolean;
  totalCents: number;
  timeline: string;
  note: string;
};

export type LaborDocument = {
  kind: "itemized" | "walkthrough";
  projectLabel: string;
  size: string;
  selections: string[];
  lines: LaborLine[];
  areas: string[];
  totalCents: number;
  timeline: string;
  tiers: LaborTier[];
  included: string[];
  excluded: string[];
  prep: string[];
  nextSteps: string[];
  supplierNote: string | null;
  rangeLabel: string | null;
  answers: { label: string; value: string }[];
  usesExampleQuantities: boolean;
};

type Built = NonNullable<ReturnType<typeof projectPlanningEstimate>>;

const qtyText = (n: number) => {
  const tenths = Math.round(n * 10) / 10;
  return Number.isInteger(tenths) ? String(tenths) : tenths.toFixed(1);
};

export function timelinePhrase(days: number): string {
  if (!Number.isFinite(days) || days <= 0) return "The designer will set the on-site time after seeing the space.";
  const low = Math.max(1, Math.floor(days));
  const high = Math.max(low, Math.ceil(days));
  if (low === high) {
    return `About ${low} working day${low === 1 ? "" : "s"} on site, after the walkthrough.`;
  }
  return `About ${low} to ${high} working days on site, after the walkthrough.`;
}

function selections(input: ProjectInputs): string[] {
  const rows = [
    FLOOR_MATERIALS.find((row) => row.id === input.floor)?.label,
    input.service === "kitchen" ? `${COUNTER_MATERIALS.find((row) => row.id === input.counter)?.label} counters` : "",
    input.service === "bathroom" ? `${SHOWER_MATERIALS.find((row) => row.id === input.shower)?.label} shower wall` : "",
    input.service === "bathroom" ? selectedVanity(input.size, input.vanity).label : "",
    input.service === "bathroom" ? (input.newToilet ? "New toilet" : "Keep the existing toilet") : "",
    input.service === "interior-paint" || input.service === "exterior-paint"
      ? input.prime ? "Primer and paint" : "Paint on prepared surfaces"
      : "",
    input.service === "exterior-paint" ? (input.exteriorCoats === 2 ? "2 finish coats" : "1 finish coat") : "",
    input.service === "interior-paint" ? "2 finish coats" : "",
  ];
  return rows.filter((row): row is string => Boolean(row));
}

function usesExampleQuantities(input: ProjectInputs): boolean {
  const preset = presetAreas(input.service, input.size);
  const same = (actual: number | null | undefined, example: string) =>
    actual == null || actual === Number(example);
  if (input.service === "bathroom") return same(input.floorSqft, preset.floor) && same(input.showerSqft, preset.shower);
  if (input.service === "kitchen") {
    return same(input.floorSqft, preset.floor) && same(input.counterSqft, preset.counter) &&
      same(input.cabinetBoxes, preset.boxes) && (input.xlFridgeBoxes == null || input.xlFridgeBoxes === Number(preset.xl));
  }
  if (input.service === "flooring" || input.service === "interior-paint" || input.service === "exterior-paint") {
    return same(input.roomSqft, preset.room);
  }
  return true;
}

type Spec = {
  id: string;
  area: string;
  label: string;
  detail: string;
  quantity: number;
  unit: string;
};

const BUNDLE_ORDER = [
  "Demolition",
  "Cabinets - supplied and installed",
  "Vanity - supplied and installed",
  "Counters - supplied and installed",
  "Backsplash - supplied and installed",
  "Shower - supplied and installed",
  "Tile setting - supplied and installed",
  "Floor - supplied and installed",
  "Walls and trim - supplied and installed",
  "Fixtures - supplied and installed",
  "Protection, cleanup, and haul-off",
  "Allowances",
];

function bundleLabel(id: string): string {
  const named: Record<string, string> = {
    floor: "Floor - supplied and installed",
    trim: "Walls and trim - supplied and installed",
    paint: "Walls and trim - supplied and installed",
    primer: "Walls and trim - supplied and installed",
    "base-cabinets": "Cabinets - supplied and installed",
    "wall-cabinets": "Cabinets - supplied and installed",
    "xl-fridge": "Cabinets - supplied and installed",
    filler: "Cabinets - supplied and installed",
    vanity: "Vanity - supplied and installed",
    counter: "Counters - supplied and installed",
    backsplash: "Backsplash - supplied and installed",
    surround: "Shower - supplied and installed",
    "licensed-plumber-valve": "Shower - supplied and installed",
    thinset: "Tile setting - supplied and installed",
    grout: "Tile setting - supplied and installed",
    backerBoard: "Tile setting - supplied and installed",
    membrane: "Tile setting - supplied and installed",
    "fixture-allowance": "Fixtures - supplied and installed",
    demolition: "Demolition",
  };
  return named[id] ?? "Other work";
}

function bundleDetail(label: string, input: ProjectInputs): string {
  const floor = FLOOR_MATERIALS.find((row) => row.id === input.floor)?.label ?? "flooring";
  const counter = COUNTER_MATERIALS.find((row) => row.id === input.counter)?.label ?? "counter";
  const shower = SHOWER_MATERIALS.find((row) => row.id === input.shower)?.label ?? "shower wall";
  switch (label) {
    case "Floor - supplied and installed":
      return `We supply and install the ${floor.toLowerCase()}.`;
    case "Walls and trim - supplied and installed":
      return "We supply and install the trim and the paint.";
    case "Cabinets - supplied and installed":
      return "We supply and install the cabinets.";
    case "Vanity - supplied and installed":
      return `We supply and install the ${selectedVanity(input.size, input.vanity).label}.`;
    case "Counters - supplied and installed":
      return `We supply and install the ${counter.toLowerCase()} counters.`;
    case "Backsplash - supplied and installed":
      return "We supply and install the backsplash.";
    case "Shower - supplied and installed":
      return `We supply and install the ${shower.toLowerCase()} shower wall and set the valve.`;
    case "Tile setting - supplied and installed":
      return "We supply the thinset, grout, backer, and membrane for the tile.";
    case "Fixtures - supplied and installed":
      return "We supply and set the fixtures for this bath.";
    case "Demolition":
      return "Basic finish removal. Hidden damage is a separate conversation.";
    case "Protection, cleanup, and haul-off":
      return "Floor protection while we work, daily cleanup, and routine haul-off.";
    case "Allowances":
      return "Delivery or specialist allowances added to this job.";
    default:
      return "Other work on this job.";
  }
}

/** Section prices from the same planner total that sets the website range. */
function priceFullJob(built: Built, input: ProjectInputs): LaborLine[] {
  const hours = built.lines.reduce((sum, line) => sum + line.personHours, 0);
  const laborPool = built.labor + built.minimumAdjustment;
  const dollars = new Map<string, number>();
  const add = (label: string, amount: number) => {
    if (!amount) return;
    dollars.set(label, (dollars.get(label) ?? 0) + amount);
  };
  for (const line of built.lines) {
    const share = hours > 0 ? laborPool * (line.personHours / hours) : 0;
    add(bundleLabel(line.id), line.materials + share);
  }
  add("Protection, cleanup, and haul-off", built.support);
  add("Allowances", input.delivery + input.specialist);
  const labels = [...BUNDLE_ORDER.filter((label) => dollars.has(label)), ...[...dollars.keys()].filter((label) => !BUNDLE_ORDER.includes(label))];
  const raw = labels.map((label) => ({ label, cents: Math.round((dollars.get(label) ?? 0) * 100) }));
  const target = Math.round(built.low) * 100;
  const drift = target - raw.reduce((sum, row) => sum + row.cents, 0);
  if (raw.length && drift !== 0) {
    const host = raw.reduce((best, row) => row.cents > best.cents ? row : best, raw[0]);
    host.cents += drift;
  }
  return raw.filter((row) => row.cents > 0).map((row) => toLine({
    id: row.label,
    area: row.label,
    label: row.label,
    detail: bundleDetail(row.label, input),
    quantity: 1,
    unit: "section",
  }, row.cents, row.cents));
}

function toLine(spec: Spec, amountCents: number, rateCents = spec.quantity > 0 ? Math.round(amountCents / spec.quantity) : amountCents): LaborLine {
  return {
    area: spec.area,
    label: spec.label,
    detail: spec.detail,
    quantity: spec.quantity,
    quantityLabel: qtyText(spec.quantity),
    unit: spec.unit,
    amountCents,
    rateCents,
  };
}

function laborTotalCents(lines: LaborLine[]): number {
  return lines.reduce((sum, line) => sum + line.amountCents, 0);
}

function tierFor(input: ProjectInputs, size: ProjectSize, selected: boolean): LaborTier | null {
  const project: ProjectInputs = selected
    ? input
    : {
        ...input,
        size,
        floorSqft: undefined,
        showerSqft: undefined,
        counterSqft: undefined,
        roomSqft: undefined,
        cabinetBoxes: undefined,
        xlFridgeBoxes: undefined,
      };
  const built = projectPlanningEstimate(project);
  if (!built) return null;
  const lines = priceFullJob(built, project);
  return {
    size,
    selected,
    totalCents: laborTotalCents(lines),
    timeline: timelinePhrase(built.adjustedDays),
    note: selected ? "Uses the quantities in this estimate." : "Example quantities for that size, with the finishes you picked.",
  };
}

function excludedFor(service: ProjectService): string[] {
  const common = [
    "Appliances, layout changes, plumbing moves, electrical, and permits.",
    "Hidden damage found after demolition.",
  ];
  if (service === "flooring") {
    return [
      ...common,
      "Floor removal, subfloor repair, leveling, stairs, and new trim.",
    ];
  }
  if (service === "interior-paint" || service === "exterior-paint") {
    return [
      ...common,
      "Surface repairs, ceilings, and extra access equipment.",
    ];
  }
  return common;
}

function prepFor(input: ProjectInputs, example: boolean, hasPhoto: boolean): string[] {
  const notes = [
    example
      ? `Quantities follow a typical ${input.size.toLowerCase()} project. We confirm them on site.`
      : "Quantities are based on the numbers you entered. We confirm them on site.",
    "Clear the work area and tell us about access, pets, and whether water and power stay on.",
    "Existing layout stays unless we agree to move it before the work starts.",
  ];
  if (hasPhoto) notes.push("We have the photo you sent and will use it on the call.");
  else notes.push("A photo of the room helps the call. You can still text one to us.");
  return notes;
}

function answersFrom(planner: StoredPlanner | null, hasPhoto: boolean): { label: string; value: string }[] {
  if (!planner) return [];
  const rows = [
    ["Property", planner.address],
    ["Who is there", choiceLabel(OCCUPANCY_OPTIONS, planner.occupancy)],
    ["When you want to start", choiceLabel(TIMING_OPTIONS, planner.timing)],
    ["Approving the work", planner.decision === "ready"
      ? "You can say yes."
      : planner.decision === "shared"
        ? "You'll check with someone else first."
        : ""],
    ["Notes", planner.note],
    ["Photo", hasPhoto ? "One photo was sent with this request." : ""],
  ];
  return rows.filter((row): row is [string, string] => Boolean(row[1])).map(([label, value]) => ({ label, value }));
}

export function buildLaborDocument(planner: StoredPlanner, hasPhoto = false): LaborDocument {
  const input = planner.project;
  const projectLabel = PROJECT_SERVICES.find((row) => row.id === input.service)?.label ?? "Project";
  const example = usesExampleQuantities(input);
  const answers = answersFrom(planner, hasPhoto);
  const nextSteps = [
    "Book a designer call to walk the scope and choose cabinets, fillers, toe kick, and baseboard.",
    "50% deposit to begin, balance on completion.",
    FEE_CREDIT_NOTE,
    PRELIMINARY_ESTIMATE_WORDING,
  ];
  if (input.service === "custom") {
    return {
      kind: "walkthrough",
      projectLabel,
      size: input.size,
      selections: [],
      lines: [],
      areas: [],
      totalCents: 0,
      timeline: "The designer will set the on-site time after seeing the space.",
      tiers: [],
      included: [
        "A call from a Flip Fixer designer to measure the work.",
        "A written job estimate after that visit.",
        "Help choosing cabinets, fillers, toe kick, and baseboard on the designer call.",
      ],
      excluded: excludedFor(input.service),
      prep: [
        "Have a few photos of the space ready for the call.",
        "Know whether you live in the home and when you want to start.",
        planner.note ? `You told us: ${planner.note}` : "Tell the designer what is not working today.",
      ],
      nextSteps,
      supplierNote: null,
      rangeLabel: null,
      answers,
      usesExampleQuantities: true,
    };
  }
  const built = projectPlanningEstimate(input);
  if (!built) {
    return buildLaborDocument({ ...planner, project: { ...input, service: "custom" } }, hasPhoto);
  }
  const lines = priceFullJob(built, input);
  const areas: string[] = [];
  for (const line of lines) if (!areas.includes(line.area)) areas.push(line.area);
  const tiers = PROJECT_SIZES.map((size) => tierFor(input, size, size === input.size)).filter((row): row is LaborTier => Boolean(row));
  return {
    kind: "itemized",
    projectLabel,
    size: input.size,
    selections: selections(input),
    lines,
    areas,
    totalCents: laborTotalCents(lines),
    timeline: timelinePhrase(built.adjustedDays),
    tiers,
    included: [
      "The work in this estimate: demolition where listed, installation, and finish work.",
      "Protection of the space, daily cleanup, and routine haul-off.",
    ],
    excluded: excludedFor(input.service),
    prep: prepFor(input, example, hasPhoto),
    nextSteps,
    supplierNote: null,
    rangeLabel: formatEstimateRange(built),
    answers,
    usesExampleQuantities: example,
  };
}

export const CUSTOMER_DEPOSIT_LINE = "50% deposit schedules the work. Balance due on completion. Price good 30 days.";
export const CUSTOMER_READY_LINE = "Ready when you are.";
export const CUSTOMER_CONTACT_LINE = "theflipfixer.com · jon@theflipfixer.com · San Antonio, TX";

export type CustomerCopy = {
  project: string;
  included: string[];
  excluded: string[];
  investment: { label: string; cents: number }[];
  notes: string[];
};

/** Customer sheet: materials named, investment bundled, no quantities or unit rates. */
export function customerFacingCopy(
  doc: LaborDocument,
  header: { name: string; phone: string; email: string; feeLabel: string; catalogUrl: string },
): CustomerCopy {
  const property = doc.answers.find((row) => row.label === "Property")?.value;
  const project = [
    `We prepared this for ${header.name} (${header.phone}, ${header.email}).`,
    `${doc.projectLabel}${doc.size ? `, ${doc.size.toLowerCase()} size` : ""}.`,
    doc.selections.length ? `Finishes: ${doc.selections.join(", ")}.` : "",
    doc.timeline,
    property ? `Property: ${property}.` : "",
    doc.usesExampleQuantities
      ? "The sizes are a typical project. We confirm them on site."
      : "We used the sizes you entered. We confirm them on site.",
  ].filter(Boolean).join(" ");
  const included = doc.kind === "itemized"
    ? [
        doc.selections.length ? `Materials named for this job: ${doc.selections.join(", ")}.` : "",
        ...doc.lines.map((line) => line.detail),
      ].filter(Boolean)
    : doc.included;
  const investment = doc.lines.map((line) => ({ label: line.label, cents: line.amountCents }));
  const notes = [
    doc.supplierNote ?? "",
    ...doc.prep.filter((row) => !/^Quantities (follow|are based)/.test(row)),
    ...doc.answers.filter((row) => row.label !== "Property").map((row) => `${row.label}: ${row.value}`),
    DESIGNER_MATERIALS_NOTE,
    header.feeLabel ? `${header.feeLabel} is credited toward the job if you book.` : "",
    `Browse finishes at ${header.catalogUrl}. We order materials with you after the designer call.`,
  ].filter(Boolean);
  return { project, included, excluded: doc.excluded, investment, notes };
}

export function laborDocumentPlainText(
  doc: LaborDocument,
  header: { name: string; phone: string; email: string; feeLabel: string; catalogUrl: string },
): string {
  const money = (cents: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
  const copy = customerFacingCopy(doc, header);
  const lines = [
    "FLIP FIXER",
    "Itemized job estimate",
    CUSTOMER_CONTACT_LINE,
    "",
    "PROJECT",
    copy.project,
    "",
    "WHAT'S INCLUDED",
    ...copy.included.map((row) => `- ${row}`),
    "",
    "WHAT'S NOT INCLUDED",
    ...copy.excluded.map((row) => `- ${row}`),
    "",
    "INVESTMENT",
  ];
  if (copy.investment.length) {
    for (const row of copy.investment) lines.push(`${row.label}: ${money(row.cents)}`);
    lines.push(`Estimated job total: ${doc.rangeLabel ?? money(doc.totalCents)}`);
  } else {
    lines.push("Set after we walk the space.");
  }
  lines.push("", "NOTES", ...copy.notes.map((row) => `- ${row}`));
  lines.push("", CUSTOMER_DEPOSIT_LINE, PRELIMINARY_ESTIMATE_WORDING, "", CUSTOMER_READY_LINE);
  return lines.join("\n");
}
