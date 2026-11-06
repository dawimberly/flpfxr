/** Production HTTP smoke: run after the main-branch Vercel deployment. */
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { PRELIMINARY_ESTIMATE_WORDING } from "../src/lib/public-estimate-display.ts";

/** Rounded combined total already shown for the default medium quartz kitchen. */
export const DEFAULT_PUBLIC_TOTAL = "$12,800";
const PUBLISHED_RANGE = /between \$[\d,]+ and \$[\d,]+/;

/** Gaps in the public /estimate contract. Empty means the page matches.
 * @param {string} text
 */
export function liveEstimateGaps(text) {
  const gaps = [];
  if (!text.includes("Plan your next project.")) gaps.push("heading");
  if (!text.includes(PRELIMINARY_ESTIMATE_WORDING)) gaps.push("disclaimer");
  if (!text.includes(DEFAULT_PUBLIC_TOTAL)) gaps.push("default total " + DEFAULT_PUBLIC_TOTAL);
  if (PUBLISHED_RANGE.test(text)) gaps.push("published range");
  if (!text.includes("Request an on-site estimate")) gaps.push("call to action");
  return gaps;
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  const base = "https://theflipfixer.com";
  /** @param {string} path */
  async function read(path) {
    const response = await fetch(base + path, {
      headers: { "Cache-Control": "no-cache" },
      signal: AbortSignal.timeout(12000),
    });
    return { status: response.status, text: await response.text() };
  }

  let ready = false;
  let last = "";
  for (let attempt = 0; attempt < 45; attempt++) {
    try {
      const page = await read("/estimate?verification=" + Date.now());
      const gaps = liveEstimateGaps(page.text);
      last = "status " + page.status + (gaps.length ? "; missing " + gaps.join(", ") : "; contract ok");
      if (page.status === 200 && gaps.length === 0) {
        ready = true;
        break;
      }
    } catch (error) { last = String(error); }
    await delay(4000);
  }
  assert.ok(ready, "Production /estimate not ready: " + last);
  for (const [path, marker] of [
    ["/", "Get a ballpark estimate"],
    ["/kitchen", "kitchen"],
    ["/bathroom", "bathroom"],
    ["/contact", "Call or send the job."],
  ]) {
    const page = await read(path);
    assert.equal(page.status, 200, path + " returned " + page.status);
    assert.ok(page.text.toLowerCase().includes(marker.toLowerCase()), path + " content missing");
  }
  console.log("PASS live public estimator, homepage CTA and existing kitchen/bath landing pages:", base + "/estimate");
}
