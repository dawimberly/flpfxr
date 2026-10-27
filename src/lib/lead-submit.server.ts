/**
 * Server-only lead intake: validate, dedupe, email (Resend), persist (Neon).
 */
import {
  buildLeadEmailText,
  buildLeadSubject,
  isValidSubmissionId,
  validateLeadFields,
  validateLeadPhoto,
  type LeadAdIds,
  type LeadDeliveryResult,
  type LeadPayload,
} from "./lead-delivery.ts";
import { leadMailConfigFromEnv, sendLeadEmail } from "./lead-mail.ts";

const recentByIp = new Map<string, number[]>();

function pruneTimestamps(times: number[], now: number, windowMs: number) {
  return times.filter((t) => now - t < windowMs);
}

export function checkLeadRateLimit(
  ip: string,
  now = Date.now(),
  limit = 5,
  windowMs = 10 * 60 * 1000,
): boolean {
  const key = ip || "unknown";
  const next = pruneTimestamps(recentByIp.get(key) ?? [], now, windowMs);
  if (next.length >= limit) {
    recentByIp.set(key, next);
    return false;
  }
  next.push(now);
  recentByIp.set(key, next);
  return true;
}

/** Test helper — clears the in-memory rate-limit window. */
export function resetLeadRateLimitForTests() {
  recentByIp.clear();
}

function str(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
}

function readAdIds(form: FormData): LeadAdIds {
  const keys = [
    "gclid",
    "gbraid",
    "wbraid",
    "utm_source",
    "utm_campaign",
    "utm_medium",
    "utm_term",
    "utm_content",
    "referrer",
    "submitting_path",
    "device",
    "heard_from",
    "landing_path",
    "page_url",
  ] as const;
  const adIds: LeadAdIds = {};
  for (const key of keys) {
    const value = str(form, key).trim();
    if (value) adIds[key] = value.replace(/[\r\n]/g, " ").slice(0, 500);
  }
  return adIds;
}

async function fileToBase64(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  return buffer.toString("base64");
}

async function findExistingLead(submissionId: string) {
  if (!process.env.DATABASE_URL?.trim()) return null;
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const rows = await sql.query<{
    submission_id: string;
    delivered_email: boolean;
  }>("select submission_id, delivered_email from contact_leads where submission_id = $1", [
    submissionId,
  ]);
  return rows[0] ?? null;
}

async function persistLead(args: {
  payload: LeadPayload;
  phoneDigits: string;
  hasPhoto: boolean;
  deliveredEmail: boolean;
  clientIp: string;
}) {
  if (!process.env.DATABASE_URL?.trim()) return;
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  await sql.query(
    `insert into contact_leads (
       submission_id, name, email, phone, message, service, source, affiliation,
       ad_ids, has_photo, delivered_email, client_ip, is_test
     ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12,
       EXISTS (SELECT 1 FROM lead_test_exclusions WHERE submission_id = $1))
     on conflict (submission_id) do update set
       delivered_email = contact_leads.delivered_email OR excluded.delivered_email`,
    [
      args.payload.submissionId,
      args.payload.name.trim(),
      args.payload.email.trim() || null,
      args.phoneDigits,
      args.payload.message.trim(),
      args.payload.service || null,
      args.payload.source || null,
      args.payload.affiliation || null,
      JSON.stringify(args.payload.adIds),
      args.hasPhoto,
      args.deliveredEmail,
      args.clientIp || null,
    ],
  );
}

export type LeadSubmitDeps = {
  findExistingLead?: typeof findExistingLead;
  persistLead?: typeof persistLead;
  sendLeadEmail?: typeof sendLeadEmail;
  now?: number;
};

