/**
 * Personalized estimate email + private PDF download.
 * Recalculates totals server-side; never trusts a client-submitted price.
 * Abuse limits and submission snapshots are durable in Postgres when available.
 */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { leadMailConfigFromEnv, sendLeadEmail } from "./lead-mail.ts";
import {
  buildLeadEmailText,
  isValidSubmissionId,
  leadEmailProblem,
  type LeadAdIds,
} from "./lead-delivery.ts";
import { clientIp, formString, isHoneypot, readAdIds } from "./lead-request.ts";
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
import { SITE } from "./site.ts";

export const ESTIMATE_EMAIL_SOURCE = "estimate_pdf_email";
export const DOWNLOAD_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const MAX_PDF_DOWNLOADS = 25;
export const ABUSE_LIMITS = {
  /** Completed or attempted estimate-email submits per recipient email per hour. */
  emailPerHour: 3,
  /** Submits per client IP per 10 minutes. */
  ipPerWindow: 5,
  ipWindowMs: 10 * 60 * 1000,
  /** Global estimate-email submits per hour (all instances). */
  globalPerHour: 120,
  /** PDF downloads per token IP per hour. */
  downloadIpPerHour: 30,
} as const;

/** Server-side setup notes — never returned to browsers. */
export const ESTIMATE_EMAIL_SETUP_NOTES = [
  "Set RESEND_API_KEY on the server.",
  "Set ESTIMATE_FROM_EMAIL (or LEAD_FROM_EMAIL) to a verified business sender such as The Flip Fixer <leads@theflipfixer.com>.",
  "Verify theflipfixer.com (or the sender domain) in Resend before enabling customer delivery.",
  "Do not use onboarding@resend.dev for customer estimate emails.",
  "Set ESTIMATE_EMAIL_DELIVERY=1 only after verified sender, abuse-store readiness, and owner privacy approval.",
  "An API key alone does not prove the sender is verified or that delivery may be enabled.",
] as const;

export type EstimateEmailState =
  | "accepted"
  | "duplicate"
  | "discarded"
  | "validation"
  | "conflict"
  | "rate_limited"
  | "unavailable"
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
  available?: boolean;
};

export type EstimateEmailAvailability = {
  available: boolean;
  state: "available" | "unavailable";
  message: string;
};

type Sql = { query<T>(text: string, params?: unknown[]): Promise<T[]> };

type StoredLead = {
  submission_id: string;
  name: string;
  email: string | null;
  marketing_consent: boolean | null;
  estimate_total_cents: number | null;
  planner_inputs: unknown;
  estimate_snapshot: unknown;
  customer_email_ok: boolean;
  staff_email_ok: boolean;
  delivered_email: boolean;
};

type EstimateSnapshot = {
  v: 1;
  name: string;
  email: string;
  marketingConsent: boolean;
  totalCents: number;
  selections: ProjectInputs;
  issuedAt: string;
  fingerprint: string;
};

async function defaultSql(): Promise<Sql | null> {
  if (!process.env.DATABASE_URL?.trim()) return null;
  const { getSql } = await import("@/lib/db");
  return getSql();
}

/** Canonical public origin for customer links — never request Host / x-forwarded-host. */
export function estimateSiteOrigin(env: NodeJS.ProcessEnv = process.env): string {
  const configured = env.PUBLIC_SITE_URL?.trim() || SITE.url;
  return configured.replace(/\/+$/, "");
}

export function estimateCustomerMailConfig(env: NodeJS.ProcessEnv = process.env) {
  const lead = leadMailConfigFromEnv(env);
  const from = env.ESTIMATE_FROM_EMAIL?.trim() || lead.from;
  const apiKey = lead.apiKey;
  const staffTo = lead.to;
  const deliveryFlag = /^(1|true|yes)$/i.test(env.ESTIMATE_EMAIL_DELIVERY?.trim() || "");
  const senderOk = Boolean(from) && !from.toLowerCase().includes("onboarding@resend.dev");
  const configured = Boolean(apiKey) && senderOk && deliveryFlag;
  return {
    apiKey,
    from,
    staffTo,
    configured,
    deliveryFlag,
    senderOk,
    hasApiKey: Boolean(apiKey),
  };
}

