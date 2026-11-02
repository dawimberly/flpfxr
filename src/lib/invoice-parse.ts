/**
 * Turn Flip Fixer estimate text into editable invoice lines.
 * Contractor tables, room totals, narrative amounts, and option A/B blocks.
 */

export type LineKind = "labor" | "materials";

export type ParsedLine = {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unitAmountCents: number;
  amountCents: number;
  kind: LineKind;
  option: string | null;
};

export type ParsedEstimate = {
  filename: string | null;
  copy: "contractor" | "customer" | "materials" | "unknown";
  estimateNumber: string | null;
  jobLabel: string | null;
  /** Null when the PDF says TBD or has no usable name. */
  customerName: string | null;
  discountPercent: number | null;
  discountCents: number | null;
  depositPercent: number | null;
  lines: ParsedLine[];
  warnings: string[];
};

const UNITS = "LS|LF|SF|EA|SQ|HR|FT|IN|SY|CF|CY|GAL";
const TABLE_ROW = new RegExp(
  `^(\\d+)\\s+(.+?)\\s+([\\d,]+(?:\\.\\d+)?)\\s+(${UNITS})\\s+(\\(?(?:-)?\\$?[\\d,]+(?:\\.\\d+)?\\)?)\\s+(\\(?(?:-)?\\$?[\\d,]+(?:\\.\\d+)?\\)?)\\s*$`,
  "i",
);
const MONEY = /(?:\(?-?\$[\d,]+(?:\.\d{2})?\)?|\(?-?[\d,]+\.\d{2}\)?)/g;

const MATERIAL_HINT =
  /allowance|\bmaterials?\b|@\s*\$|\/\s*sf|\bequipment\b|\bcabinets?\b|\bcounter(?:top)?s?\b|\bfloor(?:ing)?\b|\btile\b|\bfixture|\bappliances?\b|\bvanity\b|\bquartz\b|\bgranite\b|\blvp\b|\bpaint\b|\bprimer\b|\bslab\b/i;
const LABOR_HINT = /\blabor\b|\binstall|\bdemolition\b|\bdemo\b|\bhaul\b|\bcleanup\b|\bprotection\b|\bcrew\b/i;
const GOODS_HINT = /allowance|\bmaterials?\b|@\s*\$|\/\s*sf|\bequipment\b/i;

export function classifyLine(description: string): LineKind {
  if (GOODS_HINT.test(description)) return "materials";
  if (LABOR_HINT.test(description)) return "labor";
  if (MATERIAL_HINT.test(description)) return "materials";
  return "labor";
}

export function parseMoneyToCents(raw: string): number | null {
  const text = raw.trim();
  if (!text || !/\d/.test(text)) return null;
  const negative = /^\(.*\)$/.test(text) || text.includes("-");
  const digits = text.replace(/[(),$\s-]/g, "").replace(/,/g, "");
  if (!/^\d+(?:\.\d+)?$/.test(digits)) return null;
  const cents = Math.round(Number(digits) * 100);
  if (!Number.isFinite(cents)) return null;
  return negative ? -cents : cents;
}

export function preferredEstimateFile(names: string[]): string | null {
  const files = names.map((name) => name.trim()).filter(Boolean);
  return (
    files.find((name) => /contractor/i.test(name)) ??
    files.find((name) => /customer/i.test(name)) ??
    files[0] ??
    null
  );
}

function copyFromName(filename: string | null): ParsedEstimate["copy"] {
  if (!filename) return "unknown";
  if (/contractor/i.test(filename)) return "contractor";
  if (/customer/i.test(filename)) return "customer";
  if (/materials/i.test(filename)) return "materials";
  return "unknown";
}

function filenameParts(filename: string | null): { job: string | null; date: string | null } {
  if (!filename) return { job: null, date: null };
  const match = filename.match(/Flip-Fixer-(.+)-(?:Customer|Contractor|Materials)-(\d{8})/i);
  if (!match) {
    const date = filename.match(/(\d{8})/);
    return { job: null, date: date?.[1] ?? null };
  }
  return { job: match[1].replace(/[-_]+/g, " ").trim(), date: match[2] };
}

function usableName(raw: string): string | null {
  const name = raw.replace(/\s+/g, " ").trim().replace(/[.,;:]+$/, "");
  if (!name || /^(tbd|n\/a|na|customer|client|unknown|none)$/i.test(name)) return null;
  if (name.length < 2 || name.length > 120) return null;
  return name;
}

function nextId(index: number): string {
  return `line-${index + 1}`;
}

