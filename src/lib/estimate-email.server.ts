/**
 * Estimate follow-up: save lead, gated personalized PDF download, notify Jon.
 * Optional customer PDF email is a separate default-OFF flag with double opt-in.
 * Never trusts a client-submitted total or staff recipient from the browser.
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
import { formatEstimateRange, PRELIMINARY_ESTIMATE_WORDING } from "./public-estimate-display.ts";
import { PROJECT_SERVICES, type ProjectInputs } from "./public-estimate-options.ts";
import { normalizeEstimatePhone } from "./estimate-followup-phone.ts";
import { SITE } from "./site.ts";
import {
  assertCustomerEmailAbuseAllowance,
  consumeCustomerConfirmToken,
  customerConfirmHtmlPage,
  estimateCustomerEmailOffered,
  estimateCustomerMailConfig,
  issueCustomerEmailConfirm,
  markCustomerEmailed,
  sendCustomerConfirmEmail,
  sendCustomerPdfEmail,
  type CustomerEmailStatus,
  ESTIMATE_CUSTOMER_EMAIL_FLAG,
} from "./estimate-customer-email.server.ts";

export { ESTIMATE_CUSTOMER_EMAIL_FLAG, estimateCustomerMailConfig };

export const ESTIMATE_EMAIL_SOURCE = "estimate_pdf_followup";
/** Hardcoded staff recipient — never taken from the browser. */
export const ESTIMATE_STAFF_NOTIFY_TO = "jon@theflipfixer.com";
/**
 * Explicit release gate for estimate PDF download + Jon follow-up.
 * Default OFF. Do not enable without owner approval and usable DB + Resend config.
 */
export const ESTIMATE_FOLLOWUP_FLAG = "ESTIMATE_FOLLOWUP_ENABLED";
/**
 * Explicit local/test opt-in to use in-memory PGLite for follow-up storage.
 * Never honored on Vercel/serverless hosts — those require DATABASE_URL.
 */
export const ESTIMATE_FOLLOWUP_EPHEMERAL_FLAG = "ESTIMATE_FOLLOWUP_ALLOW_EPHEMERAL_STORAGE";
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
  /** Combined low (rounded). Kept for older clients. */
  total?: number;
  low?: number;
  high?: number;
  leadSaved?: boolean;
  staffNotified?: boolean;
  customerEmailOffered?: boolean;
  customerEmailRequested?: boolean;
  customerEmailStatus?: CustomerEmailStatus;
  customerEmailed?: boolean;
  available?: boolean;
};

type Sql = { query<T>(text: string, params?: unknown[]): Promise<T[]> };
/** Optional transaction runner — lead + PDF snapshot commit together when provided. */
export type WithTransaction = <T>(fn: (sql: Sql) => Promise<T>) => Promise<T>;

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
  /** v3 adds immutable lowCents/highCents; v1/v2 treat totalCents as both ends. */
  v: 2 | 3;
  name: string;
  email: string;
  phone: string;
  phoneDigits: string;
  zip: string;
  /** Stored as the combined low in cents (immutable). */
  totalCents: number;
  lowCents: number;
  highCents: number;
  customerEmailRequested: boolean;
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
  try {
    const { getSql } = await import("@/lib/db");
    return await getSql();
  } catch {
    return null;
  }
}

async function defaultWithTransaction(): Promise<WithTransaction | null> {
  try {
    const { withDbTransaction } = await import("@/lib/db");
    return withDbTransaction;
  } catch {
    return null;
  }
}

export function isEstimateFollowUpEnabled(env: NodeJS.ProcessEnv = process.env) {
  return /^(1|true|yes)$/i.test(env[ESTIMATE_FOLLOWUP_FLAG]?.trim() || "");
}

/** Hosts where in-memory PGLite cannot retain leads across instances. */
export function isEstimateFollowUpServerlessHost(env: NodeJS.ProcessEnv = process.env) {
  return Boolean(
    env.VERCEL?.trim()
    || env.AWS_LAMBDA_FUNCTION_NAME?.trim()
    || env.NETLIFY?.trim(),
  );
}

