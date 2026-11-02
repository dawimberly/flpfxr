export type StripeSessionResult =
  | { ok: true; id: string; url: string | null; paymentStatus: string; status: string }
  | { ok: false; status: number; message: string };

export function encodeStripeForm(fields: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    params.set(key, String(value));
  }
  return params.toString();
}

export async function createCheckoutSession(
  args: {
    secretKey: string;
    amountCents: number;
    submissionId: string;
    customerEmail: string;
    productName: string;
    productDescription: string;
    successUrl: string;
    cancelUrl: string;
    idempotencyKey: string;
  },
  fetchImpl: typeof fetch = fetch,
): Promise<StripeSessionResult> {
  const body = encodeStripeForm({
    mode: "payment",
    success_url: args.successUrl,
    cancel_url: args.cancelUrl,
    client_reference_id: args.submissionId,
    customer_email: args.customerEmail,
    "metadata[lead_id]": args.submissionId,
    "metadata[source]": "detailed_estimate",
    "payment_intent_data[metadata][lead_id]": args.submissionId,
    "payment_intent_data[metadata][source]": "detailed_estimate",
    "line_items[0][quantity]": 1,
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][unit_amount]": args.amountCents,
    "line_items[0][price_data][product_data][name]": args.productName,
    "line_items[0][price_data][product_data][description]": args.productDescription,
  });
  let res: Response;
  try {
    res = await fetchImpl("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${args.secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Idempotency-Key": args.idempotencyKey,
      },
      body,
    });
  } catch (err) {
    return { ok: false, status: 0, message: err instanceof Error ? err.message : "Stripe request failed" };
  }
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  const rec = json && typeof json === "object" ? (json as Record<string, unknown>) : null;
  if (!res.ok) {
    const error = rec?.error && typeof rec.error === "object" ? (rec.error as Record<string, unknown>) : null;
    const message = typeof error?.message === "string" ? error.message : `Stripe returned ${res.status}`;
    return { ok: false, status: res.status, message };
  }
  if (!rec || typeof rec.id !== "string") {
    return { ok: false, status: res.status, message: "Stripe did not return a checkout session" };
  }
  return {
    ok: true,
    id: rec.id,
    url: typeof rec.url === "string" ? rec.url : null,
    paymentStatus: typeof rec.payment_status === "string" ? rec.payment_status : "",
    status: typeof rec.status === "string" ? rec.status : "",
  };
}
