/**
 * Free inquiry and paid labor-estimate checkout.
 * The webhook is the only place a lead is marked paid.
 */
import { catalogRedirectUrl } from "./catalog-gate.ts";
import { readDetailedEstimateFeeCents } from "./estimate-fee.ts";
import { buildLaborDocument, laborDocumentPlainText } from "./labor-estimate.ts";
import { renderLaborEstimatePdf } from "./labor-estimate-pdf.ts";
import { validateLeadPhoto } from "./lead-delivery.ts";
import { leadMailConfigFromEnv, sendLeadEmail } from "./lead-mail.ts";
import { checkLeadRateLimit, handleLeadFormData } from "./lead-submit.server.ts";
import {
  clientIp,
  formString,
  isHoneypot,
  publicOrigin,
  readAdIds,
  requireContact,
} from "./lead-request.ts";
import {
  parseStoredPlanner,
  plannerAnswers,
  storedPlannerFromUnknown,
  type StoredPlanner,
} from "./planner-form.ts";
import { PROJECT_SERVICES } from "./public-estimate-options.ts";
import { createCheckoutSession } from "./stripe-checkout.ts";
import { verifyStripeSignature } from "./stripe-signature.ts";
import { CATALOG_BROWSE_NOTE, DESIGNER_MATERIALS_NOTE, FEE_CREDIT_NOTE } from "./offer-copy.ts";

export const DETAILED_SOURCE = "detailed_estimate";
export const INQUIRY_SOURCE = "free_inquiry";

type Sql = { query<T>(text: string, params?: unknown[]): Promise<T[]> };

export type PaidLead = {
  submissionId: string;
  name: string;
  email: string;
  phone: string;
  feeCents: number;
  status: "checkout" | "paid" | "none";
  sessionId: string | null;
  paymentIntent: string | null;
  planner: StoredPlanner | null;
  customerNotified: boolean;
  staffNotified: boolean;
  hasPhoto: boolean;
};

async function defaultSql(): Promise<Sql> {
  const { getSql } = await import("@/lib/db");
  return getSql();
}

function mapLead(row: Record<string, unknown> | undefined): PaidLead | null {
  if (!row) return null;
  const status = row.estimate_fee_status;
  return {
    submissionId: String(row.submission_id),
    name: String(row.name ?? ""),
    email: String(row.email ?? ""),
    phone: String(row.phone ?? ""),
    feeCents: Number(row.estimate_fee_cents ?? 0),
    status: status === "paid" || status === "checkout" ? status : "none",
    sessionId: typeof row.stripe_checkout_session_id === "string" ? row.stripe_checkout_session_id : null,
    paymentIntent: typeof row.stripe_payment_intent_id === "string" ? row.stripe_payment_intent_id : null,
    planner: storedPlannerFromUnknown(row.planner_inputs),
    customerNotified: Boolean(row.customer_notified_at),
    staffNotified: Boolean(row.estimate_fee_notified_at),
    hasPhoto: Boolean(row.has_photo),
  };
}

const LEAD_SELECT = `submission_id, name, email, phone, estimate_fee_cents, estimate_fee_status,
  stripe_checkout_session_id, stripe_payment_intent_id, planner_inputs,
  customer_notified_at, estimate_fee_notified_at, has_photo`;

export function decidePayment(
  lead: PaidLead | null,
  payment: { sessionId: string; amountCents: number | null; currency: string },
): "missing" | "mismatch" | "already" | "pay" {
  if (!lead) return "missing";
  if (payment.currency !== "usd" || payment.amountCents == null || payment.amountCents !== lead.feeCents) return "mismatch";
  if (lead.sessionId && lead.sessionId !== payment.sessionId) return "mismatch";
  if (lead.status === "paid") return "already";
  return "pay";
}

