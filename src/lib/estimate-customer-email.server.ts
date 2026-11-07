/**
 * Optional customer estimate PDF email (double opt-in).
 * Default OFF via ESTIMATE_CUSTOMER_EMAIL_ENABLED. Never trusts browser staff recipients.
 */
import { createHash, randomBytes } from "node:crypto";
import { leadMailConfigFromEnv, sendLeadEmail } from "./lead-mail.ts";
import { formatEstimateRange, PRELIMINARY_ESTIMATE_WORDING } from "./public-estimate-display.ts";
import { SITE } from "./site.ts";

function estimateSiteOrigin(env: NodeJS.ProcessEnv = process.env): string {
  const configured = env.PUBLIC_SITE_URL?.trim() || SITE.url;
  return configured.replace(/\/+$/, "");
}

export const ESTIMATE_CUSTOMER_EMAIL_FLAG = "ESTIMATE_CUSTOMER_EMAIL_ENABLED";
export const CUSTOMER_CONFIRM_TTL_MS = 24 * 60 * 60 * 1000;
export const CUSTOMER_EMAIL_ABUSE = {
  confirmPerContactHour: 3,
  confirmIpPerWindow: 5,
  pdfPerContactHour: 3,
} as const;

export type CustomerEmailStatus =
  | "off"
  | "not_requested"
  | "needs_email"
  | "confirm_sent"
  | "confirm_pending"
  | "sent"
  | "failed"
  | "unavailable";

type Sql = { query<T>(text: string, params?: unknown[]): Promise<T[]> };

export function isEstimateCustomerEmailEnabled(env: NodeJS.ProcessEnv = process.env) {
  return /^(1|true|yes)$/i.test(env[ESTIMATE_CUSTOMER_EMAIL_FLAG]?.trim() || "");
}

/** Offered only when follow-up is available AND the customer-email flag is on AND Resend is configured. */
export function estimateCustomerEmailOffered(
  env: NodeJS.ProcessEnv = process.env,
  opts: { followUpAvailable: boolean } = { followUpAvailable: false },
) {
  if (!opts.followUpAvailable) return false;
  if (!isEstimateCustomerEmailEnabled(env)) return false;
  return Boolean(leadMailConfigFromEnv(env).apiKey);
}

export function estimateCustomerMailConfig(env: NodeJS.ProcessEnv = process.env) {
  const lead = leadMailConfigFromEnv(env);
  const deliveryFlag = isEstimateCustomerEmailEnabled(env);
  const hasApiKey = Boolean(lead.apiKey);
  const senderOk = Boolean(lead.from);
  return {
    apiKey: lead.apiKey,
    from: lead.from,
    configured: deliveryFlag && hasApiKey && senderOk,
    deliveryFlag,
    senderOk,
    hasApiKey,
    setupNeeded: !deliveryFlag
      ? (["flag_off"] as string[])
      : (!hasApiKey || !senderOk ? ["resend"] as string[] : null),
  };
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function hourWindowStart(now: number) {
  const d = new Date(now);
  d.setUTCMinutes(0, 0, 0);
  return d;
}

export async function assertCustomerEmailAbuseAllowance(
  sql: Sql,
  args: { ip: string; contactKey: string; kind: "confirm" | "pdf"; now?: number },
): Promise<{ ok: true } | { ok: false; message: string }> {
  const now = args.now ?? Date.now();
  const limit = args.kind === "confirm"
    ? CUSTOMER_EMAIL_ABUSE.confirmPerContactHour
    : CUSTOMER_EMAIL_ABUSE.pdfPerContactHour;
  const checks = [
    { bucket: `customer-${args.kind}-contact:${args.contactKey}`, window: hourWindowStart(now), limit },
    {
      bucket: `customer-${args.kind}-ip:${args.ip || "unknown"}`,
      window: hourWindowStart(now),
      limit: CUSTOMER_EMAIL_ABUSE.confirmIpPerWindow,
    },
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
          message: "Too many estimate email requests. Use the on-page PDF download, or try again later.",
        };
      }
    }
    return { ok: true };
  } catch {
    return {
      ok: false,
      message: "Estimate email protection is temporarily unavailable. Use the on-page PDF download instead.",
    };
  }
}

export async function issueCustomerEmailConfirm(args: {
  sql: Sql;
  submissionId: string;
  email: string;
  now: number;
}): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(args.now + CUSTOMER_CONFIRM_TTL_MS);
  await args.sql.query(
    `insert into estimate_customer_email_confirm (token_hash, submission_id, email, expires_at)
     values ($1, $2, $3, $4)
     on conflict (token_hash) do nothing`,
    [hashToken(token), args.submissionId, args.email.toLowerCase(), expiresAt.toISOString()],
  );
  return { token, expiresAt };
}

export function buildCustomerConfirmEmailText(args: {
  name: string;
  confirmUrl: string;
  rangeLabel: string;
}) {
  const who = args.name.trim() || "there";
  return [
    `Hi ${who},`,
    "",
    "Confirm your email to receive your personalized preliminary estimate from The Flip Fixer.",
    `Saved preliminary range: ${args.rangeLabel}.`,
    "",
    `Confirm and receive the PDF: ${args.confirmUrl}`,
    "",
    "This link expires in 24 hours and is only for this estimate request.",
    "If you did not ask for an estimate copy, ignore this message — nothing else will be sent.",
    "This is not a marketing subscription.",
    "",
    PRELIMINARY_ESTIMATE_WORDING,
    "",
    SITE.legalName,
    SITE.url,
  ].join("\n");
}

