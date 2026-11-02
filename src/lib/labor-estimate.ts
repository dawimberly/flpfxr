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
import northvilleLabor from "../data/northville.json" with { type: "json" };
import {
  CREW_DAY_RATE,
  PRELIMINARY_ESTIMATE_WORDING,
  TRADE_HOURS,
  formatEstimateRange,
  projectPlanningEstimate,
} from "./public-pricing.ts";
import {
  OCCUPANCY_OPTIONS,
  TIMING_OPTIONS,
  choiceLabel,
  type StoredPlanner,
} from "./planner-form.ts";
import { FEE_CREDIT_NOTE, LABOR_ONLY_NOTE } from "./offer-copy.ts";

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

function specsFor(input: ProjectInputs, built: Built): Spec[] {
  const scope = built.scope;
  const paintCoats = input.service === "exterior-paint" ? input.exteriorCoats : 2;
  const paintWhere = input.service === "exterior-paint" ? "exterior" : "wall";
  const byId: Record<string, Omit<Spec, "id">> = {
    floor: {
      area: "Floor",
      label: "Floor installation",
      detail: input.floor === "tile"
        ? "Set the floor on a sound surface. Deep subfloor repair is a separate conversation."
        : "Install the floor covering on a prepared surface.",
      quantity: scope.floor,
      unit: "sq ft",
    },
    trim: {
      area: "Walls and trim",
      label: "Trim installation",
      detail: "Hang the trim. Finish paint of that trim is included only when wall paint is in this scope.",
      quantity: scope.trim,
      unit: "ft",
    },
    paint: {
      area: input.service === "exterior-paint" ? "Exterior paint" : "Walls and trim",
      label: "Paint labor",
      detail: `${paintCoats} finish coat${paintCoats === 1 ? "" : "s"} on the ${paintWhere} area.`,
      quantity: scope.wall,
      unit: "sq ft",
    },
    primer: {
      area: input.service === "exterior-paint" ? "Exterior paint" : "Walls and trim",
      label: "Primer labor",
      detail: "One primer pass before the finish coats.",
      quantity: scope.wall,
      unit: "sq ft",
    },
    "base-cabinets": {
      area: "Cabinets",
      label: "Base cabinet installation",
      detail: "Set, level, and fasten the base boxes.",
      quantity: scope.base,
      unit: "boxes",
    },
    "wall-cabinets": {
      area: "Cabinets",
      label: "Wall cabinet installation",
      detail: "Set and fasten the wall boxes.",
      quantity: scope.wallUnits,
      unit: "boxes",
    },
    "xl-fridge": {
      area: "Cabinets",
      label: "Refrigerator panel installation",
      detail: "Set the tall panels around the refrigerator opening.",
      quantity: scope.xlFridgeBoxes,
      unit: "boxes",
    },
    counter: {
      area: "Counters and backsplash",
      label: "Countertop installation",
      detail: "Install the counter on the measured run.",
      quantity: scope.counters,
      unit: "sq ft",
    },
    backsplash: {
      area: "Counters and backsplash",
      label: "Backsplash installation",
      detail: "Set the backsplash on the measured wall.",
      quantity: scope.backsplash,
      unit: "sq ft",
    },
    demolition: {
      area: "Demolition",
      label: "Finish demolition",
      detail: `Basic finish removal for a ${input.size.toLowerCase()} ${input.service === "bathroom" ? "bathroom" : "kitchen"}. Hidden damage is not included.`,
      quantity: 1,
      unit: "project",
    },
    vanity: {
      area: "Cabinets",
      label: "Vanity installation",
      detail: `Set and fasten the ${selectedVanity(input.size, input.vanity).label}.`,
      quantity: 1,
      unit: "each",
    },
    surround: {
      area: "Shower",
      label: "Shower wall installation",
      detail: "Set the shower wall on the measured surround.",
      quantity: scope.shower,
      unit: "sq ft",
    },
    "fixture-allowance": {
      area: "Fixtures",
      label: "Fixture installation",
      detail: input.newToilet
        ? "Set the vanity faucet and a basic toilet. The products themselves are not priced here."
        : "Set the vanity faucet. The existing toilet stays. Product cost is not in this estimate.",
      quantity: input.newToilet ? 2 : 1,
      unit: "each",
    },
    "licensed-plumber-valve": {
      area: "Shower",
      label: "Shower valve labor",
      detail: "Labor to set the shower valve. The valve product is not in this estimate.",
      quantity: 1,
      unit: "each",
    },
  };
  const specs: Spec[] = [];
  for (const line of built.lines) {
    const spec = byId[line.id];
    if (!spec || spec.quantity <= 0) continue;
    const laborLine = line.personHours > 0 || line.id === "licensed-plumber-valve";
    if (!laborLine) continue;
    specs.push({ id: line.id, ...spec });
  }
  return specs;
}

/**
 * Each trade keeps its own labor rate. Cabinets use Northville's $75 / $125
 * install schedule. Paint is priced per coat. Other trades start from that
 * line's person-hours times the crew hour ($650 / 16). The crew-day adjustment
 * in the planner is spread across those hour-based lines, so a floor and a
 * paint coat stay on different rates and the total still matches the planner.
 */
