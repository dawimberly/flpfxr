import { createServerFn } from "@tanstack/react-start";
import { invoiceLinesFromReview, parseEstimateText, type LineKind } from "./invoice-parse.ts";

export type InvoiceLeadMatch = {
  submissionId: string;
  name: string;
  email: string | null;
  phone: string;
  paid: boolean;
  feeCents: number;
};

async function requireStaff() {
  const { requireUserId } = await import("./auth/verify.server");
  await requireUserId();
}

export const parseUploadedEstimate = createServerFn({ method: "POST" })
  .validator((data: { filename: string; pdfBase64: string }) => ({
    filename: String(data?.filename ?? "estimate.pdf").slice(0, 180),
    pdfBase64: String(data?.pdfBase64 ?? ""),
  }))
  .handler(async ({ data }) => {
    await requireStaff();
    const bytes = Buffer.from(data.pdfBase64, "base64");
    if (!bytes.length || bytes.length > 8_000_000) {
      throw new Error("Upload one PDF under 8 MB.");
    }
    const { extractPdfRows } = await import("./invoice-pdf");
    const rows = await extractPdfRows(bytes);
    return parseEstimateText(rows.join("\n"), data.filename);
  });

export const searchInvoiceLeads = createServerFn({ method: "GET" })
  .validator((data: { query: string }) => ({ query: String(data?.query ?? "").trim().slice(0, 80) }))
  .handler(async ({ data }): Promise<InvoiceLeadMatch[]> => {
    await requireStaff();
    if (data.query.length < 2) return [];
    const { getSql } = await import("./db");
    const sql = await getSql();
    const like = `%${data.query.replace(/[%_]/g, "")}%`;
    const digits = data.query.replace(/\D/g, "");
    const rows = await sql.query<{
      submission_id: string;
      name: string;
      email: string | null;
      phone: string;
      estimate_fee_status: string;
      estimate_fee_cents: number | null;
    }>(
      `select submission_id, name, email, phone, estimate_fee_status, estimate_fee_cents
       from contact_leads
       where name ilike $1 or email ilike $1 or ($2 <> '' and phone like $3)
       order by created_at desc
       limit 8`,
      [like, digits, `%${digits}%`],
    );
    return rows.map((row) => ({
      submissionId: row.submission_id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      paid: row.estimate_fee_status === "paid",
      feeCents: Number(row.estimate_fee_cents ?? 0),
    }));
  });

export const createEstimateInvoiceDraft = createServerFn({ method: "POST" })
  .validator((data: {
    estimateNumber: string | null;
    lines: { description: string; amountCents: number; kind: LineKind; included: boolean }[];
    depositPercent: number | null;
    leadId: string | null;
    stripeCustomerId: string | null;
  }) => ({
    estimateNumber: data?.estimateNumber ? String(data.estimateNumber).slice(0, 40) : null,
    lines: Array.isArray(data?.lines) ? data.lines.slice(0, 80).map((line) => ({
      description: String(line?.description ?? "").trim().slice(0, 500),
      amountCents: Math.round(Number(line?.amountCents)),
      kind: line?.kind === "materials" ? "materials" as const : "labor" as const,
      included: line?.included !== false,
    })) : [],
    depositPercent: data?.depositPercent === 50 ? 50 : null,
    leadId: data?.leadId ? String(data.leadId).slice(0, 80) : null,
    stripeCustomerId: data?.stripeCustomerId ? String(data.stripeCustomerId).trim().slice(0, 80) : null,
  }))
  .handler(async ({ data }) => {
    await requireStaff();
    const secret = process.env.STRIPE_SECRET_KEY?.trim();
    if (!secret) throw new Error("STRIPE_SECRET_KEY is not set.");
    let lead: InvoiceLeadMatch | null = null;
    if (data.leadId) {
      const { getSql } = await import("./db");
      const sql = await getSql();
      const rows = await sql.query<{
        submission_id: string;
        name: string;
        email: string | null;
        phone: string;
        estimate_fee_status: string;
        estimate_fee_cents: number | null;
      }>(
        `select submission_id, name, email, phone, estimate_fee_status, estimate_fee_cents
         from contact_leads where submission_id = $1`,
        [data.leadId],
      );
      const row = rows[0];
      if (!row) throw new Error("That lead is not in the log.");
      lead = {
        submissionId: row.submission_id,
        name: row.name,
        email: row.email,
        phone: row.phone,
        paid: row.estimate_fee_status === "paid",
        feeCents: Number(row.estimate_fee_cents ?? 0),
      };
    }
    const { readDetailedEstimateFeeCents } = await import("./estimate-fee");
    const creditCents = lead?.paid ? (lead.feeCents > 0 ? lead.feeCents : readDetailedEstimateFeeCents()) : 0;
    const lines = invoiceLinesFromReview({
      lines: data.lines,
      depositPercent: data.depositPercent,
      creditCents,
    });
    const { createDraftInvoice, findOrCreateStripeCustomer, invoiceTaxConfigFromEnv } = await import("./stripe-invoice");
    const customerId = await findOrCreateStripeCustomer({
      secretKey: secret,
      customerId: data.stripeCustomerId,
      email: lead?.email,
      name: lead?.name,
      leadId: lead?.submissionId,
    });
    return createDraftInvoice({
      secretKey: secret,
      customerId,
      lines,
      estimateNumber: data.estimateNumber,
      leadId: lead?.submissionId ?? null,
      tax: invoiceTaxConfigFromEnv(),
      idempotencyKey: `draft-invoice/${data.estimateNumber ?? "none"}/${lead?.submissionId ?? customerId}/${data.depositPercent ?? 100}/${lines.map((line) => line.amountCents).join(".")}`.slice(0, 200),
    });
  });