export function estimateEmailAvailability(
  env: NodeJS.ProcessEnv = process.env,
): EstimateEmailAvailability {
  const cfg = estimateCustomerMailConfig(env);
  if (!cfg.configured) {
    return {
      available: false,
      state: "unavailable",
      message:
        "Emailing a personalized estimate PDF is not available right now. Call or text — we still want the job. Your on-screen estimate stays here.",
    };
  }
  return {
    available: true,
    state: "available",
    message: "You can email yourself a personalized preliminary estimate PDF.",
  };
}

function nameHasDisallowedControls(raw: string) {
  for (const ch of raw) {
    const code = ch.codePointAt(0) ?? 0;
    if (code <= 0x1f || code === 0x7f || code === 0x2028 || code === 0x2029) return true;
  }
  return false;
}

/** Bound plain-text visitor name for email/PDF branding. Rejects control chars and header injection. */
export function validateEstimateEmailContact(input: { name: string; email: string }) {
  if (nameHasDisallowedControls(input.name)) {
    return {
      ok: false as const,
      message: "Use your name with letters only (2–80 characters). Avoid special symbols.",
    };
  }
  const name = sanitizeEstimateName(input.name);
  if (!name) {
    return {
      ok: false as const,
      message: "Use your name with letters only (2–80 characters). Avoid special symbols.",
    };
  }
  const emailProblem = leadEmailProblem(input.email);
  if (emailProblem) return { ok: false as const, message: emailProblem };
  return { ok: true as const, name, email: input.email.trim().toLowerCase() };
}

