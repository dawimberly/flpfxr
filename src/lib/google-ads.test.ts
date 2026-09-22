import assert from "node:assert/strict";
import { test } from "node:test";
import {
  GOOGLE_ADS_ID,
  GOOGLE_ADS_LEAD_SEND_TO,
  GOOGLE_ADS_PHONE_SEND_TO,
} from "./google-ads.ts";

test("Ads conversion tags share the Flip Fixer destination", () => {
  assert.match(GOOGLE_ADS_ID, /^AW-\d+$/);
  assert.ok(GOOGLE_ADS_LEAD_SEND_TO.startsWith(`${GOOGLE_ADS_ID}/`));
  assert.ok(GOOGLE_ADS_PHONE_SEND_TO.startsWith(`${GOOGLE_ADS_ID}/`));
  assert.notEqual(GOOGLE_ADS_LEAD_SEND_TO, GOOGLE_ADS_PHONE_SEND_TO);
});
