import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizeEstimatePhone } from "./estimate-followup-phone.ts";

describe("normalizeEstimatePhone", () => {
  it("accepts common US formatting into a canonical display", () => {
    for (const raw of [
      "2104369117",
      "(210) 436-9117",
      "210-436-9117",
      "210.436.9117",
      "1-210-436-9117",
      "+1 (210) 436-9117",
    ]) {
      const result = normalizeEstimatePhone(raw);
      assert.equal(result.ok, true);
      if (result.ok) {
        assert.equal(result.digits, "2104369117");
        assert.equal(result.display, "(210) 436-9117");
      }
    }
  });

  it("rejects invalid lengths, letters, URLs, newlines, and oversized input", () => {
    assert.equal(normalizeEstimatePhone("210436911").ok, false);
    assert.equal(normalizeEstimatePhone("21043691170").ok, false);
    assert.equal(normalizeEstimatePhone("210-HELLO-17").ok, false);
    assert.equal(normalizeEstimatePhone("https://evil.example/2104369117").ok, false);
    assert.equal(normalizeEstimatePhone("2104369117\nBcc: x@y.com").ok, false);
    assert.equal(normalizeEstimatePhone(`210${"4".repeat(40)}`).ok, false);
    assert.equal(normalizeEstimatePhone("").ok, false);
  });
});
