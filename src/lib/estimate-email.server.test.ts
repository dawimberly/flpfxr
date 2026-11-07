import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import {
  ABUSE_LIMITS,
  DOWNLOAD_TTL_MS,
  ESTIMATE_FOLLOWUP_EPHEMERAL_FLAG,
  ESTIMATE_STAFF_NOTIFY_TO,
  allowsEstimateFollowUpEphemeralStorage,
  estimateCustomerMailConfig,
  estimateEmailAvailability,
  estimateFollowUpStoragePolicy,
  handleEstimateEmailAvailability,
  handleEstimateEmailRequest,
  handleEstimatePdfDownload,
  isEstimateFollowUpServerlessHost,
  revokeEstimatePdfToken,
  validateEstimateFollowUpContact,
} from "./estimate-email.server.ts";
import { DEFAULT_PROJECT_INPUTS } from "./public-estimate-options.ts";
import { publicEstimateResult } from "./public-estimate-result.server.ts";
import { renderPublicEstimatePdf } from "./public-estimate-pdf.server.ts";

function formFrom(fields: Record<string, string>) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  return form;
}

type LeadRow = {
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

type DownloadRow = {
  token_hash: string;
  submission_id: string;
  expires_at: string;
  pdf_bytes: Buffer | null;
  snapshot_total_cents: number | null;
  snapshot_name: string | null;
  snapshot_selections: unknown;
  revoked_at: string | null;
  download_count: number;
  last_download_at: string | null;
  created_at: string;
};

function createMemorySql() {
  const abuse = new Map<string, number>();
  const leads = new Map<string, LeadRow>();
  const downloads = new Map<string, DownloadRow>();

  const sql = {
    abuse,
    leads,
    downloads,
    async query<T>(text: string, params: unknown[] = []): Promise<T[]> {
      const sqlText = text.replace(/\s+/g, " ").trim();

      if (/insert into estimate_email_abuse/i.test(sqlText)) {
        const key = `${params[0]}|${params[1]}`;
        const next = (abuse.get(key) ?? 0) + 1;
        abuse.set(key, next);
        return [{ hit_count: next }] as T[];
      }

      if (/from contact_leads where submission_id/i.test(sqlText) && /select submission_id, name/i.test(sqlText)) {
        const row = leads.get(String(params[0]));
        return (row ? [row] : []) as T[];
      }

      if (/insert into contact_leads/i.test(sqlText)) {
        const submissionId = String(params[0]);
        if (leads.has(submissionId)) {
          return [] as T[]; // on conflict do nothing
        }
        leads.set(submissionId, {
          submission_id: submissionId,
          name: String(params[1]),
          email: params[2] == null ? null : String(params[2]),
          phone: params[3] == null ? null : String(params[3]),
          marketing_consent: false,
          estimate_total_cents: Number(params[9]),
          planner_inputs: JSON.parse(String(params[10])),
          estimate_snapshot: JSON.parse(String(params[11])),
          customer_email_ok: false,
          staff_email_ok: false,
          delivered_email: false,
        });
        return [{ submission_id: submissionId }] as T[];
      }

      if (/update contact_leads set/i.test(sqlText) && /staff_email_ok = true/i.test(sqlText)) {
        const row = leads.get(String(params[0]));
        if (row) {
          row.staff_email_ok = true;
          row.delivered_email = true;
        }
        return [] as T[];
      }

      if (/insert into estimate_pdf_downloads/i.test(sqlText)) {
        const tokenHash = String(params[0]);
        if (!downloads.has(tokenHash)) {
          downloads.set(tokenHash, {
            token_hash: tokenHash,
            submission_id: String(params[1]),
            expires_at: String(params[2]),
            pdf_bytes: Buffer.isBuffer(params[3]) ? params[3] : Buffer.from(params[3] as Uint8Array),
            snapshot_total_cents: Number(params[4]),
            snapshot_name: String(params[5]),
            snapshot_selections: JSON.parse(String(params[6])),
            revoked_at: null,
            download_count: 0,
            last_download_at: null,
            created_at: new Date().toISOString(),
          });
        }
        return [] as T[];
      }

      if (/from estimate_pdf_downloads/i.test(sqlText) && /where submission_id/i.test(sqlText)) {
        const rows = [...downloads.values()]
          .filter((row) => row.submission_id === String(params[0]))
          .sort((a, b) => b.created_at.localeCompare(a.created_at));
        return (rows[0] ? [rows[0]] : []) as T[];
      }

      if (/from estimate_pdf_downloads/i.test(sqlText) && /where token_hash/i.test(sqlText)) {
        const row = downloads.get(String(params[0]));
        return (row ? [row] : []) as T[];
      }

      if (/update estimate_pdf_downloads/i.test(sqlText) && /revoked_at/i.test(sqlText) && !/download_count/i.test(sqlText)) {
        const row = downloads.get(String(params[0]));
        if (row) {
          row.revoked_at = row.revoked_at ?? String(params[1]);
          return [{ token_hash: row.token_hash }] as T[];
        }
        return [] as T[];
      }

      if (/update estimate_pdf_downloads/i.test(sqlText) && /download_count/i.test(sqlText)) {
        const row = downloads.get(String(params[0]));
        if (row) {
          row.download_count += 1;
          row.last_download_at = String(params[1]);
        }
        return [] as T[];
      }

      throw new Error(`Unhandled SQL in memory store: ${sqlText.slice(0, 120)}`);
    },
  };

  return sql;
}

const baseFields = () => ({
  submissionId: randomUUID(),
  name: "Alex Sample",
  email: "alex.sample@example.com",
  phone: "",
  zip: "78209",
  selections: JSON.stringify({ ...DEFAULT_PROJECT_INPUTS, includeFlooring: false }),
});

describe("estimate follow-up download", () => {
  beforeEach(() => {
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.LEAD_FROM_EMAIL = "The Flip Fixer <leads@theflipfixer.com>";
    process.env.DATABASE_URL = "postgres://test";
    process.env.ESTIMATE_FOLLOWUP_ENABLED = "1";
    delete process.env.ESTIMATE_EMAIL_DELIVERY;
  });

  it("requires email or phone plus a five-digit ZIP; name is optional", () => {
    assert.equal(validateEstimateFollowUpContact({
      name: "", email: "", phone: "", zip: "78209",
    }).ok, false);
    assert.equal(validateEstimateFollowUpContact({
      name: "", email: "alex@example.com", phone: "", zip: "782",
    }).ok, false);
    assert.equal(validateEstimateFollowUpContact({
      name: "", email: "alex@example.com", phone: "", zip: "78209",
    }).ok, true);
    const phoneOnly = validateEstimateFollowUpContact({
      name: "", email: "", phone: "(210) 436-9117", zip: "78209",
    });
    assert.equal(phoneOnly.ok, true);
    if (phoneOnly.ok) {
      assert.equal(phoneOnly.contact.phoneDigits, "2104369117");
      assert.equal(phoneOnly.contact.phone, "(210) 436-9117");
    }
    assert.equal(validateEstimateFollowUpContact({
      name: "Alex Sample", email: "alex@example.com", phone: "(210) 436-9117", zip: "78209",
    }).ok, true);
    assert.equal(validateEstimateFollowUpContact({
      name: "", email: "", phone: "https://evil.example/x", zip: "78209",
    }).ok, false);
  });

  it("keeps customer email delivery retired even when Resend is configured", () => {
    const cfg = estimateCustomerMailConfig({
      RESEND_API_KEY: "re_test",
      ESTIMATE_FROM_EMAIL: "The Flip Fixer <leads@theflipfixer.com>",
      ESTIMATE_EMAIL_DELIVERY: "1",
    });
    assert.equal(cfg.configured, false);
    assert.equal(cfg.staffTo, ESTIMATE_STAFF_NOTIFY_TO);
  });

  it("keeps the follow-up feature unavailable when the release gate is off", () => {
    assert.equal(estimateEmailAvailability({
      DATABASE_URL: "postgres://x",
      ESTIMATE_FOLLOWUP_ENABLED: undefined,
    }).available, false);
    assert.equal(estimateEmailAvailability({
      DATABASE_URL: "postgres://x",
      ESTIMATE_FOLLOWUP_ENABLED: "1",
    }).available, true);
    const down = estimateEmailAvailability({ ESTIMATE_FOLLOWUP_ENABLED: "1" });
    assert.equal(down.available, false);
    assert.doesNotMatch(down.message, /RESEND|ESTIMATE_FOLLOWUP|DATABASE_URL|PGLite|onboarding@/i);
  });

  it("requires durable DATABASE_URL on Vercel/serverless and never honors ephemeral opt-in there", () => {
    const vercelNoDb = {
      ESTIMATE_FOLLOWUP_ENABLED: "1",
      VERCEL: "1",
      [ESTIMATE_FOLLOWUP_EPHEMERAL_FLAG]: "1",
    };
    assert.equal(isEstimateFollowUpServerlessHost(vercelNoDb), true);
    assert.equal(allowsEstimateFollowUpEphemeralStorage(vercelNoDb), false);
    assert.deepEqual(estimateFollowUpStoragePolicy(vercelNoDb), { allowed: false, mode: "none" });
    assert.equal(estimateEmailAvailability(vercelNoDb).available, false);
    assert.doesNotMatch(
      estimateEmailAvailability(vercelNoDb).message,
      /DATABASE_URL|PGLite|VERCEL|ESTIMATE_FOLLOWUP|ephemeral/i,
    );
  });

  it("allows explicit local ephemeral PGLite only off serverless hosts", () => {
    const local = {
      ESTIMATE_FOLLOWUP_ENABLED: "1",
      [ESTIMATE_FOLLOWUP_EPHEMERAL_FLAG]: "1",
    };
    assert.equal(isEstimateFollowUpServerlessHost(local), false);
    assert.equal(allowsEstimateFollowUpEphemeralStorage(local), true);
    assert.deepEqual(estimateFollowUpStoragePolicy(local), { allowed: true, mode: "ephemeral" });
    assert.equal(estimateEmailAvailability(local).available, true);

    const withoutOptIn = { ESTIMATE_FOLLOWUP_ENABLED: "1" };
    assert.deepEqual(estimateFollowUpStoragePolicy(withoutOptIn), { allowed: false, mode: "none" });
    assert.equal(estimateEmailAvailability(withoutOptIn).available, false);
  });

  it("accepts email-only, phone-only, and both; notifies Jon only; never emails the customer", async () => {
    for (const contact of [
      { email: "alex.sample@example.com", phone: "" },
      { email: "", phone: "2104369117" },
      { email: "alex.sample@example.com", phone: "2104369117" },
    ]) {
      const sql = createMemorySql();
      const sent: Array<{ to: string; subject: string; text: string; attachments?: unknown[] }> = [];
      const response = await handleEstimateEmailRequest(new Request("https://theflipfixer.com/api/estimate-email", {
        method: "POST",
        body: formFrom({ ...baseFields(), ...contact }),
      }), {
        sql,
        env: process.env,
        sendMail: async (input) => {
          sent.push(input);
          return { ok: true, id: "mock_" + sent.length };
        },
      });
      const body = await response.json() as {
        ok: boolean; state: string; downloadToken?: string; staffNotified?: boolean; leadSaved?: boolean; total?: number;
      };
      assert.equal(response.status, 200);
      assert.equal(body.ok, true);
      assert.equal(body.leadSaved, true);
      assert.equal(body.staffNotified, true);
      assert.ok(body.downloadToken);
      assert.equal(sent.length, 1);
      assert.equal(sent[0].to.toLowerCase(), ESTIMATE_STAFF_NOTIFY_TO);
      assert.notEqual(sent[0].to.toLowerCase(), "alex.sample@example.com");
      assert.equal(sent[0].attachments, undefined);
      assert.match(sent[0].text, /No customer email was sent/i);
      assert.match(sent[0].text, /ZIP: 78209/);
    }
  });

  it("rejects missing contact details, invalid ZIP, and forged totals", async () => {
    const sql = createMemorySql();
    const sendMail = async () => ({ ok: true as const, id: "x" });

    const missing = await handleEstimateEmailRequest(new Request("https://theflipfixer.com/api/estimate-email", {
      method: "POST",
      body: formFrom({ ...baseFields(), email: "", phone: "" }),
    }), { sql, sendMail });
    assert.equal(missing.status, 400);

    const badZip = await handleEstimateEmailRequest(new Request("https://theflipfixer.com/api/estimate-email", {
      method: "POST",
      body: formFrom({ ...baseFields(), zip: "78" }),
    }), { sql, sendMail });
    assert.equal(badZip.status, 400);

    const expected = publicEstimateResult({ ...DEFAULT_PROJECT_INPUTS, includeFlooring: false })!.total;
    const forged = await handleEstimateEmailRequest(new Request("https://theflipfixer.com/api/estimate-email", {
      method: "POST",
      body: formFrom({ ...baseFields(), displayedTotal: "999999" }),
    }), {
      sql,
      sendMail: async (input) => {
        assert.match(input.text, /\$12,000/);
        return { ok: true, id: "ok" };
      },
    });
    const body = await forged.json() as { total: number };
    assert.equal(forged.status, 200);
    assert.equal(body.total, expected);
    assert.notEqual(body.total, 999999);
  });

  it("rejects conflicting retries and does not duplicate Jon notifications", async () => {
    const sql = createMemorySql();
    const submissionId = randomUUID();
    let sends = 0;
    const sendMail = async () => {
      sends += 1;
      return { ok: true as const, id: "m" + sends };
    };
    const first = await handleEstimateEmailRequest(new Request("https://theflipfixer.com/api/estimate-email", {
      method: "POST",
      body: formFrom({ ...baseFields(), submissionId }),
    }), { sql, sendMail });
    assert.equal(first.status, 200);
    assert.equal(sends, 1);

    const conflict = await handleEstimateEmailRequest(new Request("https://theflipfixer.com/api/estimate-email", {
      method: "POST",
      body: formFrom({ ...baseFields(), submissionId, email: "other@example.com" }),
    }), { sql, sendMail });
    assert.equal(conflict.status, 409);
    assert.equal(sends, 1);

    const duplicate = await handleEstimateEmailRequest(new Request("https://theflipfixer.com/api/estimate-email", {
      method: "POST",
      body: formFrom({ ...baseFields(), submissionId }),
    }), { sql, sendMail });
    assert.equal(duplicate.status, 200);
    const body = await duplicate.json() as { state: string; downloadToken?: string; staffNotified?: boolean };
    assert.equal(body.state, "duplicate");
    assert.ok(body.downloadToken);
    assert.equal(body.staffNotified, true);
    assert.equal(sends, 1);
    assert.equal(sql.leads.size, 1);
  });

  it("keeps the lead and PDF when staff notification fails, without claiming delivery", async () => {
    const sql = createMemorySql();
    const response = await handleEstimateEmailRequest(new Request("https://theflipfixer.com/api/estimate-email", {
      method: "POST",
      body: formFrom(baseFields()),
    }), {
      sql,
      sendMail: async () => ({ ok: false, status: 500, message: "provider down" }),
    });
    const body = await response.json() as {
      ok: boolean; leadSaved?: boolean; staffNotified?: boolean; downloadToken?: string; message: string;
    };
    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.leadSaved, true);
    assert.equal(body.staffNotified, false);
    assert.ok(body.downloadToken);
    assert.match(body.message, /could not notify/i);
    assert.equal([...sql.leads.values()][0].staff_email_ok, false);
    assert.equal([...sql.leads.values()][0].customer_email_ok, false);
  });

  it("retries staff notification safely after a prior notify failure", async () => {
    const sql = createMemorySql();
    const submissionId = randomUUID();
    let sends = 0;
    await handleEstimateEmailRequest(new Request("https://theflipfixer.com/api/estimate-email", {
      method: "POST",
      body: formFrom({ ...baseFields(), submissionId }),
    }), {
      sql,
      sendMail: async () => ({ ok: false, status: 500, message: "down" }),
    });
    const retry = await handleEstimateEmailRequest(new Request("https://theflipfixer.com/api/estimate-email", {
      method: "POST",
      body: formFrom({ ...baseFields(), submissionId }),
    }), {
      sql,
      sendMail: async (input) => {
        sends += 1;
        assert.equal(input.to.toLowerCase(), ESTIMATE_STAFF_NOTIFY_TO);
        return { ok: true, id: "recovered" };
      },
    });
    const body = await retry.json() as { staffNotified?: boolean; downloadToken?: string };
    assert.equal(retry.status, 200);
    assert.equal(body.staffNotified, true);
    assert.ok(body.downloadToken);
    assert.equal(sends, 1);
    assert.equal(sql.leads.size, 1);
  });

  it("enforces durable abuse limits across shared store instances", async () => {
    const shared = createMemorySql();
    const sendMail = async () => ({ ok: true as const, id: "m" });
    for (let i = 0; i < ABUSE_LIMITS.contactPerHour; i += 1) {
      const ok = await handleEstimateEmailRequest(new Request("https://theflipfixer.com/api/estimate-email", {
        method: "POST",
        body: formFrom({ ...baseFields(), submissionId: randomUUID(), email: "same.person@example.com" }),
      }), { sql: shared, sendMail });
      assert.equal(ok.status, 200);
    }
    const blocked = await handleEstimateEmailRequest(new Request("https://theflipfixer.com/api/estimate-email", {
      method: "POST",
      body: formFrom({ ...baseFields(), submissionId: randomUUID(), email: "same.person@example.com" }),
    }), { sql: shared, sendMail });
    assert.equal(blocked.status, 429);
  });

  it("fails closed when storage is unavailable and does not invent success", async () => {
    const response = await handleEstimateEmailRequest(new Request("https://theflipfixer.com/api/estimate-email", {
      method: "POST",
      body: formFrom(baseFields()),
    }), {
      sql: null,
      env: { ...process.env, DATABASE_URL: "", ESTIMATE_FOLLOWUP_ENABLED: "1" },
      sendMail: async () => ({ ok: true, id: "x" }),
    });
    const body = await response.json() as { state: string; leadSaved?: boolean; setupNeeded?: unknown };
    assert.equal(response.status, 503);
    assert.equal(body.state, "unavailable");
    assert.equal(body.leadSaved, false);
    assert.equal(body.setupNeeded, undefined);
  });

  it("fails closed on Vercel without DATABASE_URL before collecting contact or notifying", async () => {
    const sql = createMemorySql();
    let sends = 0;
    const response = await handleEstimateEmailRequest(new Request("https://theflipfixer.com/api/estimate-email", {
      method: "POST",
      body: formFrom(baseFields()),
    }), {
      sql,
      env: {
        ESTIMATE_FOLLOWUP_ENABLED: "1",
        VERCEL: "1",
        DATABASE_URL: "",
        [ESTIMATE_FOLLOWUP_EPHEMERAL_FLAG]: "1",
        RESEND_API_KEY: "re_test_key",
        LEAD_FROM_EMAIL: "The Flip Fixer <leads@theflipfixer.com>",
      },
      sendMail: async () => {
        sends += 1;
        return { ok: true, id: "x" };
      },
    });
    assert.equal(response.status, 503);
    assert.equal(sql.leads.size, 0);
    assert.equal(sql.downloads.size, 0);
    assert.equal(sends, 0);
    const avail = await handleEstimateEmailAvailability({
      env: {
        ESTIMATE_FOLLOWUP_ENABLED: "1",
        VERCEL: "1",
        DATABASE_URL: "",
        [ESTIMATE_FOLLOWUP_EPHEMERAL_FLAG]: "1",
      },
      sql,
    });
    const availBody = await avail.json() as { available?: boolean };
    assert.equal(availBody.available, false);
  });

  it("fails closed when durable storage is configured but the client is unavailable", async () => {
    const response = await handleEstimateEmailRequest(new Request("https://theflipfixer.com/api/estimate-email", {
      method: "POST",
      body: formFrom(baseFields()),
    }), {
      sql: null,
      env: {
        ESTIMATE_FOLLOWUP_ENABLED: "1",
        VERCEL: "1",
        DATABASE_URL: "postgres://configured-but-down",
        RESEND_API_KEY: "re_test_key",
        LEAD_FROM_EMAIL: "The Flip Fixer <leads@theflipfixer.com>",
      },
      sendMail: async () => ({ ok: true, id: "x" }),
    });
    assert.equal(response.status, 503);
    const body = await response.json() as { leadSaved?: boolean; available?: boolean };
    assert.equal(body.leadSaved, false);
    assert.equal(body.available, false);
  });

  it("does not collect when the release gate is disabled", async () => {
    const sql = createMemorySql();
    const response = await handleEstimateEmailRequest(new Request("https://theflipfixer.com/api/estimate-email", {
      method: "POST",
      body: formFrom(baseFields()),
    }), {
      sql,
      env: { ...process.env, ESTIMATE_FOLLOWUP_ENABLED: "0" },
      sendMail: async () => {
        throw new Error("should not send");
      },
    });
    assert.equal(response.status, 503);
    assert.equal(sql.leads.size, 0);
  });

  it("serves the stored PDF snapshot and ignores later pricing changes", async () => {
    const sql = createMemorySql();
    const accepted = await handleEstimateEmailRequest(new Request("https://theflipfixer.com/api/estimate-email", {
      method: "POST",
      body: formFrom(baseFields()),
    }), {
      sql,
      sendMail: async () => ({ ok: true, id: "mock" }),
    });
    const body = await accepted.json() as { downloadToken: string };
    const download = [...sql.downloads.values()][0];
    download.snapshot_total_cents = 99999900;
    const pdf = await handleEstimatePdfDownload(
      new Request(`https://theflipfixer.com/api/estimate-pdf/${body.downloadToken}`),
      body.downloadToken,
      { sql },
    );
    assert.equal(pdf.status, 200);
    assert.equal(pdf.headers.get("referrer-policy"), "no-referrer");
    assert.match(pdf.headers.get("cache-control") || "", /no-store/);
    assert.ok((await pdf.arrayBuffer()).byteLength > 500);
  });

  it("blocks unauthorized, expired, and revoked downloads", async () => {
    const missing = await handleEstimatePdfDownload(
      new Request("https://theflipfixer.com/api/estimate-pdf/not-a-real-token"),
      "not-a-real-token",
      { sql: createMemorySql() },
    );
    assert.equal(missing.status, 404);

    const sql = createMemorySql();
    const token = "abcdefghijklmnopqrstuvwx";
    const hash = createHash("sha256").update(token).digest("hex");
    sql.downloads.set(hash, {
      token_hash: hash,
      submission_id: randomUUID(),
      expires_at: new Date(Date.now() - 1000).toISOString(),
      pdf_bytes: Buffer.from("%PDF-1.4 expired"),
      snapshot_total_cents: 1200000,
      snapshot_name: "Alex Sample",
      snapshot_selections: DEFAULT_PROJECT_INPUTS,
      revoked_at: null,
      download_count: 0,
      last_download_at: null,
      created_at: new Date().toISOString(),
    });
    assert.equal((await handleEstimatePdfDownload(
      new Request(`https://theflipfixer.com/api/estimate-pdf/${token}`),
      token,
      { sql },
    )).status, 410);

    const live = "abcdefghijklmnopqrstu123";
    const liveHash = createHash("sha256").update(live).digest("hex");
    sql.downloads.set(liveHash, {
      token_hash: liveHash,
      submission_id: randomUUID(),
      expires_at: new Date(Date.now() + DOWNLOAD_TTL_MS).toISOString(),
      pdf_bytes: Buffer.from("%PDF-1.4 live"),
      snapshot_total_cents: 1200000,
      snapshot_name: "Alex Sample",
      snapshot_selections: DEFAULT_PROJECT_INPUTS,
      revoked_at: null,
      download_count: 0,
      last_download_at: null,
      created_at: new Date().toISOString(),
    });
    assert.equal(await revokeEstimatePdfToken(live, { sql }), true);
    assert.equal((await handleEstimatePdfDownload(
      new Request(`https://theflipfixer.com/api/estimate-pdf/${live}`),
      live,
      { sql },
    )).status, 410);
  });

  it("writes a fictitious personalized PDF without example-only labeling", async () => {
    const bytes = await renderPublicEstimatePdf({
      input: { ...DEFAULT_PROJECT_INPUTS, includeFlooring: false },
      total: 12000,
      name: "Alex Sample",
      issued: new Date("2026-11-06T18:00:00Z"),
    });
    const dir = mkdtempSync(join(tmpdir(), "flpfxr-estimate-pdf-"));
    try {
      writeFileSync(join(dir, "fictitious-personalized-estimate.pdf"), bytes);
      const { PDFDocument } = await import("pdf-lib");
      const doc = await PDFDocument.load(bytes);
      assert.equal(doc.getPageCount(), 1);
      assert.match(doc.getTitle() ?? "", /Alex Sample/);
      assert.doesNotMatch(doc.getTitle() ?? "", /example only/i);
      try {
        writeFileSync(
          join("docs", "reviews", "estimator-flooring-pdf-2026-11", "fictitious-personalized-estimate.pdf"),
          bytes,
        );
      } catch {
        // optional local evidence path
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
