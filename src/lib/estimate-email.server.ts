/**
 * Estimate follow-up: save lead, gated personalized PDF download, notify Jon only.
 * Never emails the visitor. Never trusts a client-submitted total.
 */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { leadMailConfigFromEnv, sendLeadEmail } from "./lead-mail.ts";
import {
  buildLeadEmailText,
  isValidSubmissionId,
  leadEmailProblem,
  normalizePhoneDigits,
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
import { SITE } from "./site.ts";

export const ESTIMATE_EMAIL_SOURCE = "estimate_pdf_followup";
/** Hardcoded staff recipient — never taken from the browser. */
export const ESTIMATE_STAFF_NOTIFY_TO = "jon@theflipfixer.com";
export const DOWNLOAD_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const MAX_PDF_DOWNLOADS = 25;
export const ABUSE_LIMITS = {
  contactPerHour: 3,
  ipPerWindow: 5,
  ipWindowMs: 10 * 60 * 1000,
  globalPerHour: 120,
  downloadIpPerHour: 30,
} as const;

export type EstimateFollowUpState =
  | "accepted"
  | "duplicate"
  | "discarded"
  | "validation"
  | "conflict"
  | "rate_limited"
  | "unavailable"
  | "server_error";

export type EstimateFollowUpResult = {
  ok: boolean;
  state: EstimateFollowUpState;
  message: string;
  submissionId?: string;
  downloadToken?: string;
  downloadExpiresAt?: string;
  total?: number;
  leadSaved?: boolean;
  staffNotified?: boolean;
  available?: boolean;
};

type Sql = { query<T>(text: string, params?: unknown[]): Promise<T[]> };

type StoredLead = {
  submission_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  marketing_consent: boolean | null;
  estimate_total_cents: number | null;
  planner_inputs: unknown;
  estimate_snapshot: unknown;
  customer_email_ok: boolean;
  staff_email_ok: boolean;
  delivered_email: boolean;
};

type EstimateSnapshot = {
  v: 2;
  name: string;
  email: string;
  phone: string;
  phoneDigits: string;
  zip: string;
  totalCents: number;
  selections: ProjectInputs;
  issuedAt: string;
  fingerprint: string;
};

export type EstimateFollowUpContact = {
  name: string;
  email: string;
  phone: string;
  phoneDigits: string;
  zip: string;
};

async function defaultSql(): Promise<Sql | null> {
  if (!process.env.DATABASE_URL?.trim()) return null;
  const { getSql } = await import("@/lib/db");
  return getSql();
}

function nameHasDisallowedControls(raw: string) {
  for (const ch of raw) {
    const code = ch.codePointAt(0) ?? 0;
    if (code <= 0x1f || code === 0x7f || code === 0x2028 || code === 0x2029) return true;
  }
  return false;
}

export function sanitizeEstimateName(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (nameHasDisallowedControls(raw)) return null;
  const cleaned = raw
    .normalize("NFKC")
    .replace(/[^\p{L}\p{M}\p{N} .,'’-]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length > 80) return null;
  if (cleaned && !/\p{L}/u.test(cleaned)) return null;
  if (/bcc\s*:|cc\s*:|content-type|multipart\/|<[^>]+>/i.test(raw) || /bcc\s|cc\s/i.test(cleaned)) {
    return null;
  }
  return cleaned;
}

export function validateEstimateZip(zip: string): string | null {
  const digits = zip.replace(/\D/g, "");
  if (!/^\d{5}$/.test(digits)) return null;
  return digits;
}

/** Email and/or phone required; ZIP required; name optional. */
export function validateEstimateFollowUpContact(input: {
  name: string;
  email: string;
  phone: string;
  zip: string;
}): { ok: true; contact: EstimateFollowUpContact } | { ok: false; message: string } {
  const name = sanitizeEstimateName(input.name);
  if (name === null) {
    return { ok: false, message: "Use a simple name, or leave the name blank." };
  }
  const zip = validateEstimateZip(input.zip);
  if (!zip) {
    return { ok: false, message: "Add a five-digit ZIP code for the project." };
  }

  const emailRaw = input.email.trim();
  const phoneDigits = normalizePhoneDigits(input.phone);
  const hasEmail = Boolean(emailRaw);
  const hasPhone = phoneDigits.length >= 10;

  if (!hasEmail && !hasPhone) {
    return { ok: false, message: "Add an email or a 10-digit phone so we can reach you." };
  }
  if (hasEmail) {
    const emailProblem = leadEmailProblem(emailRaw);
    if (emailProblem) {
      return { ok: false, message: "Add a valid email, or leave email blank and use phone instead." };
    }
  }
  if (input.phone.trim() && !hasPhone) {
    return { ok: false, message: "Add a 10-digit phone, or leave phone blank and use email instead." };
  }
  if (phoneDigits.length > 15) {
    return { ok: false, message: "Phone number looks invalid." };
  }

  return {
    ok: true,
    contact: {
      name,
      email: hasEmail ? emailRaw.toLowerCase() : "",
      phone: hasPhone ? input.phone.trim() : "",
      phoneDigits: hasPhone ? phoneDigits : "",
      zip,
    },
  };
}

/** @deprecated Prefer validateEstimateFollowUpContact. */
export function validateEstimateEmailContact(input: { name: string; email: string }) {
  const result = validateEstimateFollowUpContact({
    name: input.name,
    email: input.email,
    phone: "",
    zip: "78209",
  });
  if (!result.ok) return { ok: false as const, message: result.message };
  if (!result.contact.email) return { ok: false as const, message: "Add your email." };
  return { ok: true as const, name: result.contact.name || "Visitor", email: result.contact.email };
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function parseSelections(raw: string): ProjectInputs | null {
  try {
    return validatePublicEstimateInput(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

function fingerprintSnapshot(parts: {
  name: string;
  email: string;
  phoneDigits: string;
  zip: string;
  totalCents: number;
  selections: ProjectInputs;
}) {
  return createHash("sha256")
    .update(JSON.stringify({
      name: parts.name,
      email: parts.email.toLowerCase(),
      phoneDigits: parts.phoneDigits,
      zip: parts.zip,
      totalCents: parts.totalCents,
      selections: parts.selections,
    }))
    .digest("hex");
}

function asSnapshot(raw: unknown): EstimateSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  if ((row.v !== 1 && row.v !== 2) || typeof row.fingerprint !== "string") return null;
  if (typeof row.totalCents !== "number") return null;
  try {
    const selections = validatePublicEstimateInput(row.selections);
    return {
      v: 2,
      name: typeof row.name === "string" ? row.name : "",
      email: typeof row.email === "string" ? row.email : "",
      phone: typeof row.phone === "string" ? row.phone : "",
      phoneDigits: typeof row.phoneDigits === "string" ? row.phoneDigits : "",
      zip: typeof row.zip === "string" ? row.zip : "",
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

export async function assertEstimateEmailAbuseAllowance(
  sql: Sql,
  args: { ip: string; contactKey: string; now?: number },
): Promise<{ ok: true } | { ok: false; message: string }> {
  const now = args.now ?? Date.now();
  const checks: Array<{ bucket: string; window: Date; limit: number }> = [
    { bucket: `contact:${args.contactKey}`, window: hourWindowStart(now), limit: ABUSE_LIMITS.contactPerHour },
    { bucket: `ip:${args.ip || "unknown"}`, window: ipWindowStart(now), limit: ABUSE_LIMITS.ipPerWindow },
    { bucket: "global:estimate-followup", window: hourWindowStart(now), limit: ABUSE_LIMITS.globalPerHour },
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
      if ((rows[0]?.hit_count ?? Number.POSITIVE_INFINITY) > check.limit) {
        return {
          ok: false,
          message: "Too many estimate download requests. Call or text instead, or try again later.",
        };
      }
    }
    return { ok: true };
  } catch {
    return {
      ok: false,
      message: "Estimate follow-up protection is temporarily unavailable. Call or text instead.",
    };
  }
}

async function assertDownloadAbuseAllowance(
  sql: Sql,
  args: { ip: string; now?: number },
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
    return (rows[0]?.hit_count ?? Number.POSITIVE_INFINITY) <= ABUSE_LIMITS.downloadIpPerHour;
  } catch {
    return false;
  }
}

async function findExisting(sql: Sql, submissionId: string): Promise<StoredLead | null> {
  const rows = await sql.query<StoredLead>(
    `select submission_id, name, email, phone, marketing_consent, estimate_total_cents,
            planner_inputs, estimate_snapshot, customer_email_ok, staff_email_ok, delivered_email
     from contact_leads where submission_id = $1`,
    [submissionId],
  );
  return rows[0] ?? null;
}

async function persistEstimateLead(args: {
  sql: Sql;
  submissionId: string;
  contact: EstimateFollowUpContact;
  message: string;
  service: string;
  total: number;
  selections: ProjectInputs;
  snapshot: EstimateSnapshot;
  adIds: LeadAdIds;
  staffNotified: boolean;
  clientIp: string;
}) {
  await args.sql.query(
    `insert into contact_leads (
       submission_id, name, email, phone, message, service, source, affiliation,
       ad_ids, has_photo, delivered_email, client_ip, is_test,
       marketing_consent, estimate_total_cents, planner_inputs,
       customer_email_ok, staff_email_ok, estimate_snapshot
     ) values (
       $1,$2,$3,$4,$5,$6,$7,null,$8::jsonb,false,$9,$10,
       EXISTS (SELECT 1 FROM lead_test_exclusions WHERE submission_id = $1),
       false,$11,$12::jsonb,false,$13,$14::jsonb
     )
     on conflict (submission_id) do update set
       staff_email_ok = contact_leads.staff_email_ok OR excluded.staff_email_ok,
       delivered_email = contact_leads.delivered_email OR excluded.delivered_email,
       marketing_consent = contact_leads.marketing_consent,
       estimate_total_cents = contact_leads.estimate_total_cents,
       planner_inputs = contact_leads.planner_inputs,
       estimate_snapshot = contact_leads.estimate_snapshot,
       updated_at = now()`,
    [
      args.submissionId,
      args.contact.name || "Estimate visitor",
      args.contact.email || null,
      args.contact.phoneDigits || args.contact.phone || "",
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
        zip: args.contact.zip,
        origin: "estimate",
        submitted_at: args.snapshot.issuedAt,
      }),
      args.staffNotified,
      args.clientIp || null,
      Math.round(args.total * 100),
      JSON.stringify({ v: 1, project: args.selections }),
      args.staffNotified,
      JSON.stringify(args.snapshot),
    ],
  );
}

async function markStaffNotified(sql: Sql, submissionId: string) {
  await sql.query(
    `update contact_leads set
       staff_email_ok = true,
       delivered_email = true,
       updated_at = now()
     where submission_id = $1`,
    [submissionId],
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
      args.snapshot.name || "Visitor",
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

/** Availability of lead storage + staff notification (honest; no setup dump). */
export function estimateFollowUpAvailability(env: NodeJS.ProcessEnv = process.env): {
  storageReady: boolean;
  notifyReady: boolean;
  message: string;
} {
  const storageReady = Boolean(env.DATABASE_URL?.trim());
  const mail = leadMailConfigFromEnv(env);
  const notifyReady = Boolean(mail.apiKey);
  if (!storageReady) {
    return {
      storageReady: false,
      notifyReady,
      message:
        "Estimate download and follow-up are temporarily unavailable because lead storage is offline. Call or text — we still want the job.",
    };
  }
  return {
    storageReady: true,
    notifyReady,
    message: notifyReady
      ? "You can download your preliminary estimate and request follow-up."
      : "You can save your request and download the PDF. Shop notification may be delayed until email delivery is available.",
  };
}

export function estimateEmailAvailability(env: NodeJS.ProcessEnv = process.env) {
  const avail = estimateFollowUpAvailability(env);
  return {
    available: avail.storageReady,
    state: avail.storageReady ? ("available" as const) : ("unavailable" as const),
    message: avail.message,
  };
}

/** Retired: customer email delivery is not offered. Kept so old imports do not crash tests. */
export function estimateCustomerMailConfig(env: NodeJS.ProcessEnv = process.env) {
  const lead = leadMailConfigFromEnv(env);
  return {
    apiKey: lead.apiKey,
    from: lead.from,
    staffTo: ESTIMATE_STAFF_NOTIFY_TO,
    configured: false,
    deliveryFlag: false,
    senderOk: false,
    hasApiKey: Boolean(lead.apiKey),
    setupNeeded: null as string[] | null,
  };
}

export async function handleEstimateEmailAvailability(
  deps: { env?: NodeJS.ProcessEnv } = {},
): Promise<Response> {
  const availability = estimateEmailAvailability(deps.env ?? process.env);
  return Response.json({
    ok: availability.available,
    state: availability.available ? "accepted" : "unavailable",
    available: availability.available,
    message: availability.message,
  } satisfies EstimateFollowUpResult);
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
  const availability = estimateFollowUpAvailability(env);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({
      ok: false, state: "validation", message: "Could not read the form. Refresh and try again.",
    } satisfies EstimateFollowUpResult, { status: 400 });
  }

  const submissionId = formString(form, "submissionId").trim();
  if (!isValidSubmissionId(submissionId)) {
    return Response.json({
      ok: false, state: "validation", message: "Could not send the form. Refresh and try again, or call.",
    } satisfies EstimateFollowUpResult, { status: 400 });
  }

  if (isHoneypot(form)) {
    return Response.json({
      ok: true, state: "discarded", submissionId, message: "Accepted.",
    } as EstimateFollowUpResult);
  }

  const contactResult = validateEstimateFollowUpContact({
    name: formString(form, "name"),
    email: formString(form, "email"),
    phone: formString(form, "phone"),
    zip: formString(form, "zip"),
  });
  if (!contactResult.ok) {
    return Response.json({
      ok: false, state: "validation", message: contactResult.message,
    } satisfies EstimateFollowUpResult, { status: 400 });
  }
  const contact = contactResult.contact;

  const selections = parseSelections(formString(form, "selections"));
  if (!selections) {
    return Response.json({
      ok: false, state: "validation", message: "Choose valid project selections and try again.",
    } satisfies EstimateFollowUpResult, { status: 400 });
  }

  const priced = publicEstimateResult(selections);
  if (!priced) {
    return Response.json({
      ok: false, state: "validation", message: "Finish your project selections before downloading the PDF.",
    } satisfies EstimateFollowUpResult, { status: 400 });
  }

  const sql = deps.sql !== undefined ? deps.sql : await defaultSql();
  if (!sql || !availability.storageReady) {
    return Response.json({
      ok: false,
      state: "unavailable",
      available: false,
      leadSaved: false,
      message: availability.message,
    } satisfies EstimateFollowUpResult, { status: 503 });
  }

  const ip = clientIp(request);
  const contactKey = contact.email || contact.phoneDigits || contact.zip;
  const abuse = await assertEstimateEmailAbuseAllowance(sql, { ip, contactKey, now });
  if (!abuse.ok) {
    return Response.json({
      ok: false, state: "rate_limited", message: abuse.message,
    } satisfies EstimateFollowUpResult, { status: 429 });
  }

  const totalCents = Math.round(priced.total * 100);
  const issuedAt = new Date(now).toISOString();
  const fingerprint = fingerprintSnapshot({
    name: contact.name,
    email: contact.email,
    phoneDigits: contact.phoneDigits,
    zip: contact.zip,
    totalCents,
    selections,
  });
  let snapshot: EstimateSnapshot = {
    v: 2,
    name: contact.name,
    email: contact.email,
    phone: contact.phone,
    phoneDigits: contact.phoneDigits,
    zip: contact.zip,
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
    } satisfies EstimateFollowUpResult, { status: 500 });
  }

  if (existing) {
    const prior = asSnapshot(existing.estimate_snapshot);
    if (!prior || prior.fingerprint !== fingerprint) {
      return Response.json({
        ok: false,
        state: "conflict",
        submissionId,
        message: "This request was already saved with different details. Refresh and submit again as a new request.",
      } satisfies EstimateFollowUpResult, { status: 409 });
    }
    snapshot = prior;

    const existingDownload = await findDownloadBySubmission(sql, submissionId);
    if (existingDownload && !existingDownload.revoked_at) {
      // Lead already saved. Re-issue a fresh download token bound to the same snapshot bytes.
      const downloadToken = randomBytes(32).toString("base64url");
      let expiresAt = new Date(existingDownload.expires_at);
      if (expiresAt.getTime() < now) expiresAt = new Date(now + DOWNLOAD_TTL_MS);
      const pdfBytes = await renderPublicEstimatePdf({
        input: snapshot.selections,
        total: snapshot.totalCents / 100,
        name: snapshot.name || "Visitor",
        issued: new Date(snapshot.issuedAt),
      });
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
          leadSaved: true,
          staffNotified: existing.staff_email_ok,
          message: "Your request was saved, but the PDF download could not be prepared. Call or text.",
          submissionId,
          total: snapshot.totalCents / 100,
        } satisfies EstimateFollowUpResult, { status: 500 });
      }

      if (!existing.staff_email_ok) {
        const notified = await notifyJon({
          sql,
          submissionId,
          snapshot,
          env,
          sendMail: deps.sendMail,
          adIds: readAdIds(form),
        });
        return Response.json({
          ok: true,
          state: existing.staff_email_ok || notified ? "duplicate" : "accepted",
          submissionId,
          downloadToken,
          downloadExpiresAt: expiresAt.toISOString(),
          total: snapshot.totalCents / 100,
          leadSaved: true,
          staffNotified: existing.staff_email_ok || notified,
          message: notified || existing.staff_email_ok
            ? "Your request was already saved. Download your personalized preliminary estimate PDF below."
            : "Your request was already saved. Download your PDF below. Shop notification is still pending — try again or call.",
        } satisfies EstimateFollowUpResult);
      }

      return Response.json({
        ok: true,
        state: "duplicate",
        submissionId,
        downloadToken,
        downloadExpiresAt: expiresAt.toISOString(),
        total: snapshot.totalCents / 100,
        leadSaved: true,
        staffNotified: true,
        message: "Your request was already saved. Download your personalized preliminary estimate PDF below.",
      } satisfies EstimateFollowUpResult);
    }
  }

  const pdfBytes = await renderPublicEstimatePdf({
    input: snapshot.selections,
    total: snapshot.totalCents / 100,
    name: snapshot.name || "Visitor",
    issued: new Date(snapshot.issuedAt),
  });
  const downloadToken = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now + DOWNLOAD_TTL_MS);

  try {
    await persistEstimateLead({
      sql,
      submissionId,
      contact,
      message: staffMessage(snapshot),
      service: snapshot.selections.service,
      total: snapshot.totalCents / 100,
      selections: snapshot.selections,
      snapshot,
      adIds: readAdIds(form),
      staffNotified: false,
      clientIp: ip,
    });
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
      leadSaved: false,
      message: "Could not save your estimate request. Call or text instead.",
    } satisfies EstimateFollowUpResult, { status: 500 });
  }

  const staffNotified = await notifyJon({
    sql,
    submissionId,
    snapshot,
    env,
    sendMail: deps.sendMail,
    adIds: readAdIds(form),
  });

  return Response.json({
    ok: true,
    state: "accepted",
    submissionId,
    downloadToken,
    downloadExpiresAt: expiresAt.toISOString(),
    total: snapshot.totalCents / 100,
    leadSaved: true,
    staffNotified,
    message: staffNotified
      ? "Request saved. Your personalized preliminary estimate PDF is ready. The Flip Fixer was notified to follow up."
      : "Request saved and your PDF is ready. We could not notify the shop by email yet — your details are saved; call or retry if you need a faster response.",
  } satisfies EstimateFollowUpResult);
}

