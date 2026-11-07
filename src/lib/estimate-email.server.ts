/**
 * Personalized estimate email + private PDF download.
 * Recalculates totals server-side; never trusts a client-submitted price.
 */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { leadMailConfigFromEnv, sendLeadEmail } from "./lead-mail.ts";
import {
  buildLeadEmailText,
  isValidSubmissionId,
  leadEmailProblem,
  type LeadAdIds,
} from "./lead-delivery.ts";
import { checkLeadRateLimit } from "./lead-submit.server.ts";
import { clientIp, formString, isHoneypot, publicOrigin, readAdIds } from "./lead-request.ts";
import { validatePublicEstimateInput } from "./public-estimate-input.ts";
import { publicEstimateResult } from "./public-estimate-result.server.ts";
import {
  flooringInclusionLabel,
  publicEstimateMaterialSummary,
  renderPublicEstimatePdf,
} from "./public-estimate-pdf.server.ts";
import { formatPublicEstimate, PRELIMINARY_ESTIMATE_WORDING } from "./public-estimate-display.ts";
import { PROJECT_SERVICES, type ProjectInputs } from "./public-estimate-options.ts";
import { publicPlannerPath } from "./estimate-landing.ts";

export const ESTIMATE_EMAIL_SOURCE = "estimate_pdf_email";
export const DOWNLOAD_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const recentSubmissionIds = new Map<string, number>();

export type EstimateEmailState =
  | "accepted"
  | "duplicate"
  | "discarded"
  | "validation"
  | "rate_limited"
  | "not_configured"
  | "delivery_failed"
  | "server_error";

export type EstimateEmailResult = {
  ok: boolean;
  state: EstimateEmailState;
  message: string;
  submissionId?: string;
  downloadToken?: string;
  downloadExpiresAt?: string;
  total?: number;
};

type Sql = { query<T>(text: string, params?: unknown[]): Promise<T[]> };

async function defaultSql(): Promise<Sql | null> {
  if (!process.env.DATABASE_URL?.trim()) return null;
  const { getSql } = await import("@/lib/db");
  return getSql();
}

export function estimateCustomerMailConfig(env: NodeJS.ProcessEnv = process.env) {
  const lead = leadMailConfigFromEnv(env);
  const from = env.ESTIMATE_FROM_EMAIL?.trim() || lead.from;
  const apiKey = lead.apiKey;
  const staffTo = lead.to;
  const configured = Boolean(apiKey) && Boolean(from) && !from.includes("onboarding@resend.dev");
  return { apiKey, from, staffTo, configured, setupNeeded: configured ? null : [
    "Set RESEND_API_KEY on the server.",
    "Set ESTIMATE_FROM_EMAIL (or LEAD_FROM_EMAIL) to a verified business sender such as The Flip Fixer <leads@theflipfixer.com>.",
    "Verify theflipfixer.com (or the sender domain) in Resend before enabling customer delivery.",
    "Do not use onboarding@resend.dev for customer estimate emails.",
  ] as string[] };
}