export async function handleLeadFormData(
  form: FormData,
  request: Request,
  deps: LeadSubmitDeps = {},
): Promise<Response> {
  const findExisting = deps.findExistingLead ?? findExistingLead;
  const persist = deps.persistLead ?? persistLead;
  const sendMail = deps.sendLeadEmail ?? sendLeadEmail;
  const submissionId = str(form, "submissionId").trim();
  if (!isValidSubmissionId(submissionId)) {
    return Response.json(
      {
        ok: false,
        code: "validation",
        message: "Could not send the form. Refresh and try again, or call.",
      } satisfies LeadDeliveryResult,
      { status: 400 },
    );
  }

  const honey = str(form, "_honey") || str(form, "company");
  if (honey.trim()) {
    // Silent discard for bots — never email, never Ads (client must check discarded).
    return Response.json({
      ok: true,
      discarded: true,
      submissionId,
    } satisfies LeadDeliveryResult);
  }

  const payload: LeadPayload = {
    submissionId,
    name: str(form, "name"),
    email: str(form, "email"),
    phone: str(form, "phone"),
    message: str(form, "message"),
    service: str(form, "Job") || str(form, "service"),
    source: str(form, "Source") || str(form, "source"),
    affiliation: str(form, "Affiliation") || str(form, "affiliation"),
    honey,
    adIds: readAdIds(form),
  };

  const fields = validateLeadFields(payload);
  if (!fields.ok) {
    return Response.json(
      { ok: false, code: "validation", message: fields.message } satisfies LeadDeliveryResult,
      { status: 400 },
    );
  }

  const photoField = form.get("attachment");
  const photoFile = photoField instanceof File ? photoField : null;
  const photoCheck = validateLeadPhoto(photoFile);
  if (!photoCheck.ok) {
    return Response.json(
      { ok: false, code: "validation", message: photoCheck.message } satisfies LeadDeliveryResult,
      { status: 400 },
    );
  }

  const clientIp =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "";

  if (!checkLeadRateLimit(clientIp)) {
    return Response.json(
      {
        ok: false,
        code: "rate_limited",
        message: "Too many tries from this network. Call or text instead.",
      } satisfies LeadDeliveryResult,
      { status: 429 },
    );
  }

  const existing = await findExisting(submissionId);
  if (existing?.delivered_email) {
    return Response.json({
      ok: true,
      duplicate: true,
      submissionId,
    } satisfies LeadDeliveryResult);
  }

  const mailCfg = leadMailConfigFromEnv();
  if (!mailCfg.apiKey) {
    return Response.json(
      {
        ok: false,
        code: "not_configured",
        message:
          "Lead email is not configured on the server yet. Call or text — we still want the job.",
      } satisfies LeadDeliveryResult,
      { status: 503 },
    );
  }

  let attachment:
    | { filename: string; contentBase64: string; contentType?: string }
    | undefined;
  if (photoCheck.file) {
    attachment = {
      filename: photoCheck.file.name || "job-photo.jpg",
      contentBase64: await fileToBase64(photoCheck.file),
      contentType: photoCheck.file.type || undefined,
    };
  }

  const mail = await sendMail(
    {
      to: mailCfg.to,
      submissionId,
      from: mailCfg.from,
      replyTo: payload.email.trim() || undefined,
      subject: buildLeadSubject(payload.service, payload.source, payload.adIds),
      text: buildLeadEmailText({ ...payload, phoneDigits: fields.phoneDigits }),
      attachments: attachment ? [attachment] : undefined,
    },
    mailCfg.apiKey,
  );

  if (!mail.ok) {
    try {
      await persist({
        payload,
        phoneDigits: fields.phoneDigits,
        hasPhoto: Boolean(photoCheck.file),
        deliveredEmail: false,
        clientIp,
      });
    } catch {
      // Persistence is best-effort when mail failed.
    }
    return Response.json(
      {
        ok: false,
        code: "delivery_failed",
        message: "Could not deliver the message. Call or text instead.",
      } satisfies LeadDeliveryResult,
      { status: 502 },
    );
  }

  try {
    await persist({
      payload,
      phoneDigits: fields.phoneDigits,
      hasPhoto: Boolean(photoCheck.file),
      deliveredEmail: true,
      clientIp,
    });
  } catch {
    console.error("[leads] persist after email failed");
    // Email already accepted — still report success so the visitor is not asked to resend.
  }

  return Response.json({
    ok: true,
    submissionId,
  } satisfies LeadDeliveryResult);
}
