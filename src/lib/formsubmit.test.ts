import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  formSubmitAjaxInit,
  parseFormSubmitResponse,
} from "./formsubmit.ts";

describe("parseFormSubmitResponse", () => {
  it("treats success JSON as a delivered lead", () => {
    const result = parseFormSubmitResponse(200, {
      success: true,
      message: "Your form has been submitted",
    });
    assert.equal(result.ok, true);
    assert.equal(result.needsConfirm, false);
  });

  it("does not treat an empty 2xx body as an accepted lead", () => {
    const result = parseFormSubmitResponse(200, null);
    assert.equal(result.ok, false);
    assert.equal(result.needsConfirm, false);
  });

  it("does not treat a 2xx message without success as acceptance", () => {
    const result = parseFormSubmitResponse(200, {
      message: "Queued",
    });
    assert.equal(result.ok, false);
  });

  it("flags the first-send confirmation email so ads leads are not silently dropped", () => {
    const result = parseFormSubmitResponse(200, {
      success: false,
      message: "Make sure you confirm the form through your email.",
    });
    assert.equal(result.ok, false);
    assert.equal(result.needsConfirm, true);
    assert.match(result.message, /FormSubmit confirmation/i);
  });

  it("surfaces other FormSubmit errors without pretending the lead arrived", () => {
    const result = parseFormSubmitResponse(400, {
      success: false,
      message: "Invalid email",
    });
    assert.equal(result.ok, false);
    assert.equal(result.needsConfirm, false);
    assert.match(result.message, /Invalid email/i);
  });
});

describe("formSubmitAjaxInit", () => {
  it("omits custom headers so the browser does not CORS-preflight FormSubmit", () => {
    const init = formSubmitAjaxInit(new FormData());
    assert.equal(init.method, "POST");
    assert.equal(init.headers, undefined);
    assert.equal("Accept" in (init.headers ?? {}), false);
  });
});