export function parseEstimateText(text: string, filename: string | null = null): ParsedEstimate {
  const warnings: string[] = [];
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const file = filenameParts(filename);
  const estimateMatch = text.match(/#\s*(\d{8}(?:-[A-Za-z0-9]+)?)/);
  const estimateNumber = estimateMatch?.[1] ?? file.date;
  let customerName: string | null = null;
  for (const line of lines) {
    const named = line.match(/^(?:prepared for|customer|client|bill to)\s*[-:]?\s*(.+)$/i);
    if (!named) continue;
    customerName = usableName(named[1]);
    if (/tbd/i.test(named[1])) warnings.push("The PDF customer is TBD. Pick a lead or a Stripe customer.");
    break;
  }
  const percent = text.match(/(\d+(?:\.\d+)?)\s*%\s*discount/i);
  const discountPercent = percent ? Number(percent[1]) : null;
  let discountCents: number | null = null;
  const depositPercent = /50\s*%\s*deposit/i.test(text) ? 50 : null;

  const parsed: ParsedLine[] = [];
  let option: string | null = null;
  let optionHasDetails = false;
  for (const line of lines) {
    const optionHeader = line.match(/^option\s+([A-Z])\b\s*(?:[—–-]\s*(.+))?$/i);
    if (optionHeader && !/\$\s*[\d,]+/.test(line)) {
      option = optionHeader[1].toUpperCase();
      optionHasDetails = false;
      continue;
    }
    if (/^option\s+[A-Z]\s+total\b/i.test(line)) {
      if (optionHasDetails) continue;
    }
    if (/^(grand\s+)?total\b/i.test(line) && !/\$\s*[\d,]+\s+.+/i.test(line)) {
      const only = line.match(/(-?\$[\d,]+(?:\.\d{2})?|\(\$[\d,]+(?:\.\d{2})?\))$/);
      if (only && /discount/i.test(line)) discountCents = parseMoneyToCents(only[1]);
      continue;
    }
    if (/discount/i.test(line)) {
      const amounts = line.match(MONEY) ?? [];
      const last = amounts.at(-1);
      if (last) discountCents = parseMoneyToCents(last);
      continue;
    }
    const table = line.match(TABLE_ROW);
    if (table) {
      const quantity = Number(table[3].replace(/,/g, ""));
      const unitAmountCents = parseMoneyToCents(table[5]) ?? 0;
      const amountCents = parseMoneyToCents(table[6]) ?? Math.round(quantity * unitAmountCents);
      parsed.push({
        id: nextId(parsed.length),
        description: table[2].trim(),
        quantity,
        unit: table[4].toUpperCase(),
        unitAmountCents,
        amountCents,
        kind: classifyLine(table[2]),
        option,
      });
      optionHasDetails = true;
      continue;
    }
    const amounts = line.match(MONEY) ?? [];
    if (!amounts.length) continue;
    const amountRaw = amounts.at(-1)!;
    const amountCents = parseMoneyToCents(amountRaw);
    if (amountCents == null || amountCents === 0) continue;
    const description = line.replace(amountRaw, "").replace(/[:–—-]\s*$/, "").trim();
    if (!description || /^(subtotal|tax|balance|deposit|valid|page)\b/i.test(description)) continue;
    if (/^option\s+[A-Z]\s+total\b/i.test(description) && optionHasDetails) continue;
    parsed.push({
      id: nextId(parsed.length),
      description,
      quantity: 1,
      unit: "LS",
      unitAmountCents: amountCents,
      amountCents,
      kind: classifyLine(description),
      option,
    });
    optionHasDetails = true;
  }

  if (!parsed.length) warnings.push("No priced lines were found. Add them before creating a draft.");
  if (!estimateNumber) warnings.push("No estimate number was found.");
  if (parsed.some((line) => line.option) && new Set(parsed.map((line) => line.option).filter(Boolean)).size > 1) {
    warnings.push("This estimate has more than one option. Uncheck the option you are not billing.");
  }

  return {
    filename,
    copy: copyFromName(filename),
    estimateNumber,
    jobLabel: file.job,
    customerName,
    discountPercent,
    discountCents,
    depositPercent,
    lines: parsed,
    warnings,
  };
}

export type InvoiceLineInput = {
  description: string;
  amountCents: number;
  kind: LineKind;
  included: boolean;
};

/** Lines that will be sent to Stripe. Credit is applied by the server when the lead is paid. */
export function invoiceLinesFromReview(args: {
  lines: InvoiceLineInput[];
  depositPercent: number | null;
  creditCents: number;
}): { description: string; amountCents: number; kind: LineKind }[] {
  const chosen = args.lines.filter((line) => line.included && line.description.trim() && line.amountCents !== 0);
  const deposit = args.depositPercent && args.depositPercent > 0 && args.depositPercent < 100 ? args.depositPercent : null;
  const scaled = chosen.map((line) => ({
    description: deposit ? `${line.description.trim()} (${deposit}% deposit)` : line.description.trim(),
    amountCents: deposit ? Math.round((line.amountCents * deposit) / 100) : line.amountCents,
    kind: line.kind,
  }));
  if (deposit && scaled.length) {
    const target = Math.round((chosen.reduce((sum, line) => sum + line.amountCents, 0) * deposit) / 100);
    const drift = target - scaled.reduce((sum, line) => sum + line.amountCents, 0);
    scaled[scaled.length - 1].amountCents += drift;
  }
  if (args.creditCents > 0) {
    const credit = deposit ? Math.round((args.creditCents * deposit) / 100) : args.creditCents;
    scaled.push({
      description: deposit ? `Estimate fee credit (${deposit}% deposit)` : "Estimate fee credit",
      amountCents: -credit,
      kind: "labor",
    });
  }
  return scaled;
}