export function readStripeEvent(body: unknown):
  | { ignore: true }
  | { ignore: false; sessionId: string; leadId: string; amountCents: number | null; currency: string; paymentStatus: string; paymentIntent: string | null }
  | null {
  if (!body || typeof body !== "object") return null;
  const event = body as Record<string, unknown>;
  const type = typeof event.type === "string" ? event.type : "";
  if (type !== "checkout.session.completed" && type !== "checkout.session.async_payment_succeeded") {
    return { ignore: true };
  }
  const data = event.data && typeof event.data === "object" ? (event.data as Record<string, unknown>) : null;
  const session = data?.object && typeof data.object === "object" ? (data.object as Record<string, unknown>) : null;
  if (!session || session.object !== "checkout.session" || typeof session.id !== "string") return null;
  const metadata = session.metadata && typeof session.metadata === "object" ? (session.metadata as Record<string, unknown>) : {};
  const leadId = typeof metadata.lead_id === "string" && metadata.lead_id
    ? metadata.lead_id
    : typeof session.client_reference_id === "string"
      ? session.client_reference_id
      : "";
  if (!leadId) return null;
  const intent = session.payment_intent;
  const paymentIntent = typeof intent === "string"
    ? intent
    : intent && typeof intent === "object" && typeof (intent as Record<string, unknown>).id === "string"
      ? String((intent as Record<string, unknown>).id)
      : null;
  return {
    ignore: false,
    sessionId: session.id,
    leadId,
    amountCents: typeof session.amount_total === "number" ? session.amount_total : null,
    currency: typeof session.currency === "string" ? session.currency : "",
    paymentStatus: typeof session.payment_status === "string" ? session.payment_status : "",
    paymentIntent,
  };
}

function inquirySummary(planner: StoredPlanner | null, note: string): string {
  if (!planner) {
    return `Free inquiry from the project planner.\n${note}`.trim();
  }
  const label = PROJECT_SERVICES.find((row) => row.id === planner.project.service)?.label ?? planner.project.service;
  const doc = buildLaborDocument(planner, false);
  return [
    "Free inquiry. Please call this customer back.",
    `Project: ${label}. Size: ${planner.project.size}.`,
    doc.kind === "itemized" && doc.rangeLabel ? `Free planning range on the site: ${doc.rangeLabel}.` : "",
    planner.address ? `Address: ${planner.address}` : "",
    planner.note ? `Note: ${planner.note}` : "",
    DESIGNER_MATERIALS_NOTE,
  ].filter(Boolean).join("\n");
}

async function fileToBase64(file: File): Promise<string> {
  return Buffer.from(await file.arrayBuffer()).toString("base64");
}