function allocate(specs: Spec[], built: Built, input: ProjectInputs): LaborLine[] {
  const hourly = CREW_DAY_RATE / 16;
  const priced: LaborLine[] = [];
  const adjustable: LaborLine[] = [];
  let publishedLabor = 0;
  const published = new Set(["base-cabinets", "wall-cabinets", "vanity", "xl-fridge"]);
  for (const spec of specs) {
    const source = built.lines.find((line) => line.id === spec.id);
    if (spec.id === "licensed-plumber-valve") {
      const amountCents = Math.round((source?.materials ?? 0) * 100);
      if (amountCents > 0) priced.push(toLine(spec, amountCents, amountCents));
      continue;
    }
    let rateCents = 0;
    let amountCents = 0;
    const unit = spec.unit;
    if (spec.id === "base-cabinets" || spec.id === "wall-cabinets" || spec.id === "vanity") {
      rateCents = Math.round(northvilleLabor.laborPerUnit * 100);
      amountCents = rateCents * spec.quantity;
    } else if (spec.id === "xl-fridge") {
      rateCents = Math.round(northvilleLabor.laborPerOversized * 100);
      amountCents = rateCents * spec.quantity;
    } else if (spec.id === "paint") {
      const perCoatHours = input.service === "exterior-paint" ? TRADE_HOURS.exteriorPaint : TRADE_HOURS.interiorPaintPerCoat;
      const coats = input.service === "exterior-paint" ? input.exteriorCoats : 2;
      const perCoat = perCoatHours * hourly;
      amountCents = Math.round(perCoat * spec.quantity * coats * 100);
      rateCents = spec.quantity > 0 ? Math.round(amountCents / spec.quantity) : amountCents;
    } else if (source && spec.quantity > 0) {
      const perUnit = (source.personHours / spec.quantity) * hourly;
      amountCents = Math.round(perUnit * spec.quantity * 100);
      rateCents = Math.round(amountCents / spec.quantity);
    }
    if (amountCents <= 0) continue;
    const line = toLine({ ...spec, unit }, amountCents, rateCents);
    if (published.has(spec.id)) publishedLabor += amountCents;
    else adjustable.push(line);
    priced.push(line);
  }
  const laborPool = Math.round(built.labor * 100);
  const current = adjustable.reduce((sum, line) => sum + line.amountCents, 0);
  const target = laborPool - publishedLabor;
  if (adjustable.length && current > 0 && target > 0 && target !== current) {
    let assigned = 0;
    const last = adjustable.length - 1;
    adjustable.forEach((line, index) => {
      if (index === last) {
        line.amountCents = target - assigned;
        line.rateCents = line.quantity > 0 ? Math.round(line.amountCents / line.quantity) : line.amountCents;
        return;
      }
      const scaled = Math.round((line.amountCents * target) / current);
      const rate = line.quantity > 0 ? Math.round(scaled / line.quantity) : scaled;
      const amount = line.quantity > 0 ? rate * line.quantity : scaled;
      line.rateCents = rate;
      line.amountCents = amount;
      assigned += amount;
    });
  }
  if (built.support > 0) {
    const supportCents = Math.round(built.support * 100);
    priced.push(toLine({
      id: "support",
      area: "Job setup",
      label: "Protection, cleanup, and haul-off",
      detail: "Floor protection while we work, daily cleanup, and routine haul-off.",
      quantity: 1,
      unit: "project",
    }, supportCents, supportCents));
  }
  return priced;
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
  const lines = allocate(specsFor(project, built), built, project);
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
    "Material prices, including flooring, paint, counters, and cabinet boxes.",
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
        "A written labor and service scope after that visit.",
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
  const lines = allocate(specsFor(input, built), built, input);
  const areas: string[] = [];
  for (const line of lines) if (!areas.includes(line.area)) areas.push(line.area);
  const supplier = built.lines.some((line) =>
    (line.id === "counter" || line.id === "surround") && line.personHours === 0 && line.materials > 0,
  );
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
      "Labor for the areas in the table: demolition where listed, installation, and finish work.",
      "Protection of the space, daily cleanup, and routine haul-off.",
    ],
    excluded: excludedFor(input.service),
    prep: prepFor(input, example, hasPhoto),
    nextSteps,
    supplierNote: supplier
      ? "Stone is supplied and installed separately. It is not part of this labor total."
      : null,
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
        doc.selections.length
          ? `Materials named for this job: ${doc.selections.join(", ")}. We do not put prices on materials.`
          : "",
        ...doc.lines.map((line) => line.detail),
      ].filter(Boolean)
    : doc.included;
  const investment = doc.areas.map((area) => ({
    label: area,
    cents: doc.lines.filter((line) => line.area === area).reduce((sum, line) => sum + line.amountCents, 0),
  })).filter((row) => row.cents > 0);
  const notes = [
    doc.supplierNote ?? "",
    doc.rangeLabel
      ? `The planning range on the site (${doc.rangeLabel}) includes materials and cabinets. The investment above is labor and services.`
      : doc.kind === "itemized" ? LABOR_ONLY_NOTE : "",
    ...doc.prep.filter((row) => !/^Quantities (follow|are based)/.test(row)),
    ...doc.answers.filter((row) => row.label !== "Property").map((row) => `${row.label}: ${row.value}`),
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
    lines.push(`Labor and services: ${money(doc.totalCents)}`);
  } else {
    lines.push("Set after we walk the space.");
  }
  lines.push("", "NOTES", ...copy.notes.map((row) => `- ${row}`));
  lines.push("", CUSTOMER_DEPOSIT_LINE, PRELIMINARY_ESTIMATE_WORDING, "", CUSTOMER_READY_LINE);
  return lines.join("\n");
}
