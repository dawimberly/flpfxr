/** Two-person crew, customer-facing planning rate. Not payroll or a quote. */
export const CREW_DAY_RATE = 650;

/** Count complete four-day blocks; partial crew days round up first. */
export function adjustedCrewDays(baseDays: number): number {
  const days = Math.max(0, Math.ceil(Number.isFinite(baseDays) ? baseDays : 0));
  return days + Math.floor(days / 4);
}

/** Materials are passed through at cost, without automatic markup. */
export function planningEstimate(input: {
  baseCrewDays: number;
  materialsAtCost: number;
  otherProjectCosts?: number;
}): number {
  const { baseCrewDays, materialsAtCost, otherProjectCosts = 0 } = input;
  if (![baseCrewDays, materialsAtCost, otherProjectCosts].every(Number.isFinite) ||
      baseCrewDays < 0 || materialsAtCost < 0 || otherProjectCosts < 0) {
    throw new Error("Estimate quantities must be finite nonnegative numbers");
  }
  return adjustedCrewDays(baseCrewDays) * CREW_DAY_RATE + materialsAtCost + otherProjectCosts;
}

/** Carry a customer's own planning inputs into the existing contact form. */
export function publicEstimateLeadMessage(input: {
  service: string;
  size: "Small" | "Medium" | "Large";
  baseCrewDays: number;
  materialsAtCost: number;
  otherProjectCosts: number;
}): string {
  const total = planningEstimate(input);
  const adjusted = adjustedCrewDays(input.baseCrewDays);
  const dollars = (amount: number) => new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", maximumFractionDigits: 0,
  }).format(amount);
  return [
    `I'd like an on-site estimate for ${input.service.toLowerCase()} (${input.size.toLowerCase()} scope).`,
    `My preliminary inputs: ${input.baseCrewDays} base crew days (${adjusted} adjusted crew days at $650/day), materials ${dollars(input.materialsAtCost)} at cost, other costs ${dollars(input.otherProjectCosts)}.`,
    `Illustrative planning total: ${dollars(total)}. This is not a quote; please confirm the actual scope and pricing on site.`,
  ].join(" ");
}