async function notifyJon(args: {
  sql: Sql;
  submissionId: string;
  snapshot: EstimateSnapshot;
  env: NodeJS.ProcessEnv;
  sendMail?: typeof sendLeadEmail;
  adIds: LeadAdIds;
}): Promise<boolean> {
  const mailCfg = leadMailConfigFromEnv(args.env);
  if (!mailCfg.apiKey) return false;
  const sendMail = args.sendMail ?? sendLeadEmail;
  const result = await sendMail(
    {
      submissionId: args.submissionId,
      to: ESTIMATE_STAFF_NOTIFY_TO,
      from: mailCfg.from,
      replyTo: args.snapshot.email || undefined,
      subject: `Estimate PDF follow-up — ${args.snapshot.name || args.snapshot.email || args.snapshot.phone || "visitor"}`,
      text: buildLeadEmailText({
        submissionId: args.submissionId,
        name: args.snapshot.name || "Estimate visitor",
        email: args.snapshot.email,
        phone: args.snapshot.phone,
        phoneDigits: args.snapshot.phoneDigits,
        message: staffMessage(args.snapshot),
        service: args.snapshot.selections.service,
        source: ESTIMATE_EMAIL_SOURCE,
        affiliation: "",
        honey: "",
        adIds: {
          ...args.adIds,
          origin: "estimate",
          submitted_at: args.snapshot.issuedAt,
        },
        estimate_service: args.snapshot.selections.service,
        estimate_size: args.snapshot.selections.size,
        estimate_materials: publicEstimateMaterialSummary(args.snapshot.selections),
        estimate_range: formatPublicEstimate(args.snapshot.totalCents / 100),
      }),
      idempotencyKey: `estimate-followup-staff/${args.submissionId}`,
    },
    mailCfg.apiKey,
  ).catch(() => ({ ok: false as const, status: 0, message: "staff notify failed" }));

  if (!result.ok) {
    console.error("[estimate-followup] staff notification failed", {
      submissionId: args.submissionId,
      status: "status" in result ? result.status : 0,
    });
    return false;
  }
  try {
    await markStaffNotified(args.sql, args.submissionId);
  } catch {
    // Provider accepted; flag may lag. Idempotency key prevents duplicate Jon emails.
  }
  return true;
}

