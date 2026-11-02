import { createHmac, timingSafeEqual } from "node:crypto";

/** Stripe-Signature header check. Rejects stale timestamps and any non-matching v1 signature. */
export function verifyStripeSignature(
  payload: string,
  header: string | null,
  secret: string,
  nowMs = Date.now(),
  toleranceSec = 300,
): boolean {
  if (!header || !secret) return false;
  const parts = header.split(",").map((part) => part.trim()).filter(Boolean);
  const timestamp = parts.find((part) => part.startsWith("t="))?.slice(2);
  if (!timestamp || !/^\d+$/.test(timestamp)) return false;
  const age = Math.abs(nowMs / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > toleranceSec) return false;
  const expectedHex = createHmac("sha256", secret).update(`${timestamp}.${payload}`, "utf8").digest("hex");
  const expected = Buffer.from(expectedHex, "hex");
  const signatures = parts.filter((part) => part.startsWith("v1=")).map((part) => part.slice(3));
  return signatures.some((sig) => {
    if (!/^[0-9a-f]+$/i.test(sig) || sig.length !== expectedHex.length) return false;
    const actual = Buffer.from(sig, "hex");
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  });
}