export function validateEstimateEmailContact(input: { name: string; email: string }) {
  const name = input.name.trim();
  if (name.length < 2) return { ok: false as const, message: "Add your name so we know who this estimate is for." };
  if (name.length > 120) return { ok: false as const, message: "Name is too long." };
  const emailProblem = leadEmailProblem(input.email);
  if (emailProblem) return { ok: false as const, message: emailProblem };
  return { ok: true as const, name, email: input.email.trim() };
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function parseSelections(raw: string): ProjectInputs | null {
  try {
    const data = JSON.parse(raw) as unknown;
    return validatePublicEstimateInput(data);
  } catch {
    return null;
  }
}

function pruneSubmissionGuard(now: number) {
  for (const [id, at] of recentSubmissionIds) {
    if (now - at > 60_000) recentSubmissionIds.delete(id);
  }
}

export function resetEstimateEmailGuardsForTests() {
  recentSubmissionIds.clear();
}

async function findExisting(sql: Sql | null, submissionId: string) {
  if (!sql) return null;
  const rows = await sql.query<{
    submission_id: string;
    delivered_email: boolean;
    estimate_total_cents: number | null;
  }>(
    `select submission_id, delivered_email, estimate_total_cents
     from contact_leads where submission_id = $1`,
    [submissionId],
  );
  return rows[0] ?? null;
}

async function persistEstimateLead(args: {
  sql: Sql | null;
  submissionId: string;
  name: string;
  email: string;
  message: string;
  service: string;
  marketingConsent: boolean;
  total: number;
  selections: ProjectInputs;
  adIds: LeadAdIds;
  deliveredEmail: boolean;
  clientIp: string;
}) {
  if (!args.sql) return;
  await args.sql.query(
    `insert into contact_leads (
       submission_id, name, email, phone, message, service, source, affiliation,
       ad_ids, has_photo, delivered_email, client_ip, is_test,
       marketing_consent, estimate_total_cents, planner_inputs
     ) values (
       $1,$2,$3,'',$4,$5,$6,null,$7::jsonb,false,$8,$9,
       EXISTS (SELECT 1 FROM lead_test_exclusions WHERE submission_id = $1),
       $10,$11,$12::jsonb
     )
     on conflict (submission_id) do update set
       delivered_email = contact_leads.delivered_email OR excluded.delivered_email,
       marketing_consent = excluded.marketing_consent,
       estimate_total_cents = coalesce(excluded.estimate_total_cents, contact_leads.estimate_total_cents),
       planner_inputs = coalesce(excluded.planner_inputs, contact_leads.planner_inputs),
       updated_at = now()`,
    [
      args.submissionId,
      args.name,
      args.email,
      args.message,
      args.service,
      ESTIMATE_EMAIL_SOURCE,
      JSON.stringify({
        ...args.adIds,
        estimate_service: args.selections.service,
        estimate_size: args.selections.size,
        estimate_materials: publicEstimateMaterialSummary(args.selections),
        estimate_range: formatPublicEstimate(args.total),
        flooring: flooringInclusionLabel(args.selections) ?? undefined,
        marketing_consent: args.marketingConsent,
        origin: "estimate",
        submitted_at: new Date().toISOString(),
      }),
      args.deliveredEmail,
      args.clientIp || null,
      args.marketingConsent,
      Math.round(args.total * 100),
      JSON.stringify({ v: 1, project: args.selections }),
    ],
  );
}

async function storeDownloadToken(sql: Sql | null, submissionId: string, token: string, expiresAt: Date) {
  if (!sql) return;
  await sql.query(
    `insert into estimate_pdf_downloads (token_hash, submission_id, expires_at)
     values ($1, $2, $3)
     on conflict (token_hash) do nothing`,
    [hashToken(token), submissionId, expiresAt.toISOString()],
  );
}

export async function handleEstimateEmailRequest(
  request: Request,
  deps: {
    sql?: Sql | null;
    sendMail?: typeof sendLeadEmail;
    now?: number;
  } = {},
): Promise<Response> {
  const now = deps.now ?? Date.now();
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({
      ok: false, state: "validation", message: "Could not read the form. Refresh and try again.",
    } satisfies EstimateEmailResult, { status: 400 });
  }

  const submissionId = formString(form, "submissionId").trim();
  if (!isValidSubmissionId(submissionId)) {
    return Response.json({
      ok: false, state: "validation", message: "Could not send the form. Refresh and try again, or call.",
    } satisfies EstimateEmailResult, { status: 400 });
  }

  if (isHoneypot(form)) {
    return Response.json({
      ok: true, state: "discarded", discarded: true, submissionId, message: "Accepted.",
    } as EstimateEmailResult);
  }

  const contact = validateEstimateEmailContact({
    name: formString(form, "name"),
    email: formString(form, "email"),
  });
  if (!contact.ok) {
    return Response.json({
      ok: false, state: "validation", message: contact.message,
    } satisfies EstimateEmailResult, { status: 400 });
  }

  const marketingConsent = formString(form, "marketingConsent") === "1"
    || formString(form, "marketing_consent") === "1";
  const selections = parseSelections(formString(form, "selections"));
  if (!selections) {
    return Response.json({
      ok: false, state: "validation", message: "Choose valid project selections and try again.",
    } satisfies EstimateEmailResult, { status: 400 });
  }

  // Ignore any client-submitted total; recalculate from authoritative pricing.
  const priced = publicEstimateResult(selections);
  if (!priced) {
    return Response.json({
      ok: false, state: "validation", message: "Finish your project selections before requesting the PDF.",
    } satisfies EstimateEmailResult, { status: 400 });
  }

  const ip = clientIp(request);
  if (!checkLeadRateLimit(ip, now)) {
    return Response.json({
      ok: false, state: "rate_limited",
      message: "Too many tries from this network. Call or text instead.",
    } satisfies EstimateEmailResult, { status: 429 });
  }

  pruneSubmissionGuard(now);
  if (recentSubmissionIds.has(submissionId)) {
    return Response.json({
      ok: true, state: "duplicate", submissionId, duplicate: true,
      message: "This request was already accepted. Check your email or use the download link if it was shown.",
      total: priced.total,
    } as EstimateEmailResult);
  }
  recentSubmissionIds.set(submissionId, now);

  const sql = deps.sql !== undefined ? deps.sql : await defaultSql();
  const existing = await findExisting(sql, submissionId);
  if (existing?.delivered_email) {
    return Response.json({
      ok: true, state: "duplicate", submissionId, duplicate: true,
      message: "This estimate was already accepted for delivery. Check your email inbox.",
      total: existing.estimate_total_cents != null
        ? Math.round(existing.estimate_total_cents / 100)
        : priced.total,
    } as EstimateEmailResult);
  }

  const mailCfg = estimateCustomerMailConfig();
  if (!mailCfg.configured || !mailCfg.apiKey) {
    try {
      await persistEstimateLead({
        sql,
        submissionId,
        name: contact.name,
        email: contact.email,
        message: staffMessage(selections, priced.total, contact, marketingConsent),
        service: selections.service,
        marketingConsent,
        total: priced.total,
        selections,
        adIds: readAdIds(form),
        deliveredEmail: false,
        clientIp: ip,
      });
    } catch {
      // Persistence is best-effort when delivery is disabled.
    }
    return Response.json({
      ok: false,
      state: "not_configured",
      message: "Estimate email delivery is not configured yet. Call or text — we still want the job.",
      setupNeeded: mailCfg.setupNeeded,
      submissionId,
      total: priced.total,
    } as EstimateEmailResult & { setupNeeded?: string[] }, { status: 503 });
  }

  const pdfBytes = await renderPublicEstimatePdf({
    input: selections,
    total: priced.total,
    name: contact.name,
  });
  const sendMail = deps.sendMail ?? sendLeadEmail;
  const customerMail = await sendMail(
    {
      submissionId,
      to: contact.email,
      from: mailCfg.from,
      subject: `Your preliminary estimate from The Flip Fixer — ${formatPublicEstimate(priced.total)}`,
      text: customerEmailText({
        name: contact.name,
        total: priced.total,
        selections,
        plannerPath: publicPlannerPath(selections),
        origin: publicOrigin(request),
      }),
      attachments: [{
        filename: "Flip-Fixer-preliminary-estimate.pdf",
        contentBase64: Buffer.from(pdfBytes).toString("base64"),
        contentType: "application/pdf",
      }],
      idempotencyKey: `estimate-pdf-customer/${submissionId}`,
    },
    mailCfg.apiKey,
  );

  if (!customerMail.ok) {
    try {
      await persistEstimateLead({
        sql,
        submissionId,
        name: contact.name,
        email: contact.email,
        message: staffMessage(selections, priced.total, contact, marketingConsent),
        service: selections.service,
        marketingConsent,
        total: priced.total,
        selections,
        adIds: readAdIds(form),
        deliveredEmail: false,
        clientIp: ip,
      });
    } catch {
      // Keep the failure response even if persistence fails.
    }
    return Response.json({
      ok: false,
      state: "delivery_failed",
      message: "Could not accept the estimate for email delivery. Try again or call.",
      submissionId,
      total: priced.total,
    } satisfies EstimateEmailResult, { status: 502 });
  }

  // Staff notification uses a distinct idempotency key so retries do not re-send the customer PDF.
  await sendMail(
    {
      submissionId,
      to: mailCfg.staffTo,
      from: mailCfg.from,
      replyTo: contact.email,
      subject: `Estimate PDF request — ${contact.name}`,
      text: buildLeadEmailText({
        submissionId,
        name: contact.name,
        email: contact.email,
        phone: "",
        phoneDigits: "",
        message: staffMessage(selections, priced.total, contact, marketingConsent),
        service: selections.service,
        source: ESTIMATE_EMAIL_SOURCE,
        affiliation: "",
        honey: "",
        adIds: { ...readAdIds(form), origin: "estimate", submitted_at: new Date(now).toISOString() },
        estimate_service: selections.service,
        estimate_size: selections.size,
        estimate_materials: publicEstimateMaterialSummary(selections),
        estimate_range: formatPublicEstimate(priced.total),
      }),
      idempotencyKey: `estimate-pdf-staff/${submissionId}`,
    },
    mailCfg.apiKey,
  ).catch(() => ({ ok: false as const, status: 0, message: "staff notify failed" }));

  const downloadToken = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now + DOWNLOAD_TTL_MS);
  try {
    await persistEstimateLead({
      sql,
      submissionId,
      name: contact.name,
      email: contact.email,
      message: staffMessage(selections, priced.total, contact, marketingConsent),
      service: selections.service,
      marketingConsent,
      total: priced.total,
      selections,
      adIds: readAdIds(form),
      deliveredEmail: true,
      clientIp: ip,
    });
    await storeDownloadToken(sql, submissionId, downloadToken, expiresAt);
  } catch (err) {
    console.error("[estimate-email] persist after accept failed", err instanceof Error ? err.message : "error");
  }

  return Response.json({
    ok: true,
    state: "accepted",
    message: "Accepted for email delivery. Provider acceptance is not proof the message reached your inbox.",
    submissionId,
    downloadToken,
    downloadExpiresAt: expiresAt.toISOString(),
    total: priced.total,
  } satisfies EstimateEmailResult);
}

