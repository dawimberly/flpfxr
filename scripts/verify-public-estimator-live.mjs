/** Production HTTP smoke: run after the main-branch Vercel deployment. */
import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";

const base = "https://theflipfixer.com";
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
    last = "status " + page.status + ", heading " + page.text.includes("Plan your next project.");
    if (page.status === 200 &&
        page.text.includes("Plan your next project.") &&
        page.text.includes("Benchmark pending verification") &&
        page.text.includes("Request an on-site estimate")) {
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
]) {
  const page = await read(path);
  assert.equal(page.status, 200, path + " returned " + page.status);
  assert.ok(page.text.toLowerCase().includes(marker.toLowerCase()), path + " content missing");
}
console.log("PASS live public estimator, homepage CTA and existing kitchen/bath landing pages:", base + "/estimate");
