/** Paid checkout stays off unless the value is "true" after trim and lowercasing. */
export function paidEstimateEnabled(value: string | undefined | null): boolean {
  return value?.trim().toLowerCase() === "true";
}