export async function handleFreeInquiry(
  form: FormData,
  request: Request,
  deps: {
    handleLead?: typeof handleLeadFormData;
    sendMail?: typeof sendLeadEmail;
    savePlanner?: (submissionId: string, planner: StoredPlanner) => Promise<void>;
  } = {},
): Promise<Response> {
  if (isHoneypot(form)) {
    return Response.json({ ok: true, discarded: true, submissionId: formString(form, "submissionId") });
  }
  const parsed = parseStoredPlanner(form);
  const answers = plannerAnswers(form);
  const message = parsed.ok
    ? inquirySummary(parsed.planner, answers.note)
    : answers.note.trim().length >= 5
      ? `Free inquiry from the project planner.\n${answers.note}`
      : "";
  if (!message) {
    return Response.json(
      { ok: false, code: "validation", message: parsed.ok ? "Tell us a bit about the job." : parsed.message },
      { status: 400 },
    );
  }
  const contact = requireContact(form, message);
  if (!contact.ok) return Response.json({ ok: false, code: "validation", message: contact.message }, { status: 400 });

  const next = new FormData();
  next.set("submissionId", contact.submissionId);
  next.set("name", contact.name);
  next.set("phone", contact.phone);
  next.set("email", contact.email);
  next.set("message", message);
  next.set("Source", INQUIRY_SOURCE);
  next.set("Job", parsed.ok ? parsed.planner.project.service : formString(form, "service"));
  for (const [key, value] of Object.entries(readAdIds(form))) next.set(key, value);
  const photo = form.get("attachment");
  if (photo instanceof File && photo.size > 0) next.set("attachment", photo);

  const lead = await (deps.handleLead ?? handleLeadFormData)(next, request);
  const body = (await lead.json()) as Record<string, unknown>;
  if (body.ok !== true || body.discarded === true) return Response.json(body, { status: lead.status });

  if (parsed.ok) {
    try {
      if (deps.savePlanner) await deps.savePlanner(contact.submissionId, parsed.planner);
      else {
        const sql = await defaultSql();
        await sql.query(
          "update contact_leads set planner_inputs = $2::jsonb, updated_at = now() where submission_id = $1",
          [contact.submissionId, JSON.stringify(parsed.planner)],
        );
      }
    } catch (err) {
      console.error("[inquiry] planner save failed", err instanceof Error ? err.message : "error");
    }
  }

  const mailCfg = leadMailConfigFromEnv();
  if (mailCfg.apiKey) {
    const send = deps.sendMail ?? sendLeadEmail;
    const confirm = await send(
      {
        submissionId: contact.submissionId,
        to: contact.email,
        from: mailCfg.from,
        replyTo: mailCfg.to,
        subject: "The Flip Fixer — we have your inquiry",
        text: [
          `Thanks ${contact.name}. We saved your inquiry and will call you back.`,
          "The planning range on the site is free. You do not owe anything for this inquiry.",
          "",
          message,
          "",
          "Call (210) 436-9117 if you want to talk sooner.",
        ].join("\n"),
        idempotencyKey: `free-inquiry-customer/${contact.submissionId}`,
      },
      mailCfg.apiKey,
    );
    if (!confirm.ok) console.error("[inquiry] customer confirmation failed", confirm.message);
  }

  return Response.json({ ok: true, submissionId: contact.submissionId });
}

function checkoutMessage(planner: StoredPlanner): string {
  const doc = buildLaborDocument(planner, false);
  return [
    "Paid itemized job estimate requested.",
    `Project: ${doc.projectLabel}. Size: ${doc.size}.`,
    doc.rangeLabel ? `Free planning range on the site: ${doc.rangeLabel}.` : "Custom project. We write the estimate after a walkthrough.",
    planner.address ? `Address: ${planner.address}` : "",
    planner.note ? `Note: ${planner.note}` : "",
    FEE_CREDIT_NOTE,
    DESIGNER_MATERIALS_NOTE,
  ].filter(Boolean).join("\n");
}

