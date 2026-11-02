export const DEFAULT_DETAILED_ESTIMATE_FEE_CENTS = 3500;
const MIN_FEE_CENTS = 50;
const MAX_FEE_CENTS = 100_000;

export function formatUsdFromCents(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

/** Unset uses $35. A present but invalid value is a configuration error, not a silent fallback. */
export function readDetailedEstimateFeeCents(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.DETAILED_ESTIMATE_FEE_CENTS?.trim();
  if (!raw) return DEFAULT_DETAILED_ESTIMATE_FEE_CENTS;
  if (!/^\d+$/.test(raw)) {
    throw new Error("DETAILED_ESTIMATE_FEE_CENTS must be a whole number of cents");
  }
  const cents = Number(raw);
  if (cents < MIN_FEE_CENTS || cents > MAX_FEE_CENTS) {
    throw new Error("DETAILED_ESTIMATE_FEE_CENTS must be between 50 and 100000");
  }
  return cents;
}

export function publicEstimateOffer(env: NodeJS.ProcessEnv = process.env): {
  feeCents: number | null;
  feeLabel: string | null;
} {
  try {
    const feeCents = readDetailedEstimateFeeCents(env);
    return { feeCents, feeLabel: formatUsdFromCents(feeCents) };
  } catch {
    return { feeCents: null, feeLabel: null };
  }
}