export function sanitizeEstimateName(raw: string): string | null {
  if (nameHasDisallowedControls(raw)) return null;
  const cleaned = raw
    .normalize("NFKC")
    .replace(/[^\p{L}\p{M}\p{N} .,'’-]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length < 2 || cleaned.length > 80) return null;
  if (!/\p{L}/u.test(cleaned)) return null;
  // Reject header-like or markup fragments even after stripping symbols.
  if (/bcc\s*:|cc\s*:|content-type|multipart\/|<[^>]+>/i.test(raw) || /bcc\s|cc\s/i.test(cleaned)) {
    return null;
  }
  return cleaned;
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

function fingerprintSnapshot(parts: {
  name: string;
  email: string;
  marketingConsent: boolean;
  totalCents: number;
  selections: ProjectInputs;
}) {
  return createHash("sha256")
    .update(JSON.stringify({
      name: parts.name,
      email: parts.email.toLowerCase(),
      marketingConsent: parts.marketingConsent,
      totalCents: parts.totalCents,
      selections: parts.selections,
    }))
    .digest("hex");
}

function asSnapshot(raw: unknown): EstimateSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  if (row.v !== 1 || typeof row.fingerprint !== "string") return null;
  if (typeof row.name !== "string" || typeof row.email !== "string") return null;
  if (typeof row.totalCents !== "number" || typeof row.marketingConsent !== "boolean") return null;
  try {
    const selections = validatePublicEstimateInput(row.selections);
    return {
      v: 1,
      name: row.name,
      email: row.email,
      marketingConsent: row.marketingConsent,
      totalCents: row.totalCents,
      selections,
      issuedAt: typeof row.issuedAt === "string" ? row.issuedAt : new Date().toISOString(),
      fingerprint: row.fingerprint,
    };
  } catch {
    return null;
  }
}

function hourWindowStart(now: number) {
  const d = new Date(now);
  d.setUTCMinutes(0, 0, 0);
  return d;
}

function ipWindowStart(now: number) {
  const ms = ABUSE_LIMITS.ipWindowMs;
  return new Date(Math.floor(now / ms) * ms);
}

/**
 * Atomic durable counters. Fail closed when the store is unavailable or errors.
 * Remaining recipient-abuse risk: attackers can still target third-party inboxes
 * until delivery stays disabled or owner adds bot/address verification (CAPTCHA /
 * double opt-in). Do not enable ESTIMATE_EMAIL_DELIVERY without that readiness call.
 */
export async function assertEstimateEmailAbuseAllowance(
  sql: Sql,
  args: { ip: string; email: string; now?: number },
): Promise<{ ok: true } | { ok: false; message: string }> {
  const now = args.now ?? Date.now();
  const emailKey = `email:${args.email.toLowerCase()}`;
  const ipKey = `ip:${args.ip || "unknown"}`;
  const checks: Array<{ bucket: string; window: Date; limit: number }> = [
    { bucket: emailKey, window: hourWindowStart(now), limit: ABUSE_LIMITS.emailPerHour },
    { bucket: ipKey, window: ipWindowStart(now), limit: ABUSE_LIMITS.ipPerWindow },
    { bucket: "global:estimate-email", window: hourWindowStart(now), limit: ABUSE_LIMITS.globalPerHour },
  ];
  try {
    for (const check of checks) {
      const rows = await sql.query<{ hit_count: number }>(
        `insert into estimate_email_abuse (bucket, window_start, hit_count)
         values ($1, $2, 1)
         on conflict (bucket, window_start)
         do update set hit_count = estimate_email_abuse.hit_count + 1
         returning hit_count`,
        [check.bucket, check.window.toISOString()],
      );
      const count = rows[0]?.hit_count ?? Number.POSITIVE_INFINITY;
      if (count > check.limit) {
        return {
          ok: false,
          message: "Too many estimate email requests. Call or text instead, or try again later.",
        };
      }
    }
    return { ok: true };
  } catch {
    return {
      ok: false,
      message: "Estimate email protection is temporarily unavailable. Call or text instead.",
    };
  }
}

async function assertDownloadAbuseAllowance(
  sql: Sql,
  args: { ip: string; tokenHash: string; now?: number },
): Promise<boolean> {
  const now = args.now ?? Date.now();
  try {
    const rows = await sql.query<{ hit_count: number }>(
      `insert into estimate_email_abuse (bucket, window_start, hit_count)
       values ($1, $2, 1)
       on conflict (bucket, window_start)
       do update set hit_count = estimate_email_abuse.hit_count + 1
       returning hit_count`,
      [`download-ip:${args.ip || "unknown"}`, hourWindowStart(now).toISOString()],
    );
    if ((rows[0]?.hit_count ?? Number.POSITIVE_INFINITY) > ABUSE_LIMITS.downloadIpPerHour) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

async function findExisting(sql: Sql, submissionId: string): Promise<StoredLead | null> {
  const rows = await sql.query<StoredLead>(
    `select submission_id, name, email, marketing_consent, estimate_total_cents,
            planner_inputs, estimate_snapshot, customer_email_ok, staff_email_ok, delivered_email
     from contact_leads where submission_id = $1`,
    [submissionId],
  );
  return rows[0] ?? null;
}

async function persistEstimateLead(args: {
  sql: Sql;
  submissionId: string;
  name: string;
  email: string;
  message: string;
  service: string;
  marketingConsent: boolean;
  total: number;
  selections: ProjectInputs;
  snapshot: EstimateSnapshot;
  adIds: LeadAdIds;
  customerEmailOk: boolean;
  staffEmailOk: boolean;
  clientIp: string;
}) {
  await args.sql.query(
    `insert into contact_leads (
       submission_id, name, email, phone, message, service, source, affiliation,
       ad_ids, has_photo, delivered_email, client_ip, is_test,
       marketing_consent, estimate_total_cents, planner_inputs,
       customer_email_ok, staff_email_ok, estimate_snapshot
     ) values (
       $1,$2,$3,'',$4,$5,$6,null,$7::jsonb,false,$8,$9,
       EXISTS (SELECT 1 FROM lead_test_exclusions WHERE submission_id = $1),
       $10,$11,$12::jsonb,$13,$14,$15::jsonb
     )
     on conflict (submission_id) do update set
       delivered_email = contact_leads.delivered_email OR excluded.delivered_email,
       customer_email_ok = contact_leads.customer_email_ok OR excluded.customer_email_ok,
       staff_email_ok = contact_leads.staff_email_ok OR excluded.staff_email_ok,
       marketing_consent = contact_leads.marketing_consent,
       estimate_total_cents = contact_leads.estimate_total_cents,
       planner_inputs = contact_leads.planner_inputs,
       estimate_snapshot = contact_leads.estimate_snapshot,
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
        submitted_at: args.snapshot.issuedAt,
      }),
      args.customerEmailOk,
      args.clientIp || null,
      args.marketingConsent,
      Math.round(args.total * 100),
      JSON.stringify({ v: 1, project: args.selections }),
      args.customerEmailOk,
      args.staffEmailOk,
      JSON.stringify(args.snapshot),
    ],
  );
}

async function markDeliveryFlags(
  sql: Sql,
  submissionId: string,
  flags: { customerEmailOk?: boolean; staffEmailOk?: boolean },
) {
  await sql.query(
    `update contact_leads set
       customer_email_ok = customer_email_ok OR $2,
       staff_email_ok = staff_email_ok OR $3,
       delivered_email = delivered_email OR $2,
       updated_at = now()
     where submission_id = $1`,
    [submissionId, Boolean(flags.customerEmailOk), Boolean(flags.staffEmailOk)],
  );
}

async function storeDownloadSnapshot(args: {
  sql: Sql;
  submissionId: string;
  token: string;
  expiresAt: Date;
  pdfBytes: Uint8Array;
  snapshot: EstimateSnapshot;
}) {
  await args.sql.query(
    `insert into estimate_pdf_downloads (
       token_hash, submission_id, expires_at, pdf_bytes,
       snapshot_total_cents, snapshot_name, snapshot_selections
     ) values ($1, $2, $3, $4, $5, $6, $7::jsonb)
     on conflict (token_hash) do nothing`,
    [
      hashToken(args.token),
      args.submissionId,
      args.expiresAt.toISOString(),
      Buffer.from(args.pdfBytes),
      args.snapshot.totalCents,
      args.snapshot.name,
      JSON.stringify(args.snapshot.selections),
    ],
  );
}

async function findDownloadBySubmission(sql: Sql, submissionId: string) {
  const rows = await sql.query<{ token_hash: string; expires_at: string | Date; revoked_at: string | Date | null }>(
    `select token_hash, expires_at, revoked_at
     from estimate_pdf_downloads
     where submission_id = $1
     order by created_at desc
     limit 1`,
    [submissionId],
  );
  return rows[0] ?? null;
}

/** Ops helper: revoke a download by raw token. */
export async function revokeEstimatePdfToken(
  token: string,
  deps: { sql?: Sql | null; now?: number } = {},
): Promise<boolean> {
  const sql = deps.sql !== undefined ? deps.sql : await defaultSql();
  if (!sql) return false;
  const now = deps.now ?? Date.now();
  const rows = await sql.query<{ token_hash: string }>(
    `update estimate_pdf_downloads
     set revoked_at = coalesce(revoked_at, $2::timestamptz)
     where token_hash = $1
     returning token_hash`,
    [hashToken(token.trim()), new Date(now).toISOString()],
  );
  return rows.length > 0;
}

export async function handleEstimateEmailAvailability(): Promise<Response> {
  const availability = estimateEmailAvailability();
  return Response.json({
    ok: availability.available,
    state: availability.state === "available" ? "accepted" : "unavailable",
    available: availability.available,
    message: availability.message,
  } satisfies EstimateEmailResult);
}

export async function handleEstimateEmailRequest(
  request: Request,
  deps: {
    sql?: Sql | null;
    sendMail?: typeof sendLeadEmail;
    now?: number;
    env?: NodeJS.ProcessEnv;
  } = {},
): Promise<Response> {
  const now = deps.now ?? Date.now();
  const env = deps.env ?? process.env;
  const availability = estimateEmailAvailability(env);
  if (!availability.available) {
    // Do not collect or persist when delivery is disabled.
    return Response.json({
      ok: false,
      state: "unavailable",
      available: false,
      message: availability.message,
    } satisfies EstimateEmailResult, { status: 503 });
  }

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
      ok: true, state: "discarded", submissionId, message: "Accepted.",
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

  const sql = deps.sql !== undefined ? deps.sql : await defaultSql();
  if (!sql) {
    return Response.json({
      ok: false,
      state: "unavailable",
      available: false,
      message: "Estimate email protection is temporarily unavailable. Call or text instead.",
    } satisfies EstimateEmailResult, { status: 503 });
  }

  const ip = clientIp(request);
  const abuse = await assertEstimateEmailAbuseAllowance(sql, {
    ip,
    email: contact.email,
    now,
  });
  if (!abuse.ok) {
    return Response.json({
      ok: false, state: "rate_limited", message: abuse.message,
    } satisfies EstimateEmailResult, { status: 429 });
  }

  const totalCents = Math.round(priced.total * 100);
  const issuedAt = new Date(now).toISOString();
  const fingerprint = fingerprintSnapshot({
    name: contact.name,
    email: contact.email,
    marketingConsent,
    totalCents,
    selections,
  });
  const snapshot: EstimateSnapshot = {
    v: 1,
    name: contact.name,
    email: contact.email,
    marketingConsent,
    totalCents,
    selections,
    issuedAt,
    fingerprint,
  };

  let existing: StoredLead | null;
  try {
    existing = await findExisting(sql, submissionId);
  } catch {
    return Response.json({
      ok: false,
      state: "server_error",
      message: "Could not process the estimate request. Call or text instead.",
    } satisfies EstimateEmailResult, { status: 500 });
  }

  if (existing) {
    const prior = asSnapshot(existing.estimate_snapshot);
    if (!prior || prior.fingerprint !== fingerprint) {
      return Response.json({
        ok: false,
        state: "conflict",
        submissionId,
        message: "This request was already saved with different details. Refresh and submit again as a new request.",
      } satisfies EstimateEmailResult, { status: 409 });
    }
    if (existing.customer_email_ok || existing.delivered_email) {
      return Response.json({
        ok: true,
        state: "duplicate",
        submissionId,
        message: "This estimate was already accepted for delivery. Check your email inbox. Provider acceptance is not proof it reached your inbox.",
        total: Math.round(prior.totalCents / 100),
      } as EstimateEmailResult);
    }
    // Matching retry: reuse immutable snapshot (do not reprice or rewrite contact).
    Object.assign(snapshot, prior);
  } else {
    try {
      await persistEstimateLead({
        sql,
        submissionId,
        name: snapshot.name,
        email: snapshot.email,
        message: staffMessage(snapshot.selections, snapshot.totalCents / 100, snapshot, snapshot.marketingConsent),
        service: snapshot.selections.service,
        marketingConsent: snapshot.marketingConsent,
        total: snapshot.totalCents / 100,
        selections: snapshot.selections,
        snapshot,
        adIds: readAdIds(form),
        customerEmailOk: false,
        staffEmailOk: false,
        clientIp: ip,
      });
    } catch {
      return Response.json({
        ok: false,
        state: "server_error",
        message: "Could not save the estimate request. Call or text instead.",
      } satisfies EstimateEmailResult, { status: 500 });
    }
  }

  const mailCfg = estimateCustomerMailConfig(env);
  if (!mailCfg.configured || !mailCfg.apiKey) {
    // Availability already gated delivery, but re-check fail-closed.
    return Response.json({
      ok: false,
      state: "unavailable",
      available: false,
      message: availability.message,
    } satisfies EstimateEmailResult, { status: 503 });
  }

  const pdfBytes = await renderPublicEstimatePdf({
    input: snapshot.selections,
    total: snapshot.totalCents / 100,
    name: snapshot.name,
    issued: new Date(snapshot.issuedAt),
  });

  const existingDownload = await findDownloadBySubmission(sql, submissionId);
  let downloadToken: string | undefined;
  let expiresAt = new Date(now + DOWNLOAD_TTL_MS);
  if (existingDownload && !existingDownload.revoked_at) {
    // Token material is not recoverable from the hash — issue a replacement only
    // when customer email has not yet been accepted, after persisting the new row.
    downloadToken = randomBytes(32).toString("base64url");
    expiresAt = new Date(existingDownload.expires_at);
    if (expiresAt.getTime() < now) expiresAt = new Date(now + DOWNLOAD_TTL_MS);
  } else {
    downloadToken = randomBytes(32).toString("base64url");
  }

  try {
    await storeDownloadSnapshot({
      sql,
      submissionId,
      token: downloadToken,
      expiresAt,
      pdfBytes,
      snapshot,
    });
  } catch {
    return Response.json({
      ok: false,
      state: "server_error",
      message: "Could not prepare the estimate PDF. Call or text instead.",
      submissionId,
      total: snapshot.totalCents / 100,
    } satisfies EstimateEmailResult, { status: 500 });
  }

  const origin = estimateSiteOrigin(env);
  const sendMail = deps.sendMail ?? sendLeadEmail;
  const customerMail = await sendMail(
    {
      submissionId,
      to: snapshot.email,
      from: mailCfg.from,
      subject: `Your preliminary estimate from The Flip Fixer — ${formatPublicEstimate(snapshot.totalCents / 100)}`,
      text: customerEmailText({
        name: snapshot.name,
        total: snapshot.totalCents / 100,
        selections: snapshot.selections,
        plannerPath: publicPlannerPath(snapshot.selections),
        origin,
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
    return Response.json({
      ok: false,
      state: "delivery_failed",
      message: "Could not accept the estimate for email delivery. Try again or call. Your request was saved.",
      submissionId,
      total: snapshot.totalCents / 100,
    } satisfies EstimateEmailResult, { status: 502 });
  }

  try {
    await markDeliveryFlags(sql, submissionId, { customerEmailOk: true });
  } catch {
    // Provider already accepted; lead row may lag. Do not re-send on next retry
    // because Resend idempotency key is stable per submissionId.
  }

  const staffMail = await sendMail(
    {
      submissionId,
      to: mailCfg.staffTo,
      from: mailCfg.from,
      replyTo: snapshot.email,
      subject: `Estimate PDF request — ${snapshot.name}`,
      text: buildLeadEmailText({
        submissionId,
        name: snapshot.name,
        email: snapshot.email,
        phone: "",
        phoneDigits: "",
        message: staffMessage(snapshot.selections, snapshot.totalCents / 100, snapshot, snapshot.marketingConsent),
        service: snapshot.selections.service,
        source: ESTIMATE_EMAIL_SOURCE,
        affiliation: "",
        honey: "",
        adIds: { ...readAdIds(form), origin: "estimate", submitted_at: snapshot.issuedAt },
        estimate_service: snapshot.selections.service,
        estimate_size: snapshot.selections.size,
        estimate_materials: publicEstimateMaterialSummary(snapshot.selections),
        estimate_range: formatPublicEstimate(snapshot.totalCents / 100),
      }),
      idempotencyKey: `estimate-pdf-staff/${submissionId}`,
    },
    mailCfg.apiKey,
  ).catch(() => ({ ok: false as const, status: 0, message: "staff notify failed" }));

  if (staffMail.ok) {
    try {
      await markDeliveryFlags(sql, submissionId, { staffEmailOk: true });
    } catch {
      // Staff flag is best-effort after provider acceptance.
    }
  } else {
    console.error("[estimate-email] staff notification failed", {
      submissionId,
      status: "status" in staffMail ? staffMail.status : 0,
    });
  }

  return Response.json({
    ok: true,
    state: "accepted",
    message: staffMail.ok
      ? "Accepted for email delivery. Provider acceptance is not proof the message reached your inbox."
      : "Accepted for email delivery to you. Staff notification is still pending — we may follow up manually. Provider acceptance is not proof the message reached your inbox.",
    submissionId,
    downloadToken,
    downloadExpiresAt: expiresAt.toISOString(),
    total: snapshot.totalCents / 100,
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

const DOWNLOAD_HEADERS = {
  "cache-control": "private, no-store, max-age=0",
  pragma: "no-cache",
  "referrer-policy": "no-referrer",
  "cross-origin-resource-policy": "same-origin",
} as const;

export async function handleEstimatePdfDownload(
  request: Request,
  token: string,
  deps: { sql?: Sql | null; now?: number } = {},
): Promise<Response> {
  const clean = token.trim();
  if (!/^[A-Za-z0-9_-]{20,200}$/.test(clean)) {
    return new Response("Not found", { status: 404, headers: { ...DOWNLOAD_HEADERS } });
  }
  const sql = deps.sql !== undefined ? deps.sql : await defaultSql();
  if (!sql) {
    return new Response("Not found", { status: 404, headers: { ...DOWNLOAD_HEADERS } });
  }
  const now = deps.now ?? Date.now();
  const ip = clientIp(request);
  const tokenHash = hashToken(clean);

  const allowed = await assertDownloadAbuseAllowance(sql, { ip, tokenHash, now });
  if (!allowed) {
    return new Response("Too many download attempts. Try again later.", {
      status: 429,
      headers: { ...DOWNLOAD_HEADERS },
    });
  }

  const rows = await sql.query<{
    submission_id: string;
    expires_at: string | Date;
    revoked_at: string | Date | null;
    download_count: number | null;
    pdf_bytes: Buffer | Uint8Array | null;
    snapshot_total_cents: number | null;
    snapshot_name: string | null;
    snapshot_selections: unknown;
  }>(
    `select submission_id, expires_at, revoked_at, download_count, pdf_bytes,
            snapshot_total_cents, snapshot_name, snapshot_selections
     from estimate_pdf_downloads
     where token_hash = $1`,
    [tokenHash],
  );
  const row = rows[0];
  if (!row) {
    return new Response("Not found", { status: 404, headers: { ...DOWNLOAD_HEADERS } });
  }
  if (row.revoked_at) {
    return new Response("This download link is no longer available.", {
      status: 410,
      headers: { ...DOWNLOAD_HEADERS },
    });
  }
  const expires = new Date(row.expires_at).getTime();
  if (!Number.isFinite(expires) || expires < now) {
    return new Response("This download link has expired.", {
      status: 410,
      headers: { ...DOWNLOAD_HEADERS },
    });
  }
  if ((row.download_count ?? 0) >= MAX_PDF_DOWNLOADS) {
    await sql.query(
      `update estimate_pdf_downloads set revoked_at = coalesce(revoked_at, $2::timestamptz)
       where token_hash = $1`,
      [tokenHash, new Date(now).toISOString()],
    );
    return new Response("This download link is no longer available.", {
      status: 410,
      headers: { ...DOWNLOAD_HEADERS },
    });
  }

  let pdf: Uint8Array;
  if (row.pdf_bytes && (row.pdf_bytes as Uint8Array).byteLength > 0) {
    pdf = row.pdf_bytes instanceof Uint8Array
      ? row.pdf_bytes
      : new Uint8Array(row.pdf_bytes);
  } else {
    // Legacy rows without stored bytes: rebuild once from the immutable snapshot
    // total and selections — never from live pricing tables.
    let selections: ProjectInputs;
    try {
      selections = validatePublicEstimateInput(row.snapshot_selections);
    } catch {
      return new Response("Not found", { status: 404, headers: { ...DOWNLOAD_HEADERS } });
    }
    if (row.snapshot_total_cents == null) {
      return new Response("Not found", { status: 404, headers: { ...DOWNLOAD_HEADERS } });
    }
    pdf = await renderPublicEstimatePdf({
      input: selections,
      total: Math.round(row.snapshot_total_cents / 100),
      name: sanitizeEstimateName(row.snapshot_name || "") || "Customer",
    });
  }

  await sql.query(
    `update estimate_pdf_downloads
     set download_count = coalesce(download_count, 0) + 1,
         last_download_at = $2::timestamptz
     where token_hash = $1`,
    [tokenHash, new Date(now).toISOString()],
  );

  return new Response(Buffer.from(pdf), {
    status: 200,
    headers: {
      ...DOWNLOAD_HEADERS,
      "content-type": "application/pdf",
      "content-disposition": 'attachment; filename="Flip-Fixer-preliminary-estimate.pdf"',
    },
  });
}

/** Test helper: constant-time compare of download token hashes. */
export function tokensMatch(a: string, b: string) {
  const left = Buffer.from(hashToken(a), "hex");
  const right = Buffer.from(hashToken(b), "hex");
  return left.length === right.length && timingSafeEqual(left, right);
}

/** @deprecated Guards are durable in Postgres; kept for test imports. */
export function resetEstimateEmailGuardsForTests() {
  // no-op: durable store is injected per test
}