export async function handleEstimateCheckout(
  form: FormData,
  request: Request,
  deps: {
    sql?: Sql;
    createSession?: typeof createCheckoutSession;
    sendMail?: typeof sendLeadEmail;
    now?: number;
  } = {},
): Promise<Response> {
  if (isHoneypot(form)) {
    return Response.json({ ok: true, discarded: true, submissionId: formString(form, "submissionId") });
  }
  const ip = clientIp(request);
  if (!checkLeadRateLimit(ip, deps.now)) {
    return Response.json(
      { ok: false, code: "rate_limited", message: "Too many tries from this network. Call or text instead." },
      { status: 429 },
    );
  }
  const parsed = parseStoredPlanner(form);
  if (!parsed.ok) return Response.json({ ok: false, code: "validation", message: parsed.message }, { status: 400 });
  const message = checkoutMessage(parsed.planner);
  const contact = requireContact(form, message);
  if (!contact.ok) return Response.json({ ok: false, code: "validation", message: contact.message }, { status: 400 });

  let feeCents: number;
  try {
    feeCents = readDetailedEstimateFeeCents();
  } catch {
    return Response.json(
      { ok: false, code: "not_configured", message: "The paid estimate is not available right now. Send a free inquiry or call." },
      { status: 503 },
    );
  }
  const secret = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secret) {
    return Response.json(
      { ok: false, code: "not_configured", message: "The paid estimate is not available right now. Send a free inquiry or call." },
      { status: 503 },
    );
  }

  const photoField = form.get("attachment");
  const photo = photoField instanceof File ? photoField : null;
  const photoCheck = validateLeadPhoto(photo);
  if (!photoCheck.ok) return Response.json({ ok: false, code: "validation", message: photoCheck.message }, { status: 400 });

  const sql = deps.sql ?? (await defaultSql());
  const rows = await sql.query<Record<string, unknown>>(
    `insert into contact_leads (
       submission_id, name, email, phone, message, service, source, affiliation,
       ad_ids, has_photo, delivered_email, client_ip, is_test,
       estimate_fee_cents, estimate_fee_status, planner_inputs
     ) values (
       $1,$2,$3,$4,$5,$6,$7,null,$8::jsonb,$9,false,$10,
       EXISTS (SELECT 1 FROM lead_test_exclusions WHERE submission_id = $1),
       $11,'checkout',$12::jsonb
     )
     on conflict (submission_id) do update set
       name = excluded.name,
       email = excluded.email,
       phone = excluded.phone,
       message = excluded.message,
       service = excluded.service,
       has_photo = contact_leads.has_photo OR excluded.has_photo,
       planner_inputs = excluded.planner_inputs,
       estimate_fee_cents = case when contact_leads.estimate_fee_status = 'paid' then contact_leads.estimate_fee_cents else excluded.estimate_fee_cents end,
       estimate_fee_status = case when contact_leads.estimate_fee_status = 'paid' then contact_leads.estimate_fee_status else 'checkout' end,
       updated_at = now()
     returning ${LEAD_SELECT}`,
    [
      contact.submissionId,
      contact.name,
      contact.email,
      contact.phoneDigits,
      message,
      parsed.planner.project.service,
      DETAILED_SOURCE,
      JSON.stringify(readAdIds(form)),
      Boolean(photoCheck.file),
      ip || null,
      feeCents,
      JSON.stringify(parsed.planner),
    ],
  );
  const lead = mapLead(rows[0]);
  const origin = publicOrigin(request);
  if (lead?.status === "paid" && lead.sessionId) {
    return Response.json({
      ok: true,
      kind: "success",
      url: `${origin}/estimate/paid?session_id=${encodeURIComponent(lead.sessionId)}`,
    });
  }

  const service = parsed.planner.project.service === "custom" ? "other" : parsed.planner.project.service;
  const session = await (deps.createSession ?? createCheckoutSession)({
    secretKey: secret,
    amountCents: feeCents,
    submissionId: contact.submissionId,
    customerEmail: contact.email,
    productName: "Itemized job estimate",
    productDescription: "Materials are named without prices and finalized with the designer. Credited toward the job if you book.",
    successUrl: `${origin}/estimate/paid?session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${origin}/estimate?checkout=cancelled&service=${encodeURIComponent(service)}&size=${encodeURIComponent(parsed.planner.project.size.toLowerCase())}`,
    idempotencyKey: `detailed-estimate/${contact.submissionId}`,
  });
  if (!session.ok) {
    console.error("[checkout] stripe session failed", session.message);
    return Response.json(
      { ok: false, code: "delivery_failed", message: "Could not start checkout. Call or text instead." },
      { status: 502 },
    );
  }
  await sql.query(
    "update contact_leads set stripe_checkout_session_id = $2, updated_at = now() where submission_id = $1 and estimate_fee_status <> 'paid'",
    [contact.submissionId, session.id],
  );

  const mailCfg = leadMailConfigFromEnv();
  if (mailCfg.apiKey && photoCheck.file) {
    const send = deps.sendMail ?? sendLeadEmail;
    await send(
      {
        submissionId: contact.submissionId,
        to: mailCfg.to,
        from: mailCfg.from,
        replyTo: contact.email,
        subject: `The Flip Fixer — estimate photo (${contact.name})`,
        text: `${contact.name} started a paid job estimate and attached a photo.\nPhone: ${contact.phone}\nEmail: ${contact.email}\nLead: ${contact.submissionId}`,
        attachments: [{
          filename: photoCheck.file.name || "project-photo.jpg",
          contentBase64: await fileToBase64(photoCheck.file),
          contentType: photoCheck.file.type || undefined,
        }],
        idempotencyKey: `detailed-estimate-photo/${contact.submissionId}`,
      },
      mailCfg.apiKey,
    );
  }

  if (session.paymentStatus === "paid" || !session.url) {
    return Response.json({
      ok: true,
      kind: "success",
      url: `${origin}/estimate/paid?session_id=${encodeURIComponent(session.id)}`,
    });
  }
  return Response.json({ ok: true, kind: "stripe", url: session.url });
}