export function buildCustomerPdfEmailText(args: {
  name: string;
  rangeLabel: string;
  downloadUrl?: string;
}) {
  const who = args.name.trim() || "there";
  return [
    `Hi ${who},`,
    "",
    "Attached is your personalized preliminary estimate from The Flip Fixer.",
    `Saved preliminary range: ${args.rangeLabel}.`,
    args.downloadUrl ? `Private download (expires): ${args.downloadUrl}` : "",
    "",
    "This is the same saved range from your request — not a new price.",
    "This is not a marketing subscription.",
    "",
    PRELIMINARY_ESTIMATE_WORDING,
    "",
    SITE.legalName,
    SITE.phoneDisplay,
    SITE.url,
  ].filter(Boolean).join("\n");
}

export async function sendCustomerConfirmEmail(args: {
  env: NodeJS.ProcessEnv;
  submissionId: string;
  email: string;
  name: string;
  low: number;
  high: number;
  confirmToken: string;
  sendMail?: typeof sendLeadEmail;
}): Promise<boolean> {
  const cfg = estimateCustomerMailConfig(args.env);
  if (!cfg.configured || !cfg.apiKey) return false;
  const origin = estimateSiteOrigin(args.env);
  const confirmUrl = `${origin}/api/estimate-email-confirm?token=${encodeURIComponent(args.confirmToken)}`;
  const rangeLabel = formatEstimateRange({ low: args.low, high: args.high });
  const sendMail = args.sendMail ?? sendLeadEmail;
  const result = await sendMail(
    {
      submissionId: args.submissionId,
      to: args.email,
      from: cfg.from,
      subject: "Confirm your Flip Fixer estimate email",
      text: buildCustomerConfirmEmailText({
        name: args.name,
        confirmUrl,
        rangeLabel,
      }),
      idempotencyKey: `estimate-followup-customer-confirm/${args.submissionId}`,
    },
    cfg.apiKey,
  ).catch(() => ({ ok: false as const, status: 0, message: "confirm failed" }));
  if (!result.ok) {
    console.error("[estimate-followup] customer confirm email failed", {
      submissionId: args.submissionId,
      status: "status" in result ? result.status : 0,
    });
    return false;
  }
  return true;
}

export async function sendCustomerPdfEmail(args: {
  env: NodeJS.ProcessEnv;
  submissionId: string;
  email: string;
  name: string;
  low: number;
  high: number;
  pdfBytes: Uint8Array;
  downloadUrl?: string;
  sendMail?: typeof sendLeadEmail;
}): Promise<boolean> {
  const cfg = estimateCustomerMailConfig(args.env);
  if (!cfg.configured || !cfg.apiKey) return false;
  const rangeLabel = formatEstimateRange({ low: args.low, high: args.high });
  const sendMail = args.sendMail ?? sendLeadEmail;
  const result = await sendMail(
    {
      submissionId: args.submissionId,
      to: args.email,
      from: cfg.from,
      subject: "Your Flip Fixer preliminary estimate",
      text: buildCustomerPdfEmailText({
        name: args.name,
        rangeLabel,
        downloadUrl: args.downloadUrl,
      }),
      attachments: [{
        filename: "Flip-Fixer-preliminary-estimate.pdf",
        contentBase64: Buffer.from(args.pdfBytes).toString("base64"),
        contentType: "application/pdf",
      }],
      idempotencyKey: `estimate-followup-customer-pdf/${args.submissionId}`,
    },
    cfg.apiKey,
  ).catch(() => ({ ok: false as const, status: 0, message: "pdf email failed" }));
  if (!result.ok) {
    console.error("[estimate-followup] customer PDF email failed", {
      submissionId: args.submissionId,
      status: "status" in result ? result.status : 0,
    });
    return false;
  }
  return true;
}

export async function markCustomerEmailed(sql: Sql, submissionId: string) {
  await sql.query(
    `update contact_leads set customer_email_ok = true, updated_at = now() where submission_id = $1`,
    [submissionId],
  );
}

export async function consumeCustomerConfirmToken(args: {
  sql: Sql;
  token: string;
  now: number;
}): Promise<
  | { ok: true; submissionId: string; email: string }
  | { ok: false; status: number; message: string }
> {
  const clean = args.token.trim();
  if (!/^[A-Za-z0-9_-]{20,200}$/.test(clean)) {
    return { ok: false, status: 404, message: "This confirmation link is not valid." };
  }
  const tokenHash = hashToken(clean);
  const rows = await args.sql.query<{
    submission_id: string;
    email: string;
    expires_at: string | Date;
    confirmed_at: string | Date | null;
  }>(
    `select submission_id, email, expires_at, confirmed_at
     from estimate_customer_email_confirm where token_hash = $1`,
    [tokenHash],
  );
  const row = rows[0];
  if (!row) return { ok: false, status: 404, message: "This confirmation link is not valid." };
  if (row.confirmed_at) {
    return { ok: true, submissionId: row.submission_id, email: row.email };
  }
  const expires = new Date(row.expires_at).getTime();
  if (!Number.isFinite(expires) || expires < args.now) {
    return { ok: false, status: 410, message: "This confirmation link has expired." };
  }
  await args.sql.query(
    `update estimate_customer_email_confirm
     set confirmed_at = coalesce(confirmed_at, $2::timestamptz)
     where token_hash = $1`,
    [tokenHash, new Date(args.now).toISOString()],
  );
  return { ok: true, submissionId: row.submission_id, email: row.email };
}

export function customerConfirmHtmlPage(args: { ok: boolean; title: string; body: string }) {
  const tone = args.ok ? "#1a3a40" : "#5c2b1e";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${args.title}</title></head><body style="font-family:system-ui,sans-serif;max-width:36rem;margin:2rem auto;padding:0 1rem;color:${tone}"><h1 style="font-size:1.35rem">${args.title}</h1><p>${args.body}</p><p><a href="${SITE.url}/estimate">Return to the estimate planner</a></p></body></html>`;
}
