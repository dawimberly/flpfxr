import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { e164Phone, smsHref, telHref } from "./utils.ts";

describe("phone hrefs", () => {
  it("builds tel and sms links for the shop number", () => {
    assert.equal(e164Phone("2104369117"), "+12104369117");
    assert.equal(telHref("2104369117"), "tel:+12104369117");
    assert.equal(smsHref("2104369117"), "sms:+12104369117");
  });

  it("keeps an already-prefixed 11-digit number", () => {
    assert.equal(telHref("12104369117"), "tel:+12104369117");
    assert.equal(smsHref("(210) 436-9117"), "sms:+12104369117");
  });
});