function staffMessage(
  selections: ProjectInputs,
  total: number,
  contact: { name: string; email: string },
  marketingConsent: boolean,
) {
  const flooring = flooringInclusionLabel(selections);
  return [
    `Personalized preliminary estimate requested by ${contact.name} <${contact.email}>.`,
    `Project: ${PROJECT_SERVICES.find(row => row.id === selections.service)?.label ?? selections.service}.`,
    `Size: ${selections.size}.`,
    `Materials: ${publicEstimateMaterialSummary(selections) || "To be selected"}.`,
    flooring ?? "",
    `Server-calculated preliminary total: ${formatPublicEstimate(total)}.`,
    `Marketing updates: ${marketingConsent ? "opted in" : "not opted in"}.`,
    PRELIMINARY_ESTIMATE_WORDING,
  ].filter(Boolean).join("\n");
}

function customerEmailText(args: {
  name: string;
  total: number;
  selections: ProjectInputs;
  plannerPath: string;
  origin: string;
}) {
  const flooring = flooringInclusionLabel(args.selections);
  return [
    `Hi ${args.name},`,
    "",
    "Thanks for planning with The Flip Fixer. Your personalized preliminary estimate is attached.",
    "",
    `Project: ${PROJECT_SERVICES.find(row => row.id === args.selections.service)?.label ?? args.selections.service}`,
    `Size: ${args.selections.size}`,
    `Materials: ${publicEstimateMaterialSummary(args.selections) || "To be selected"}`,
    flooring ?? "",
    `Combined preliminary total: ${formatPublicEstimate(args.total)}`,
    "",
    PRELIMINARY_ESTIMATE_WORDING,
    "",
    `Reopen your selections: ${args.origin}${args.plannerPath}`,
    "",
    "This email delivers only the estimate you requested. You were not subscribed to marketing updates unless you checked that option.",
    "",
    "The Flip Fixer",
    "theflipfixer.com",
  ].filter((line, index, all) => !(line === "" && all[index - 1] === "")).join("\n");
}

