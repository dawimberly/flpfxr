import { encodeStripeForm } from "./stripe-checkout.ts";
import type { LineKind } from "./invoice-parse.ts";

export type DraftInvoiceLine = {
  description: string;
  amountCents: number;
  kind: LineKind;
};

export type InvoiceTaxConfig = {
  laborTaxCode: string | null;
  materialsTaxCode: string | null;
  automaticTax: boolean;
  daysUntilDue: number;
};

export function invoiceTaxConfigFromEnv(env: NodeJS.ProcessEnv = process.env): InvoiceTaxConfig {
  const days = Number(env.STRIPE_INVOICE_DAYS_UNTIL_DUE?.trim() || "30");
  return {
    laborTaxCode: env.STRIPE_TAX_CODE_LABOR?.trim() || null,
    materialsTaxCode: env.STRIPE_TAX_CODE_MATERIALS?.trim() || null,
    automaticTax: env.STRIPE_AUTOMATIC_TAX?.trim().toLowerCase() === "true",
    daysUntilDue: Number.isInteger(days) && days > 0 && days <= 365 ? days : 30,
  };
}

export type DraftInvoiceResult = {
  id: string;
  status: string;
  hostedInvoiceUrl: string | null;
  dashboardUrl: string;
  customerId: string;
};

type StripeRecord = Record<string, unknown>;

async function stripeForm(
  secretKey: string,
  path: string,
  fields: Record<string, string | number | undefined>,
  fetchImpl: typeof fetch,
  idempotencyKey?: string,
): Promise<StripeRecord> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${secretKey}`,
    "Content-Type": "application/x-www-form-urlencoded",
  };
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
  const res = await fetchImpl(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers,
    body: encodeStripeForm(fields),
  });
  const json = (await res.json().catch(() => null)) as StripeRecord | null;
  if (!res.ok) {
    const error = json?.error && typeof json.error === "object" ? (json.error as StripeRecord) : null;
    throw new Error(typeof error?.message === "string" ? error.message : `Stripe returned ${res.status}`);
  }
  return json ?? {};
}

export async function findOrCreateStripeCustomer(args: {
  secretKey: string;
  customerId?: string | null;
  email?: string | null;
  name?: string | null;
  leadId?: string | null;
  fetchImpl?: typeof fetch;
}): Promise<string> {
  const fetchImpl = args.fetchImpl ?? fetch;
  if (args.customerId?.startsWith("cus_")) return args.customerId;
  const email = args.email?.trim();
  if (!email) throw new Error("Pick a lead with an email, or paste a Stripe customer id.");
  const listed = await fetchImpl(
    `https://api.stripe.com/v1/customers?email=${encodeURIComponent(email)}&limit=1`,
    { headers: { Authorization: `Bearer ${args.secretKey}` } },
  );
  const body = (await listed.json().catch(() => null)) as StripeRecord | null;
  if (!listed.ok) {
    const error = body?.error && typeof body.error === "object" ? (body.error as StripeRecord) : null;
    throw new Error(typeof error?.message === "string" ? error.message : "Could not look up the Stripe customer.");
  }
  const data = Array.isArray(body?.data) ? body.data : [];
  const existing = data[0] && typeof data[0] === "object" ? (data[0] as StripeRecord) : null;
  if (typeof existing?.id === "string") return existing.id;
  const created = await stripeForm(
    args.secretKey,
    "customers",
    {
      email,
      name: args.name?.trim() || undefined,
      "metadata[lead_id]": args.leadId || undefined,
    },
    fetchImpl,
    args.leadId ? `stripe-customer/${args.leadId}` : undefined,
  );
  if (typeof created.id !== "string") throw new Error("Stripe did not return a customer.");
  return created.id;
}

/**
 * Creates a draft invoice and attaches lines. Does not finalize or send.
 */
export async function createDraftInvoice(args: {
  secretKey: string;
  customerId: string;
  lines: DraftInvoiceLine[];
  estimateNumber: string | null;
  leadId: string | null;
  tax?: InvoiceTaxConfig;
  idempotencyKey: string;
  fetchImpl?: typeof fetch;
}): Promise<DraftInvoiceResult> {
  const fetchImpl = args.fetchImpl ?? fetch;
  const tax = args.tax ?? invoiceTaxConfigFromEnv();
  if (!args.lines.length) throw new Error("Add at least one line before creating a draft.");
  const invoice = await stripeForm(
    args.secretKey,
    "invoices",
    {
      customer: args.customerId,
      collection_method: "send_invoice",
      auto_advance: "false",
      days_until_due: tax.daysUntilDue,
      pending_invoice_items_behavior: "exclude",
      "metadata[estimate_number]": args.estimateNumber || undefined,
      "metadata[lead_id]": args.leadId || undefined,
      "automatic_tax[enabled]": tax.automaticTax ? "true" : undefined,
    },
    fetchImpl,
    args.idempotencyKey,
  );
  if (typeof invoice.id !== "string") throw new Error("Stripe did not return an invoice.");
  if (invoice.status && invoice.status !== "draft") {
    throw new Error(`Stripe invoice ${invoice.id} is ${String(invoice.status)}, not a draft.`);
  }
  for (const [index, line] of args.lines.entries()) {
    const taxCode = line.kind === "materials" ? tax.materialsTaxCode : tax.laborTaxCode;
    await stripeForm(
      args.secretKey,
      "invoiceitems",
      {
        customer: args.customerId,
        invoice: invoice.id,
        currency: "usd",
        amount: line.amountCents,
        description: line.description.slice(0, 500),
        "metadata[line_kind]": line.kind,
        tax_code: taxCode || undefined,
      },
      fetchImpl,
      `${args.idempotencyKey}/line-${index + 1}`,
    );
  }
  const mode = args.secretKey.startsWith("sk_live") ? "" : "test/";
  return {
    id: invoice.id,
    status: typeof invoice.status === "string" ? invoice.status : "draft",
    hostedInvoiceUrl: typeof invoice.hosted_invoice_url === "string" ? invoice.hosted_invoice_url : null,
    dashboardUrl: `https://dashboard.stripe.com/${mode}invoices/${invoice.id}`,
    customerId: args.customerId,
  };
}
