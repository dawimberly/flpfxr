import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  DOWNLOAD_TTL_MS,
  estimateCustomerMailConfig,
  handleEstimateEmailRequest,
  handleEstimatePdfDownload,
  resetEstimateEmailGuardsForTests,
  validateEstimateEmailContact,
} from "./estimate-email.server.ts";
import { DEFAULT_PROJECT_INPUTS } from "./public-estimate-options.ts";
import { publicEstimateResult } from "./public-estimate-result.server.ts";
import { renderPublicEstimatePdf } from "./public-estimate-pdf.server.ts";
import { writeFileSync } from "node:fs";
import { resetLeadRateLimitForTests } from "./lead-submit.server.ts";

function formFrom(fields: Record<string, string>) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  return form;
}

describe("estimate email delivery", () => {
  beforeEach(() => {
    resetEstimateEmailGuardsForTests();
    resetLeadRateLimitForTests();
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.ESTIMATE_FROM_EMAIL = "The Flip Fixer <leads@theflipfixer.com>";
    process.env.LEAD_TO_EMAIL = "Jon@TheFlipFixer.com";
  });

  it("requires name and email but not phone", () => {
    assert.equal(validateEstimateEmailContact({ name: "A", email: "a@example.com" }).ok, false);
    assert.equal(validateEstimateEmailContact({ name: "Alex Sample", email: "not-an-email" }).ok, false);
    assert.equal(validateEstimateEmailContact({ name: "Alex Sample", email: "alex@example.com" }).ok, true);
  });

  it("disables customer delivery for the Resend onboarding sender", () => {
    const cfg = estimateCustomerMailConfig({
      RESEND_API_KEY: "re_test",
      ESTIMATE_FROM_EMAIL: "The Flip Fixer <onboarding@resend.dev>",
    });
    assert.equal(cfg.configured, false);
    assert.ok(cfg.setupNeeded?.some(line => /verified business sender/i.test(line)));
  });

  it("recalculates totals server-side and ignores a forged displayed total", async () => {
    const selections = { ...DEFAULT_PROJECT_INPUTS, includeFlooring: false };
    const expected = publicEstimateResult(selections)!.total;
    const sent: Array<{ to: string; subject: string; text: string; attachments?: unknown[] }> = [];
    const stores: unknown[] = [];
    const sql = {
      async query<T>(_text: string, params?: unknown[]): Promise<T[]> {
        if (/insert into contact_leads/i.test(_text)) stores.push(params);
        return [] as T[];
      },
    };
    const request = new Request("https://theflipfixer.com/api/estimate-email", {
      method: "POST",
      body: formFrom({
        submissionId: randomUUID(),
        name: "Alex Sample",
        email: "alex.sample@example.com",
        selections: JSON.stringify(selections),
        displayedTotal: "999999",
      }),
    });
    const response = await handleEstimateEmailRequest(request, {
      sql,
      sendMail: async (input) => {
        sent.push(input);
        return { ok: true, id: "mock_" + sent.length };
      },
    });
    const body = await response.json() as { ok: boolean; state: string; total: number; downloadToken: string };
    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.state, "accepted");
    assert.equal(body.total, expected);
    assert.notEqual(body.total, 999999);
    assert.equal(sent[0].to, "alex.sample@example.com");
    assert.match(sent[0].subject, /\$12,000/);
    assert.ok(sent[0].attachments?.length);
    assert.ok(body.downloadToken);
    assert.equal(stores.length >= 1, true);
    const totalCents = (stores[0] as unknown[])[10];
    assert.equal(totalCents, expected * 100);
  });

  it("preserves the lead when email delivery fails and does not claim acceptance", async () => {
    const selections = { ...DEFAULT_PROJECT_INPUTS, includeFlooring: true };
    const stores: unknown[] = [];
    const sql = {
      async query<T>(text: string, params?: unknown[]): Promise<T[]> {
        if (/insert into contact_leads/i.test(text)) stores.push(params);
        return [] as T[];
      },
    };
    const response = await handleEstimateEmailRequest(new Request("https://theflipfixer.com/api/estimate-email", {
      method: "POST",
      body: formFrom({
        submissionId: randomUUID(),
        name: "Alex Sample",
        email: "alex.sample@example.com",
        selections: JSON.stringify(selections),
      }),
    }), {
      sql,
      sendMail: async () => ({ ok: false, status: 500, message: "provider down" }),
    });
    const body = await response.json() as { ok: boolean; state: string };
    assert.equal(response.status, 502);
    assert.equal(body.ok, false);
    assert.equal(body.state, "delivery_failed");
    assert.equal(stores.length, 1);
    assert.equal((stores[0] as unknown[])[7], false); // delivered_email
  });

  it("rejects forged selection payloads that fail validation", async () => {
    const response = await handleEstimateEmailRequest(new Request("https://theflipfixer.com/api/estimate-email", {
      method: "POST",
      body: formFrom({
        submissionId: randomUUID(),
        name: "Alex Sample",
        email: "alex.sample@example.com",
        selections: JSON.stringify({ service: "kitchen", total: 12 }),
      }),
    }), {
      sql: null,
      sendMail: async () => ({ ok: true, id: "x" }),
    });
    assert.equal(response.status, 400);
    const body = await response.json() as { state: string };
    assert.equal(body.state, "validation");
  });

  it("blocks unauthorized downloads and expired tokens", async () => {
    const missing = await handleEstimatePdfDownload(
      new Request("https://theflipfixer.com/api/estimate-pdf/not-a-real-token"),
      "not-a-real-token",
      { sql: { async query<T>() { return [] as T[]; } } },
    );
    assert.equal(missing.status, 404);
    const expired = await handleEstimatePdfDownload(
      new Request("https://theflipfixer.com/api/estimate-pdf/abcdefghijklmnopqrstuv"),
      "abcdefghijklmnopqrstuv",
      {
        now: Date.now(),
        sql: {
          async query<T>() {
            return [{
              submission_id: randomUUID(),
              expires_at: new Date(Date.now() - 1000).toISOString(),
              planner_inputs: { v: 1, project: DEFAULT_PROJECT_INPUTS },
              name: "Alex Sample",
              estimate_total_cents: 1200000,
            }] as T[];
          },
        },
      },
    );
    assert.equal(expired.status, 410);
  });

  it("writes a fictitious personalized PDF without example-only labeling", async () => {
    const bytes = await renderPublicEstimatePdf({
      input: { ...DEFAULT_PROJECT_INPUTS, includeFlooring: false },
      total: 12000,
      name: "Alex Sample",
      issued: new Date("2026-11-06T18:00:00Z"),
    });
    writeFileSync("audit/fictitious-personalized-estimate.pdf", bytes);
    const { PDFDocument } = await import("pdf-lib");
    const doc = await PDFDocument.load(bytes);
    assert.equal(doc.getPageCount(), 1);
    const title = doc.getTitle() ?? "";
    assert.match(title, /Alex Sample/);
    assert.doesNotMatch(title, /example only/i);
  });

  it("documents download TTL", () => {
    assert.equal(DOWNLOAD_TTL_MS, 7 * 24 * 60 * 60 * 1000);
  });
});