async function notifyPaid(lead: PaidLead, deps: { sendMail?: typeof sendLeadEmail; sql?: Sql }) {
  const mailCfg = leadMailConfigFromEnv();
  if (!mailCfg.apiKey) return { ok: false as const, message: "Lead email is not configured." };
  const send = deps.sendMail ?? sendLeadEmail;
  const sql = deps.sql ?? (await defaultSql());
  const planner = lead.planner;
  const doc = planner ? buildLaborDocument(planner, lead.hasPhoto) : null;
  const catalogUrl = catalogRedirectUrl();
  const feeLabel = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(lead.feeCents / 100);
  const packet = doc
    ? laborDocumentPlainText(doc, { name: lead.name, phone: lead.phone, email: lead.email, feeLabel, catalogUrl })
    : `${lead.name} paid for a job estimate. Project details were not stored. Call them.\n${DESIGNER_MATERIALS_NOTE}`;
  let pdf: Uint8Array | null = null;
  if (doc && planner) {
    pdf = await renderLaborEstimatePdf({
      document: doc,
      name: lead.name,
      phone: lead.phone,
      email: lead.email,
      feeLabel,
      catalogUrl,
      submissionId: lead.submissionId,
    });
  }
  const attachment = pdf
    ? [{ filename: "Flip-Fixer-job-estimate.pdf", contentBase64: Buffer.from(pdf).toString("base64"), contentType: "application/pdf" }]
    : undefined;

  if (!lead.customerNotified && lead.email) {
    const customer = await send(
      {
        submissionId: lead.submissionId,
        to: lead.email,
        from: mailCfg.from,
        replyTo: mailCfg.to,
        subject: "Your Flip Fixer job estimate",
        text: [
          `Thanks ${lead.name}. Your itemized job estimate is attached.`,
          CATALOG_BROWSE_NOTE,
          catalogUrl,
          "",
          packet,
        ].join("\n"),
        attachments: attachment,
        idempotencyKey: `detailed-estimate-customer/${lead.submissionId}`,
      },
      mailCfg.apiKey,
    );
    if (!customer.ok) return customer;
    await sql.query("update contact_leads set customer_notified_at = now(), updated_at = now() where submission_id = $1", [lead.submissionId]);
    lead.customerNotified = true;
  }
  if (!lead.staffNotified) {
    const staff = await send(
      {
        submissionId: lead.submissionId,
        to: mailCfg.to,
        from: mailCfg.from,
        replyTo: lead.email || undefined,
        subject: `The Flip Fixer — paid job estimate (${lead.name})`,
        text: [
          "Paid job estimate. Please call this customer.",
          `Name: ${lead.name}`,
          `Phone: ${lead.phone}`,
          `Email: ${lead.email || "(none)"}`,
          `Lead: ${lead.submissionId}`,
          `Fee: ${feeLabel}. ${FEE_CREDIT_NOTE}`,
          DESIGNER_MATERIALS_NOTE,
          lead.hasPhoto ? "A photo was emailed when they started checkout." : "",
          "",
          packet,
        ].filter(Boolean).join("\n"),
        attachments: attachment,
        idempotencyKey: `detailed-estimate-staff/${lead.submissionId}`,
      },
      mailCfg.apiKey,
    );
    if (!staff.ok) return staff;
    await sql.query(
      "update contact_leads set estimate_fee_notified_at = now(), delivered_email = true, updated_at = now() where submission_id = $1",
      [lead.submissionId],
    );
  }
  return { ok: true as const };
}

