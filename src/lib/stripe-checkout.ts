/** Checkout Sessions API for the embedded form. Dahlia or later. */
export const STRIPE_API_VERSION = "2026-03-25.dahlia";

export type StripeSessionResult =
  | { ok: true; id: string; clientSecret: string | null; url: string | null; paymentStatus: string; status: string }
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
    returnUrl: string;
    idempotencyKey: string;
    /** Catalog price, such as Itemized Job Estimate (PDF). Omit to use price_data. */
    priceId?: string;
  },
  fetchImpl: typeof fetch = fetch,
): Promise<StripeSessionResult> {
  const lineItem = args.priceId
    ? {
        "line_items[0][price]": args.priceId,
        "line_items[0][quantity]": 1,
      }
    : {
        "line_items[0][quantity]": 1,
        "line_items[0][price_data][currency]": "usd",
        "line_items[0][price_data][unit_amount]": args.amountCents,
        "line_items[0][price_data][product_data][name]": args.productName,
        "line_items[0][price_data][product_data][description]": args.productDescription,
      };
  const body = encodeStripeForm({
    mode: "payment",
    ui_mode: "form",
    return_url: args.returnUrl,
    billing_address_collection: "auto",
    "phone_number_collection[enabled]": "false",
    "automatic_tax[enabled]": "false",
    submit_type: "auto",
    integration_identifier: "custom_embedded_web_0001",
    client_reference_id: args.submissionId,
    customer_email: args.customerEmail,
    "metadata[lead_id]": args.submissionId,
    "metadata[source]": "detailed_estimate",
    "payment_intent_data[metadata][lead_id]": args.submissionId,
    "payment_intent_data[metadata][source]": "detailed_estimate",
    ...lineItem,
  });
  let res: Response;
  try {
    res = await fetchImpl("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${args.secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Idempotency-Key": args.idempotencyKey,
        "Stripe-Version": STRIPE_API_VERSION,
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
    clientSecret: typeof rec.client_secret === "string" ? rec.client_secret : null,
    url: typeof rec.url === "string" ? rec.url : null,
    paymentStatus: typeof rec.payment_status === "string" ? rec.payment_status : "",
    status: typeof rec.status === "string" ? rec.status : "",
  };
}
