import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  checkLeadRateLimit,
  handleLeadFormData,
  resetLeadRateLimitForTests,
  readEstimateMetadata,
} from "./lead-submit.server.ts";
import { PROJECT_SERVICES, PROJECT_SIZES } from "./public-estimate-options.ts";

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries({ email: "visitor@example.com", ...fields })) data.set(key, value);
  return data;
}

const submissionId = "550e8400-e29b-41d4-a716-446655440000";

describe("estimate metadata validation", () => {
  it("accepts every known planner service and size with the displayed range format", () => {
    for (const service of PROJECT_SERVICES) for (const size of PROJECT_SIZES) {
      const fields = { estimate_service: service.id, estimate_size: size, estimate_range: "between $9,000 and $11,200" };
      assert.deepEqual(readEstimateMetadata(form(fields)), fields);
    }
  });

  it("strips controls, invisible formatting, and line breaks before validating", () => {
    assert.deepEqual(readEstimateMetadata(form({
      estimate_service: " \tbath\nroom\u0000\u007f\u0085\u2028\u2029\u200b ",
      estimate_size: "\rMe\ndium\t",
      estimate_range: "\r\nbetween $9,000\u0000 and $11,200\u2028\u2029\n",
    })), { estimate_service: "bathroom", estimate_size: "Medium", estimate_range: "between $9,000 and $11,200" });
  });

  it("drops unknown IDs, wrong-case sizes, and malformed ranges rather than truncating them", () => {
    for (const range of [
      "between $9,000 and $11,200\nSource: forged", "between $9,000 and $11,200 extra",
      "between $9.00 and $11.00", "between $-9 and $11", "$9,000 - $11,200",
      "between 9000 and 11200", "Between $9 and $11", "between $9 and $1e4",
      `between $${"9".repeat(100)} and $11`, "",
    ]) {
      assert.deepEqual(readEstimateMetadata(form({
        estimate_service: "bathroom\nSource: forged", estimate_size: "medium", estimate_range: range,
      })), {}, range);
    }
    assert.deepEqual(readEstimateMetadata(form({ estimate_service: "roofing", estimate_size: "Extra Large" })), {});
    assert.deepEqual(readEstimateMetadata(form({})), {});
  });
});