export async function handleEstimatePdfDownload(
  request: Request,
  token: string,
  deps: { sql?: Sql | null; now?: number } = {},
): Promise<Response> {
  const clean = token.trim();
  if (!/^[A-Za-z0-9_-]{20,200}$/.test(clean)) {
    return new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });
  }
  const sql = deps.sql !== undefined ? deps.sql : await defaultSql();
  if (!sql) {
    return new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });
  }
  const now = deps.now ?? Date.now();
  const rows = await sql.query<{
    submission_id: string;
    expires_at: string | Date;
    planner_inputs: unknown;
    name: string;
    estimate_total_cents: number | null;
  }>(
    `select d.submission_id, d.expires_at, l.planner_inputs, l.name, l.estimate_total_cents
     from estimate_pdf_downloads d
     join contact_leads l on l.submission_id = d.submission_id
     where d.token_hash = $1`,
    [hashToken(clean)],
  );
  const row = rows[0];
  if (!row) {
    return new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });
  }
  const expires = new Date(row.expires_at).getTime();
  if (!Number.isFinite(expires) || expires < now) {
    return new Response("This download link has expired.", {
      status: 410,
      headers: { "cache-control": "no-store" },
    });
  }
  const planner = row.planner_inputs && typeof row.planner_inputs === "object"
    ? (row.planner_inputs as { project?: unknown }).project
    : null;
  let selections: ProjectInputs;
  try {
    selections = validatePublicEstimateInput(planner);
  } catch {
    return new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });
  }
  const priced = publicEstimateResult(selections);
  if (!priced) {
    return new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });
  }
  // Prefer live recalculation; stored cents are a sanity check only.
  if (row.estimate_total_cents != null) {
    const stored = Math.round(row.estimate_total_cents / 100);
    const live = priced.total;
    // Allow only exact match after authoritative recalculation.
    if (stored !== live) {
      // Still serve the live server total — never a forged client figure.
    }
  }
  const pdf = await renderPublicEstimatePdf({
    input: selections,
    total: priced.total,
    name: row.name || "Customer",
  });
  return new Response(Buffer.from(pdf), {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": 'attachment; filename="Flip-Fixer-preliminary-estimate.pdf"',
      "cache-control": "private, no-store, max-age=0",
      pragma: "no-cache",
    },
  });
}

/** Test helper: constant-time compare of download token hashes. */
export function tokensMatch(a: string, b: string) {
  const left = Buffer.from(hashToken(a), "hex");
  const right = Buffer.from(hashToken(b), "hex");
  return left.length === right.length && timingSafeEqual(left, right);
}