function staffMessage(snapshot: EstimateSnapshot) {
  const flooring = flooringInclusionLabel(snapshot.selections);
  return [
    "Visitor requested a personalized preliminary estimate PDF and follow-up.",
    `Name: ${snapshot.name || "(not provided)"}`,
    `Email: ${snapshot.email || "(not provided)"}`,
    `Phone: ${snapshot.phone || "(not provided)"}${snapshot.phoneDigits ? ` (${snapshot.phoneDigits})` : ""}`,
    `ZIP: ${snapshot.zip}`,
    `Project: ${PROJECT_SERVICES.find(row => row.id === snapshot.selections.service)?.label ?? snapshot.selections.service}.`,
    `Size: ${snapshot.selections.size}.`,
    `Materials: ${publicEstimateMaterialSummary(snapshot.selections) || "To be selected"}.`,
    flooring ?? "",
    `Server-calculated preliminary total: ${formatPublicEstimate(snapshot.totalCents / 100)}.`,
    "No marketing subscription. No customer email was sent.",
    PRELIMINARY_ESTIMATE_WORDING,
  ].filter(Boolean).join("\n");
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

  if (!(await assertDownloadAbuseAllowance(sql, { ip, now }))) {
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
      name: sanitizeEstimateName(row.snapshot_name || "") || "Visitor",
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

export function tokensMatch(a: string, b: string) {
  const left = Buffer.from(hashToken(a), "hex");
  const right = Buffer.from(hashToken(b), "hex");
  return left.length === right.length && timingSafeEqual(left, right);
}

export function resetEstimateEmailGuardsForTests() {
  // Durable store is injected per test.
}

/** Canonical site origin for any future absolute links — not request Host. */
export function estimateSiteOrigin(env: NodeJS.ProcessEnv = process.env): string {
  const configured = env.PUBLIC_SITE_URL?.trim() || SITE.url;
  return configured.replace(/\/+$/, "");
}
