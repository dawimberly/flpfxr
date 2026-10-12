import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildLeadEmailText,
  isValidSubmissionId,
  parseLeadApiResponse,
  shouldTrackAcceptedLead,
  validateLeadFields,
} from "./lead-delivery.ts";

describe("lead delivery validation", () => {
  it("accepts a normal lead and rejects short phone or empty message", () => {
    assert.equal(
      validateLeadFields({
        name: "Jon",
        email: "jon@theflipfixer.com",
        phone: "(210) 436-9117",
        message: "Kitchen remodel in Alamo Heights",
      }).ok,
      true,
    );
    assert.equal(
      validateLeadFields({
        name: "Jon",
        email: "",
        phone: "210",
        message: "Kitchen remodel",
      }).ok,
      false,
    );
    assert.equal(
      validateLeadFields({
        name: "Jon",
        email: "",
        phone: "2104369117",
        message: "hi",
      }).ok,
      false,
    );
  });

  it("validates submission ids", () => {
    assert.equal(isValidSubmissionId("550e8400-e29b-41d4-a716-446655440000"), true);
    assert.equal(isValidSubmissionId("not-a-uuid"), false);
  });

  it("tracks only explicit non-discarded acceptance", () => {
    assert.equal(
      shouldTrackAcceptedLead({ ok: true, submissionId: "x" }),
      true,
    );
    assert.equal(
      shouldTrackAcceptedLead({ ok: true, discarded: true, submissionId: "x" }),
      false,
    );
    assert.equal(
      shouldTrackAcceptedLead({ ok: false, message: "nope" }),
      false,
    );
  });

  it("parses API success and failure bodies", () => {
    assert.deepEqual(parseLeadApiResponse(200, { ok: true, submissionId: "abc" }), {
      ok: true,
      discarded: false,
      duplicate: false,
      submissionId: "abc",
    });
    const fail = parseLeadApiResponse(503, {
      ok: false,
      code: "not_configured",
      message: "Lead email is not configured on the server yet.",
    });
    assert.equal(fail.ok, false);
    if (!fail.ok) {
      assert.equal(fail.code, "not_configured");
    }
  });

  it("includes ad click fields in the email body", () => {
    const text = buildLeadEmailText({
      submissionId: "550e8400-e29b-41d4-a716-446655440000",
      name: "Ada",
      email: "a@example.com",
      phone: "2104369117",
      phoneDigits: "2104369117",
      message: "Bath remodel",
      service: "bathroom",
      source: "contact",
      affiliation: "",
      honey: "",
      adIds: { gclid: "test-gclid", landing_path: "/contact" },
    });
    assert.match(text, /gclid: test-gclid/);
    assert.match(text, /Bath remodel/);
  });
});