export function hasConfiguredDurableDatabase(env: NodeJS.ProcessEnv = process.env) {
  return Boolean(env.DATABASE_URL?.trim());
}

/**
 * Ephemeral PGLite for follow-up is opt-in only and never allowed on serverless.
 * App-wide PGLite fallback for the rest of the site is unchanged.
 */
export function allowsEstimateFollowUpEphemeralStorage(env: NodeJS.ProcessEnv = process.env) {
  if (isEstimateFollowUpServerlessHost(env)) return false;
  return /^(1|true|yes)$/i.test(env[ESTIMATE_FOLLOWUP_EPHEMERAL_FLAG]?.trim() || "");
}

export type EstimateFollowUpStorageMode = "durable" | "ephemeral" | "none";

/** Whether this feature may open storage (before collecting contact details). */
export function estimateFollowUpStoragePolicy(env: NodeJS.ProcessEnv = process.env): {
  allowed: boolean;
  mode: EstimateFollowUpStorageMode;
} {
  if (hasConfiguredDurableDatabase(env)) {
    return { allowed: true, mode: "durable" };
  }
  if (allowsEstimateFollowUpEphemeralStorage(env)) {
    return { allowed: true, mode: "ephemeral" };
  }
  return { allowed: false, mode: "none" };
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
  const hasEmail = Boolean(emailRaw);
  const phoneRaw = input.phone;
  const hasPhoneInput = Boolean(phoneRaw.trim());

  let phone = "";
  let phoneDigits = "";
  if (hasPhoneInput) {
    const normalized = normalizeEstimatePhone(phoneRaw);
    if (!normalized.ok) return { ok: false, message: normalized.message };
    phone = normalized.display;
    phoneDigits = normalized.digits;
  }

  if (!hasEmail && !phoneDigits) {
    return { ok: false, message: "Add an email or a 10-digit phone so we can reach you." };
  }
  if (hasEmail) {
    const emailProblem = leadEmailProblem(emailRaw);
    if (emailProblem) {
      return { ok: false, message: "Add a valid email, or leave email blank and use phone instead." };
    }
  }

  return {
    ok: true,
    contact: {
      name,
      email: hasEmail ? emailRaw.toLowerCase() : "",
      phone,
      phoneDigits,
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
  lowCents: number;
  highCents: number;
  customerEmailRequested: boolean;
  selections: ProjectInputs;
}) {
  return createHash("sha256")
    .update(JSON.stringify({
      name: parts.name,
      email: parts.email.toLowerCase(),
      phoneDigits: parts.phoneDigits,
      zip: parts.zip,
      totalCents: parts.totalCents,
      lowCents: parts.lowCents,
      highCents: parts.highCents,
      customerEmailRequested: parts.customerEmailRequested,
      selections: parts.selections,
    }))
    .digest("hex");
}

function asSnapshot(raw: unknown): EstimateSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  if ((row.v !== 1 && row.v !== 2 && row.v !== 3) || typeof row.fingerprint !== "string") return null;
  if (typeof row.totalCents !== "number") return null;
  try {
    const selections = validatePublicEstimateInput(row.selections);
    const lowCents = typeof row.lowCents === "number" ? row.lowCents : row.totalCents;
    const highCents = typeof row.highCents === "number" ? row.highCents : row.totalCents;
    return {
      v: row.v === 3 ? 3 : 2,
      name: typeof row.name === "string" ? row.name : "",
      email: typeof row.email === "string" ? row.email : "",
      phone: typeof row.phone === "string" ? row.phone : "",
      phoneDigits: typeof row.phoneDigits === "string" ? row.phoneDigits : "",
      zip: typeof row.zip === "string" ? row.zip : "",
      totalCents: row.totalCents,
      lowCents,
      highCents,
      customerEmailRequested: Boolean(row.customerEmailRequested),
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

/** Atomically claim a submission id. Returns whether this caller won the insert. */
async function claimEstimateLead(args: {
  sql: Sql;
  submissionId: string;
  contact: EstimateFollowUpContact;
  message: string;
  service: string;
  total: number;
  selections: ProjectInputs;
  snapshot: EstimateSnapshot;
  adIds: LeadAdIds;
  clientIp: string;
}): Promise<"claimed" | "exists"> {
  const rows = await args.sql.query<{ submission_id: string }>(
    `insert into contact_leads (
       submission_id, name, email, phone, message, service, source, affiliation,
       ad_ids, has_photo, delivered_email, client_ip, is_test,
       marketing_consent, estimate_total_cents, planner_inputs,
       customer_email_ok, staff_email_ok, estimate_snapshot
     ) values (
       $1,$2,$3,$4,$5,$6,$7,null,$8::jsonb,false,false,$9,
       EXISTS (SELECT 1 FROM lead_test_exclusions WHERE submission_id = $1),
       false,$10,$11::jsonb,false,false,$12::jsonb
     )
     on conflict (submission_id) do nothing
     returning submission_id`,
    [
      args.submissionId,
      args.contact.name || "Estimate visitor",
      args.contact.email || null,
      args.contact.phoneDigits || "",
      args.message,
      args.service,
      ESTIMATE_EMAIL_SOURCE,
      JSON.stringify({
        ...args.adIds,
        estimate_service: args.selections.service,
        estimate_size: args.selections.size,
        estimate_materials: publicEstimateMaterialSummary(args.selections),
        estimate_range: formatEstimateRange({
          low: args.snapshot.lowCents / 100,
          high: args.snapshot.highCents / 100,
        }),
        flooring: flooringInclusionLabel(args.selections) ?? undefined,
        zip: args.contact.zip,
        origin: "estimate",
        submitted_at: args.snapshot.issuedAt,
      }),
      args.clientIp || null,
      Math.round(args.total * 100),
      JSON.stringify({ v: 1, project: args.selections }),
      JSON.stringify(args.snapshot),
    ],
  );
  return rows.length > 0 ? "claimed" : "exists";
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
  const rows = await sql.query<{
    token_hash: string;
    expires_at: string | Date;
    revoked_at: string | Date | null;
    pdf_bytes: Buffer | Uint8Array | null;
    snapshot_total_cents: number | null;
  }>(
    `select token_hash, expires_at, revoked_at, pdf_bytes, snapshot_total_cents
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

/** Availability of the gated follow-up flow (honest; no setup dump). Feature flag default OFF. */
export function estimateFollowUpAvailability(
  env: NodeJS.ProcessEnv = process.env,
  opts: { databaseReady?: boolean } = {},
): {
  enabled: boolean;
  storageReady: boolean;
  storageMode: EstimateFollowUpStorageMode;
  notifyReady: boolean;
  available: boolean;
  customerEmailOffered: boolean;
  message: string;
} {
  const enabled = isEstimateFollowUpEnabled(env);
  const mail = leadMailConfigFromEnv(env);
  const notifyReady = Boolean(mail.apiKey);
  const policy = estimateFollowUpStoragePolicy(env);
  const storageReady = opts.databaseReady ?? policy.allowed;
  const storageMode = storageReady ? policy.mode : "none";
  if (!enabled) {
    return {
      enabled: false,
      storageReady,
      storageMode,
      notifyReady,
      available: false,
      customerEmailOffered: false,
      message:
        "Estimate download and follow-up are not available right now. Call or text — we still want the job.",
    };
  }
  if (!policy.allowed || !storageReady) {
    return {
      enabled: true,
      storageReady: false,
      storageMode: "none",
      notifyReady,
      available: false,
      customerEmailOffered: false,
      message:
        "Estimate download and follow-up are temporarily unavailable. Call or text — we still want the job.",
    };
  }
  const available = true;
  return {
    enabled: true,
    storageReady: true,
    storageMode: policy.mode,
    notifyReady,
    available,
    customerEmailOffered: estimateCustomerEmailOffered(env, { followUpAvailable: available }),
    message: notifyReady
      ? "You can download your preliminary estimate and request follow-up."
      : "You can save your request and download the PDF. Shop notification may be delayed until email delivery is available.",
  };
}

export function estimateEmailAvailability(env: NodeJS.ProcessEnv = process.env) {
  const avail = estimateFollowUpAvailability(env);
  return {
    available: avail.available,
    state: avail.available ? ("available" as const) : ("unavailable" as const),
    message: avail.message,
    customerEmailOffered: avail.customerEmailOffered,
  };
}

export async function handleEstimateEmailAvailability(
  deps: { env?: NodeJS.ProcessEnv; sql?: Sql | null } = {},
): Promise<Response> {
  const env = deps.env ?? process.env;
  if (!isEstimateFollowUpEnabled(env)) {
    const availability = estimateFollowUpAvailability(env, { databaseReady: false });
    return Response.json({
      ok: false,
      state: "unavailable",
      available: false,
      message: availability.message,
    } satisfies EstimateFollowUpResult);
  }
  const policy = estimateFollowUpStoragePolicy(env);
  if (!policy.allowed) {
    const availability = estimateFollowUpAvailability(env, { databaseReady: false });
    return Response.json({
      ok: false,
      state: "unavailable",
      available: false,
      message: availability.message,
    } satisfies EstimateFollowUpResult);
  }
  let databaseReady: boolean;
  if (deps.sql !== undefined) {
    databaseReady = Boolean(deps.sql);
  } else {
    // Open only after the durable/ephemeral policy allows it — never probe PGLite on Vercel.
    databaseReady = Boolean(await defaultSql());
  }
  const availability = estimateFollowUpAvailability(env, { databaseReady });
  return Response.json({
    ok: availability.available,
    state: availability.available ? "accepted" : "unavailable",
    available: availability.available,
    customerEmailOffered: availability.customerEmailOffered,
    message: availability.message,
  } satisfies EstimateFollowUpResult);
}

async function renderSnapshotPdf(snapshot: EstimateSnapshot): Promise<Uint8Array> {
  return renderPublicEstimatePdf({
    input: snapshot.selections,
    low: snapshot.lowCents / 100,
    high: snapshot.highCents / 100,
    name: snapshot.name || "Visitor",
    issued: new Date(snapshot.issuedAt),
  });
}

async function issueDownloadForSnapshot(args: {
  sql: Sql;
  submissionId: string;
  snapshot: EstimateSnapshot;
  now: number;
  expiresAt?: Date;
  /** Prefer pre-rendered bytes so DB transactions do not hold locks during PDF generation. */
  pdfBytes?: Uint8Array;
}): Promise<{ downloadToken: string; expiresAt: Date; pdfBytes: Uint8Array }> {
  const pdfBytes = args.pdfBytes ?? await renderSnapshotPdf(args.snapshot);
  const downloadToken = randomBytes(32).toString("base64url");
  const expiresAt = args.expiresAt && args.expiresAt.getTime() > args.now
    ? args.expiresAt
    : new Date(args.now + DOWNLOAD_TTL_MS);
  await storeDownloadSnapshot({
    sql: args.sql,
    submissionId: args.submissionId,
    token: downloadToken,
    expiresAt,
    pdfBytes,
    snapshot: args.snapshot,
  });
  return { downloadToken, expiresAt, pdfBytes };
}

export async function handleEstimateEmailRequest(
  request: Request,
  deps: {
    sql?: Sql | null;
    withTransaction?: WithTransaction;
    sendMail?: typeof sendLeadEmail;
    now?: number;
    env?: NodeJS.ProcessEnv;
  } = {},
): Promise<Response> {
  const now = deps.now ?? Date.now();
  const env = deps.env ?? process.env;

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

  if (!isEstimateFollowUpEnabled(env)) {
    const availability = estimateFollowUpAvailability(env, { databaseReady: false });
    return Response.json({
      ok: false,
      state: "unavailable",
      available: false,
      leadSaved: false,
      message: availability.message,
    } satisfies EstimateFollowUpResult, { status: 503 });
  }

  // Fail closed on storage policy before reading contact details or issuing tokens.
  const policy = estimateFollowUpStoragePolicy(env);
  if (!policy.allowed) {
    const availability = estimateFollowUpAvailability(env, { databaseReady: false });
    return Response.json({
      ok: false,
      state: "unavailable",
      available: false,
      leadSaved: false,
      message: availability.message,
    } satisfies EstimateFollowUpResult, { status: 503 });
  }

  const sql = deps.sql !== undefined ? deps.sql : await defaultSql();
  const availability = estimateFollowUpAvailability(env, { databaseReady: Boolean(sql) });
  if (!sql || !availability.available) {
    return Response.json({
      ok: false,
      state: "unavailable",
      available: false,
      leadSaved: false,
      message: availability.message,
    } satisfies EstimateFollowUpResult, { status: 503 });
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

  const ip = clientIp(request);
  const contactKey = contact.email || contact.phoneDigits || contact.zip;
  const abuse = await assertEstimateEmailAbuseAllowance(sql, { ip, contactKey, now });
  if (!abuse.ok) {
    return Response.json({
      ok: false, state: "rate_limited", message: abuse.message,
    } satisfies EstimateFollowUpResult, { status: 429 });
  }

  const lowCents = Math.round(priced.low * 100);
  const highCents = Math.round(priced.high * 100);
  const totalCents = lowCents;
  const customerEmailOffered = estimateCustomerEmailOffered(env, { followUpAvailable: true });
  const wantsCustomerEmail = formString(form, "emailMeCopy").trim() === "1"
    || formString(form, "email_me_copy").trim() === "1";
  if (wantsCustomerEmail && !contact.email) {
    return Response.json({
      ok: false,
      state: "validation",
      message: "Add your email to choose “Email me a copy,” or leave that option unchecked.",
      customerEmailOffered,
      customerEmailRequested: true,
      customerEmailStatus: "needs_email",
    } satisfies EstimateFollowUpResult, { status: 400 });
  }
  const customerEmailRequested = Boolean(wantsCustomerEmail && contact.email && customerEmailOffered);
  const issuedAt = new Date(now).toISOString();
  const fingerprint = fingerprintSnapshot({
    name: contact.name,
    email: contact.email,
    phoneDigits: contact.phoneDigits,
    zip: contact.zip,
    totalCents,
    lowCents,
    highCents,
    customerEmailRequested,
    selections,
  });
  const candidate: EstimateSnapshot = {
    v: 3,
    name: contact.name,
    email: contact.email,
    phone: contact.phone,
    phoneDigits: contact.phoneDigits,
    zip: contact.zip,
    totalCents,
    lowCents,
    highCents,
    customerEmailRequested,
    selections,
    issuedAt,
    fingerprint,
  };

  const adIds = readAdIds(form);
  // Render outside any DB transaction so claim + PDF row stay short and atomic.
  let pdfBytes: Uint8Array;
  try {
    pdfBytes = await renderSnapshotPdf(candidate);
  } catch {
    return Response.json({
      ok: false,
      state: "server_error",
      leadSaved: false,
      message: "Could not prepare the estimate PDF. Call or text instead.",
    } satisfies EstimateFollowUpResult, { status: 500 });
  }

  const runPersist = async (txSql: Sql) => {
    const claim = await claimEstimateLead({
      sql: txSql,
      submissionId,
      contact,
      message: staffMessage(candidate),
      service: candidate.selections.service,
      total: candidate.totalCents / 100,
      selections: candidate.selections,
      snapshot: candidate,
      adIds,
      clientIp: ip,
    });
    const winning = await findExisting(txSql, submissionId);
    if (!winning) {
      throw new Error("claim_missing_row");
    }
    const prior = asSnapshot(winning.estimate_snapshot);
    if (!prior || prior.fingerprint !== fingerprint) {
      return { kind: "conflict" as const, winning };
    }
    if (claim === "exists") {
      return { kind: "existing" as const, snapshot: prior, winning };
    }
    const issued = await issueDownloadForSnapshot({
      sql: txSql,
      submissionId,
      snapshot: prior,
      now,
      pdfBytes,
    });
    return { kind: "claimed" as const, snapshot: prior, winning, ...issued };
  };

  const withTransaction = deps.withTransaction
    ?? (await defaultWithTransaction())
    ?? undefined;

  let persistResult: Awaited<ReturnType<typeof runPersist>>;
  try {
    persistResult = withTransaction
      ? await withTransaction(runPersist)
      : await runPersist(sql);
  } catch {
    const existingAfter = await findExisting(sql, submissionId).catch(() => null);
    return Response.json({
      ok: false,
      state: "server_error",
      leadSaved: Boolean(existingAfter),
      staffNotified: Boolean(existingAfter?.staff_email_ok),
      submissionId: existingAfter ? submissionId : undefined,
      total: existingAfter?.estimate_total_cents != null
        ? Math.round(existingAfter.estimate_total_cents / 100)
        : undefined,
      message: existingAfter
        ? "Your request was saved, but the PDF download could not be prepared. Call or text."
        : "Could not save your estimate request. Call or text instead.",
    } satisfies EstimateFollowUpResult, { status: 500 });
  }

  if (persistResult.kind === "conflict") {
    return Response.json({
      ok: false,
      state: "conflict",
      submissionId,
      leadSaved: true,
      message: "This request was already saved with different details. Refresh and submit again as a new request.",
    } satisfies EstimateFollowUpResult, { status: 409 });
  }

  const snapshot = persistResult.snapshot;
  let downloadToken: string;
  let expiresAt: Date;
  const isDuplicate = persistResult.kind === "existing";

  if (persistResult.kind === "existing") {
    const existingDownload = await findDownloadBySubmission(sql, submissionId);
    const expires = existingDownload && !existingDownload.revoked_at
      ? new Date(existingDownload.expires_at)
      : new Date(now + DOWNLOAD_TTL_MS);
    // Reuse immutable snapshot bytes when present — do not regenerate alternate totals.
    const reuseBytes = existingDownload?.pdf_bytes && !existingDownload.revoked_at
      ? (existingDownload.pdf_bytes instanceof Uint8Array
        ? existingDownload.pdf_bytes
        : new Uint8Array(existingDownload.pdf_bytes))
      : pdfBytes;
    try {
      const issued = await issueDownloadForSnapshot({
        sql,
        submissionId,
        snapshot,
        now,
        expiresAt: expires,
        pdfBytes: reuseBytes,
      });
      downloadToken = issued.downloadToken;
      expiresAt = issued.expiresAt;
    } catch {
      return Response.json({
        ok: false,
        state: "server_error",
        leadSaved: true,
        staffNotified: persistResult.winning.staff_email_ok,
        message: "Your request was saved, but the PDF download could not be prepared. Call or text.",
        submissionId,
        total: snapshot.totalCents / 100,
      } satisfies EstimateFollowUpResult, { status: 500 });
    }
  } else {
    downloadToken = persistResult.downloadToken;
    expiresAt = persistResult.expiresAt;
  }

  const alreadyNotified = persistResult.winning.staff_email_ok;
  const staffNotified = alreadyNotified
    ? true
    : await notifyJon({
      sql,
      submissionId,
      snapshot,
      env,
      sendMail: deps.sendMail,
      adIds,
    });

  let customerEmailStatus: CustomerEmailStatus = !customerEmailOffered
    ? "off"
    : !snapshot.customerEmailRequested
      ? "not_requested"
      : persistResult.winning.customer_email_ok
        ? "sent"
        : "confirm_pending";
  let customerEmailed = Boolean(persistResult.winning.customer_email_ok);

  if (
    snapshot.customerEmailRequested
    && customerEmailOffered
    && snapshot.email
    && !customerEmailed
  ) {
    const abuse = await assertCustomerEmailAbuseAllowance(sql, {
      ip,
      contactKey: snapshot.email,
      kind: "confirm",
      now,
    });
    if (!abuse.ok) {
      customerEmailStatus = "failed";
    } else {
      try {
        const issued = await issueCustomerEmailConfirm({
          sql,
          submissionId,
          email: snapshot.email,
          now,
        });
        const sent = await sendCustomerConfirmEmail({
          env,
          submissionId,
          email: snapshot.email,
          name: snapshot.name,
          low: snapshot.lowCents / 100,
          high: snapshot.highCents / 100,
          confirmToken: issued.token,
          sendMail: deps.sendMail,
        });
        customerEmailStatus = sent ? "confirm_sent" : "failed";
      } catch {
        customerEmailStatus = "failed";
      }
    }
  }

  const rangeLabel = formatEstimateRange({
    low: snapshot.lowCents / 100,
    high: snapshot.highCents / 100,
  });
  const customerNote = customerEmailStatus === "confirm_sent"
    ? " Check your email to confirm before we send the PDF copy."
    : customerEmailStatus === "failed" && snapshot.customerEmailRequested
      ? " We could not start the email-copy confirmation; your PDF download below still works."
      : customerEmailStatus === "sent"
        ? " A copy was already emailed after you confirmed."
        : "";

  return Response.json({
    ok: true,
    state: isDuplicate ? "duplicate" : "accepted",
    submissionId,
    downloadToken,
    downloadExpiresAt: expiresAt.toISOString(),
    total: snapshot.lowCents / 100,
    low: snapshot.lowCents / 100,
    high: snapshot.highCents / 100,
    leadSaved: true,
    staffNotified,
    customerEmailOffered,
    customerEmailRequested: snapshot.customerEmailRequested,
    customerEmailStatus,
    customerEmailed,
    message: (staffNotified
      ? (isDuplicate
        ? `Your request was already saved. Download your personalized preliminary estimate (${rangeLabel}) below.`
        : `Request saved. Your personalized preliminary estimate (${rangeLabel}) is ready. The Flip Fixer was notified to follow up.`)
      : (isDuplicate
        ? `Your request was already saved. Download your PDF (${rangeLabel}) below. Shop notification is still pending — try again or call.`
        : `Request saved and your PDF (${rangeLabel}) is ready. We could not notify the shop by email yet — your details are saved; call or retry if you need a faster response.`))
      + customerNote,
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
      subject: `Estimate PDF follow-up — ${args.snapshot.name || "visitor"}`,
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
        estimate_range: formatEstimateRange({
          low: args.snapshot.lowCents / 100,
          high: args.snapshot.highCents / 100,
        }),
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
  const range = formatEstimateRange({
    low: snapshot.lowCents / 100,
    high: snapshot.highCents / 100,
  });
  const customerLine = snapshot.customerEmailRequested
    ? "Visitor asked for an emailed PDF copy (pending email confirmation / double opt-in)."
    : "No customer email copy was requested.";
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
    `Server-calculated preliminary range: ${range}.`,
    "No marketing subscription.",
    customerLine,
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
    const amount = Math.round(row.snapshot_total_cents / 100);
    // Legacy download rows without stored bytes only have one amount — treat as a single-point range.
    pdf = await renderPublicEstimatePdf({
      input: selections,
      low: amount,
      high: amount,
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

/**
 * Double opt-in confirmation: send the saved PDF to the visitor after they confirm.
 * Never reprices — uses the immutable snapshot / stored PDF bytes.
 */
export async function handleEstimateCustomerEmailConfirm(
  request: Request,
  deps: {
    sql?: Sql | null;
    sendMail?: typeof sendLeadEmail;
    now?: number;
    env?: NodeJS.ProcessEnv;
  } = {},
): Promise<Response> {
  const env = deps.env ?? process.env;
  const now = deps.now ?? Date.now();
  const html = (ok: boolean, title: string, body: string) =>
    new Response(customerConfirmHtmlPage({ ok, title, body }), {
      status: ok ? 200 : 400,
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
    });

  if (!isEstimateFollowUpEnabled(env) || !estimateCustomerMailConfig(env).configured) {
    return html(false, "Estimate email unavailable", "Customer estimate email is not available right now.");
  }

  const url = new URL(request.url);
  const token = url.searchParams.get("token") || "";
  const sql = deps.sql !== undefined ? deps.sql : await defaultSql();
  if (!sql) {
    return html(false, "Estimate email unavailable", "Could not open storage for this confirmation.");
  }

  const consumed = await consumeCustomerConfirmToken({ sql, token, now });
  if (!consumed.ok) {
    return html(false, "Confirmation failed", consumed.message);
  }

  const lead = await findExisting(sql, consumed.submissionId);
  if (!lead) {
    return html(false, "Confirmation failed", "That estimate request could not be found.");
  }
  const snapshot = asSnapshot(lead.estimate_snapshot);
  if (!snapshot || !snapshot.email) {
    return html(false, "Confirmation failed", "That estimate request is missing a saved email.");
  }
  if (snapshot.email.toLowerCase() !== consumed.email.toLowerCase()) {
    return html(false, "Confirmation failed", "This confirmation does not match the saved request.");
  }

  if (lead.customer_email_ok) {
    return html(
      true,
      "Email already sent",
      "Your personalized preliminary estimate was already emailed after confirmation. You can also download it from the planner if you still have the link.",
    );
  }

  const abuse = await assertCustomerEmailAbuseAllowance(sql, {
    ip: clientIp(request),
    contactKey: snapshot.email,
    kind: "pdf",
    now,
  });
  if (!abuse.ok) {
    return html(false, "Too many requests", abuse.message);
  }

  const existingDownload = await findDownloadBySubmission(sql, consumed.submissionId);
  let pdfBytes: Uint8Array;
  if (existingDownload?.pdf_bytes && !existingDownload.revoked_at) {
    pdfBytes = existingDownload.pdf_bytes instanceof Uint8Array
      ? existingDownload.pdf_bytes
      : new Uint8Array(existingDownload.pdf_bytes);
  } else {
    pdfBytes = await renderSnapshotPdf(snapshot);
  }

  const origin = estimateSiteOrigin(env);
  let downloadUrl: string | undefined;
  try {
    const issued = await issueDownloadForSnapshot({
      sql,
      submissionId: consumed.submissionId,
      snapshot,
      now,
      pdfBytes,
    });
    downloadUrl = `${origin}/api/estimate-pdf/${encodeURIComponent(issued.downloadToken)}`;
  } catch {
    downloadUrl = undefined;
  }

  const sent = await sendCustomerPdfEmail({
    env,
    submissionId: consumed.submissionId,
    email: snapshot.email,
    name: snapshot.name,
    low: snapshot.lowCents / 100,
    high: snapshot.highCents / 100,
    pdfBytes,
    downloadUrl,
    sendMail: deps.sendMail,
  });
  if (!sent) {
    return html(
      false,
      "Could not send the PDF",
      "Your request is still saved. Try again later or use the on-page download link if you have it.",
    );
  }
  try {
    await markCustomerEmailed(sql, consumed.submissionId);
  } catch {
    // Provider accepted; flag may lag. Idempotency key prevents duplicate customer PDFs.
  }
  const range = formatEstimateRange({
    low: snapshot.lowCents / 100,
    high: snapshot.highCents / 100,
  });
  return html(
    true,
    "Estimate emailed",
    `We sent your personalized preliminary estimate (${range}) to ${snapshot.email}. This is not a marketing subscription.`,
  );
}