export async function handleStripeWebhook(
  request: Request,
  deps: { sql?: Sql; sendMail?: typeof sendLeadEmail; now?: number } = {},
): Promise<Response> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) return Response.json({ ok: false }, { status: 503 });
  const payload = await request.text();
  if (!verifyStripeSignature(payload, request.headers.get("stripe-signature"), secret, deps.now)) {
    return Response.json({ ok: false }, { status: 400 });
  }
  let json: unknown;
  try {
    json = JSON.parse(payload);
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }
  const event = readStripeEvent(json);
  if (!event) return Response.json({ ok: false }, { status: 400 });
  if (event.ignore) return Response.json({ ok: true, ignored: true });
  if (event.paymentStatus !== "paid") return Response.json({ ok: true, pending: true });

  const sql = deps.sql ?? (await defaultSql());
  const found = mapLead((await sql.query<Record<string, unknown>>(
    `select ${LEAD_SELECT} from contact_leads where submission_id = $1`,
    [event.leadId],
  ))[0]);
  const decision = decidePayment(found, event);
  if (decision === "missing") return Response.json({ ok: false }, { status: 500 });
  if (decision === "mismatch") {
    const mailCfg = leadMailConfigFromEnv();
    if (mailCfg.apiKey) {
      const send = deps.sendMail ?? sendLeadEmail;
      const mail = await send(
        {
          submissionId: event.leadId,
          to: mailCfg.to,
          from: mailCfg.from,
          subject: "The Flip Fixer — estimate payment needs a look",
          text: `A Stripe payment for lead ${event.leadId} did not match the fee or checkout on file. Session ${event.sessionId}. Check Stripe before treating it as paid.`,
          idempotencyKey: `detailed-estimate-mismatch/${event.leadId}`,
        },
        mailCfg.apiKey,
      );
      if (!mail.ok) return Response.json({ ok: false }, { status: 500 });
    }
    return Response.json({ ok: true, mismatch: true });
  }
  if (decision === "pay" && found) {
    const saved = mapLead((await sql.query<Record<string, unknown>>(
      `update contact_leads set
         estimate_fee_status = 'paid',
         estimate_fee_paid_at = coalesce(estimate_fee_paid_at, now()),
         stripe_checkout_session_id = $2,
         stripe_payment_intent_id = coalesce($3, stripe_payment_intent_id),
         updated_at = now()
       where submission_id = $1 and estimate_fee_status <> 'paid'
       returning ${LEAD_SELECT}`,
      [event.leadId, event.sessionId, event.paymentIntent],
    ))[0]) ?? { ...found, status: "paid" as const, sessionId: event.sessionId, paymentIntent: event.paymentIntent };
    const mailed = await notifyPaid(saved, { ...deps, sql });
    if (!mailed.ok) return Response.json({ ok: false }, { status: 500 });
    return Response.json({ ok: true, paid: true });
  }
  if (found) {
    const mailed = await notifyPaid(found, { ...deps, sql });
    if (!mailed.ok) return Response.json({ ok: false }, { status: 500 });
  }
  return Response.json({ ok: true, paid: true });
}

export async function lookupEstimatePayment(sessionId: string, deps: { sql?: Sql } = {}) {
  if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId) || sessionId.length > 255) {
    return { status: "missing" as const, catalogUrl: null as string | null };
  }
  try {
    const sql = deps.sql ?? (await defaultSql());
    const lead = mapLead((await sql.query<Record<string, unknown>>(
      `select ${LEAD_SELECT} from contact_leads where stripe_checkout_session_id = $1`,
      [sessionId],
    ))[0]);
    if (!lead) return { status: "missing" as const, catalogUrl: null };
    if (lead.status === "paid") return { status: "paid" as const, catalogUrl: catalogRedirectUrl() };
    return { status: "pending" as const, catalogUrl: null };
  } catch {
    return { status: "pending" as const, catalogUrl: null };
  }
}