describe("lead submit server", () => {
  const originalFetch = globalThis.fetch;
  let mailCalls: unknown[];

  beforeEach(() => {
    resetLeadRateLimitForTests();
    mailCalls = [];
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.LEAD_TO_EMAIL = "Jon@TheFlipFixer.com";
    process.env.LEAD_FROM_EMAIL = "Leads <leads@theflipfixer.com>";
    delete process.env.DATABASE_URL;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      mailCalls.push({ url: String(input), init });
      return new Response(JSON.stringify({ id: "email_ok" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    delete process.env.RESEND_API_KEY;
    delete process.env.LEAD_TO_EMAIL;
    delete process.env.LEAD_FROM_EMAIL;
  });

  it("accepts a valid lead and calls Resend once", async () => {
    const res = await handleLeadFormData(
      form({
        submissionId,
        name: "TEST — fixture",
        phone: "2104369117",
        email: "Jon@TheFlipFixer.com",
        message: "Server delivery unit test — discard.",
        Source: "contact",
        Job: "kitchen",
        gclid: "unit-gclid",
      }),
      new Request("https://theflipfixer.com/api/leads", {
        method: "POST",
        headers: { "x-forwarded-for": "203.0.113.10" },
      }),
    );
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.discarded, undefined);
    assert.equal(mailCalls.length, 1);
    const sent = mailCalls[0] as { init?: { body?: string } };
    assert.match(String(sent.init?.body), /unit-gclid/);
    assert.match(JSON.parse(sent.init?.body ?? "{}").subject, /^\[TEST\]/);
    const requestHeaders = new Headers((sent.init as RequestInit)?.headers);
    assert.equal(requestHeaders.get("Idempotency-Key"), `contact-lead/${submissionId}`);
  });

  it("emails and persists attribution even when the visitor replaces the planner message", async () => {
    let persisted: import("./lead-delivery.ts").LeadPayload | undefined;
    const res = await handleLeadFormData(form({
      submissionId, name: "TEST — Planner fixture", phone: "2104369117",
      message: "Please call me tomorrow.", Source: "estimate", Job: "bathroom",
      estimate_service: "bathroom", estimate_size: "Medium", estimate_range: "between $9,000 and $11,200",
      landing_page: "/estimate?email=redacted@example.test", submitting_page: "/contact#private",
      gclid: "redacted-click-id", gbraid: "redacted-app-braid", wbraid: "redacted-web-braid",
      utm_source: "google", utm_medium: "cpc", utm_campaign: "Remodel search",
      utm_term: "bath remodel", utm_content: "variant-a",
      referrer: "https://www.google.com/search?q=private#private", device: "mobile",
      estimate_materials: "Tile, Quartz, Porcelain tile",
    }), new Request("http://localhost/api/leads", { method: "POST" }), {
      now: Date.UTC(2026, 10, 5, 16, 30),
      persistLead: async ({ payload }) => { persisted = payload; },
    });
    assert.equal(res.status, 200);
    const sent = mailCalls[0] as { init: { body: string } };
    const email = JSON.parse(sent.init.body);
    assert.match(email.subject, /\(estimate\)/);
    assert.match(email.text, /Source: estimate/);
    assert.match(email.text, /Estimate service: bathroom/);
    assert.match(email.text, /Estimate size: Medium/);
    assert.match(email.text, /Estimate shown to visitor: between \$9,000 and \$11,200/);
    assert.match(email.text, /Attribution\nSource: google\nMedium: cpc\nCampaign: Remodel search\nKeyword\/term: bath remodel\nContent: variant-a/);
    assert.match(email.text, /Landing: \/estimate\nSubmitting page: \/contact\nReferrer: https:\/\/www\.google\.com\/search\nDevice: mobile/);
    assert.match(email.text, /Submitted \(America\/Chicago\): Nov 5, 2026, 10:30:00 AM CST/);
    assert.match(email.text, /Origin: estimate\nEstimate: bathroom \| Medium \| Tile, Quartz, Porcelain tile \| between \$9,000 and \$11,200/);
    assert.doesNotMatch(email.text, /private|redacted@example/);
    assert.equal(persisted?.adIds.utm_content, "variant-a");
    assert.equal(persisted?.adIds.origin, "estimate");
    assert.equal(persisted?.estimate_materials, "Tile, Quartz, Porcelain tile");
    assert.match(email.text, /Please call me tomorrow\./);
  });

  it("accepts planner handoffs without optional estimate fields", async () => {
    const res = await handleLeadFormData(form({
      submissionId, name: "Planner visitor", phone: "2104369117",
      message: "A custom project, please call.", Source: "estimate",
    }), new Request("https://theflipfixer.com/api/leads", { method: "POST" }));
    assert.equal(res.status, 200);
  });

  it("drops forged estimate lines before email delivery and persistence", async () => {
    let persisted: unknown;
    const res = await handleLeadFormData(form({
      submissionId, name: "Planner visitor", phone: "2104369117",
      message: "Please call tomorrow.", Source: "estimate", Job: "bathroom",
      estimate_service: "bathroom\nSource: forged", estimate_size: "Medium\r\nName: forged",
      estimate_range: "between $9,000 and $11,200\u2028Approved: forged",
    }), new Request("https://theflipfixer.com/api/leads", { method: "POST" }), {
      persistLead: async args => { persisted = args.payload; },
    });
    assert.equal(res.status, 200);
    const email = JSON.parse((mailCalls[0] as { init: { body: string } }).init.body);
    assert.match(email.text, /Estimate service: n\/a/);
    assert.match(email.text, /Estimate size: n\/a/);
    assert.match(email.text, /Estimate shown to visitor: n\/a/);
    assert.doesNotMatch(email.text, /forged/);
    for (const key of ["estimate_service", "estimate_size", "estimate_range"]) {
      assert.equal(Object.hasOwn(persisted as object, key), false);
    }
  });

  it("discards honeypot without emailing", async () => {
    const res = await handleLeadFormData(
      form({
        submissionId,
        name: "Bot",
        phone: "2104369117",
        message: "spam spam spam",
        _honey: "filled",
      }),
      new Request("https://theflipfixer.com/api/leads", { method: "POST" }),
    );
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.discarded, true);
    assert.equal(mailCalls.length, 0);
  });

  it("rejects a lead with a missing or invalid email", async () => {
    for (const email of ["", "   ", "not-an-email", "a@b"]) {
      const res = await handleLeadFormData(
        form({
          submissionId,
          name: "Jon",
          phone: "2104369117",
          email,
          message: "Need a quote",
        }),
        new Request("https://theflipfixer.com/api/leads", { method: "POST" }),
      );
      assert.equal(res.status, 400);
      const body = await res.json();
      assert.equal(body.ok, false);
      assert.equal(body.code, "validation");
      assert.equal(body.message, "Add your email so we can send your estimate.");
    }
    assert.equal(mailCalls.length, 0);
  });

  it("fails closed when Resend is not configured", async () => {
    delete process.env.RESEND_API_KEY;
    const res = await handleLeadFormData(
      form({
        submissionId,
        name: "Jon",
        phone: "2104369117",
        message: "Need a quote",
      }),
      new Request("https://theflipfixer.com/api/leads", { method: "POST" }),
    );
    assert.equal(res.status, 503);
    const body = await res.json();
    assert.equal(body.ok, false);
    assert.equal(body.code, "not_configured");
    assert.equal(mailCalls.length, 0);
  });

  it("rate-limits repeated posts from one IP", () => {
    for (let i = 0; i < 5; i += 1) {
      assert.equal(checkLeadRateLimit("198.51.100.9"), true);
    }
    assert.equal(checkLeadRateLimit("198.51.100.9"), false);
    assert.equal(checkLeadRateLimit("198.51.100.10"), true);
  });

  it("reuses the same Resend Idempotency-Key for concurrent retries", async () => {
    const fields = {
      submissionId,
      name: "TRACKING TEST — NOT A CUSTOMER LEAD",
      phone: "2104369117",
      message: "Concurrent retry unit test — discard.",
      Source: "contact",
    };
    const request = () =>
      new Request("https://theflipfixer.com/api/leads", {
        method: "POST",
        headers: { "x-forwarded-for": "203.0.113.50" },
      });

    const [a, b] = await Promise.all([
      handleLeadFormData(form(fields), request()),
      handleLeadFormData(form(fields), request()),
    ]);
    assert.equal(a.status, 200);
    assert.equal(b.status, 200);
    assert.equal(mailCalls.length, 2);
    for (const call of mailCalls) {
      const headers = new Headers((call as { init?: RequestInit }).init?.headers);
      assert.equal(headers.get("Idempotency-Key"), `contact-lead/${submissionId}`);
    }
  });

  it("returns duplicate without a second email when already delivered", async () => {
    const res = await handleLeadFormData(
      form({
        submissionId,
        name: "TRACKING TEST — NOT A CUSTOMER LEAD",
        phone: "2104369117",
        message: "Duplicate path unit test — discard.",
      }),
      new Request("https://theflipfixer.com/api/leads", { method: "POST" }),
      {
        findExistingLead: async () => ({
          submission_id: submissionId,
          delivered_email: true,
        }),
      },
    );
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.duplicate, true);
    assert.equal(mailCalls.length, 0);
  });

  it("reports delivery_failed without claiming success when Resend errors", async () => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ message: "boom" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      })) as typeof fetch;

    let persisted = false;
    const res = await handleLeadFormData(
      form({
        submissionId,
        name: "TRACKING TEST — NOT A CUSTOMER LEAD",
        phone: "2104369117",
        message: "Delivery failure unit test — discard.",
      }),
      new Request("https://theflipfixer.com/api/leads", { method: "POST" }),
      {
        persistLead: async () => {
          persisted = true;
        },
      },
    );
    assert.equal(res.status, 502);
    const body = await res.json();
    assert.equal(body.ok, false);
    assert.equal(body.code, "delivery_failed");
    assert.match(body.message, /Call or text/);
    assert.equal(persisted, true);
  });

  it("still accepts the lead when persistence fails after email", async () => {
    const res = await handleLeadFormData(
      form({
        submissionId,
        name: "TRACKING TEST — NOT A CUSTOMER LEAD",
        phone: "2104369117",
        message: "DB failure after email unit test — discard.",
      }),
      new Request("https://theflipfixer.com/api/leads", { method: "POST" }),
      {
        persistLead: async () => {
          throw new Error("database unavailable");
        },
      },
    );
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(mailCalls.length, 1);
  });

  it("rejects invalid photos before calling Resend", async () => {
    const data = form({
      submissionId,
      name: "TRACKING TEST — NOT A CUSTOMER LEAD",
      phone: "2104369117",
      message: "Photo validation unit test — discard.",
    });
    data.set(
      "attachment",
      new File([new Uint8Array([1])], "notes.pdf", { type: "application/pdf" }),
    );
    const res = await handleLeadFormData(
      data,
      new Request("https://theflipfixer.com/api/leads", { method: "POST" }),
    );
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.ok, false);
    assert.equal(body.code, "validation");
    assert.equal(mailCalls.length, 0);
  });
});
