/** Browser smoke for the public estimator and existing lead funnel (no lead submission). */
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";
import { compareAuthInvariant, probeDevAuthEnabled, buildAuthEnabled } from "./check-auth-invariant.mjs";

const base = "http://127.0.0.1:8080";
const server = spawn("npm", ["run", "dev"], {
  detached: true, stdio: ["ignore", "pipe", "pipe"],
  env: { ...process.env, CI: "1" },
});
let logs = "";
for (const stream of [server.stdout, server.stderr]) {
  stream.on("data", (chunk) => { logs = (logs + String(chunk)).slice(-12000); });
}
const stopServer = () => {
  if (!server.pid) return;
  try { process.kill(-server.pid, "SIGTERM"); } catch { /* already exited */ }
};
let browser;
try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null) break;
    try {
      const response = await fetch(base + "/estimate");
      if (response.ok) { ready = true; break; }
    } catch { /* server starting */ }
    await delay(1000);
  }
  assert.ok(ready, "Vite /estimate never became ready. Recent server logs:\n" + logs);

  const authCheck = compareAuthInvariant({
    devAuthEnabled: await probeDevAuthEnabled(base),
    buildAuthEnabled: buildAuthEnabled(),
  });
  assert.equal(authCheck.status, "ok", authCheck.message);
  console.log(authCheck.message);

  browser = await chromium.launch({ headless: true });
  for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
    const page = await browser.newPage({ viewport });
    const browserErrors = [];
    page.on("pageerror", (error) => browserErrors.push(error.message));
    page.on("console", (msg) => { if (msg.type() === "error") browserErrors.push(msg.text()); });
    const response = await page.goto(base + "/estimate", { waitUntil: "domcontentloaded" });
    assert.equal(response?.status(), 200, "/estimate HTTP status");
    await page.getByRole("heading", { name: "Plan your next project." }).waitFor();
    await page.getByText("The Flip Fixer planning range", { exact: true }).waitFor();
    // SSR HTML can arrive before React attaches event handlers. Confirm interactivity first.
    let hydrated = false;
    for (let attempt = 0; attempt < 30; attempt++) {
      await page.getByRole("button", { name: "Small", exact: true }).click();
      if (await page.getByRole("button", { name: "Small", exact: true }).getAttribute("aria-pressed") === "true") {
        hydrated = true;
        break;
      }
      await page.waitForTimeout(350);
    }
    assert.ok(hydrated, "Estimator did not hydrate: " + browserErrors.join(" | "));
    for (const [service, range] of [["Kitchen remodeling", "$12,000–$25,000"], ["Bathroom remodeling", "$8,000–$16,000"]]) {
      await page.getByRole("button", { name: service, exact: true }).click();
      await page.getByRole("button", { name: "Medium", exact: true }).click();
      await page.getByText(range, { exact: true }).waitFor();
    }
    assert.equal(await page.locator("input[type=number]").count(), 0);
    const estimatorText = await page.locator("body").innerText();
    assert.doesNotMatch(estimatorText, /650|crew days|Benchmark pending/);
    await page.screenshot({ path: "public-estimator-smoke-" + viewport.width + ".png", fullPage: true });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(overflow <= 3, "Horizontal overflow at " + viewport.width + "px: " + overflow);
    await page.getByRole("link", { name: "Request an on-site estimate" }).click();
    await page.waitForURL(/\/contact/);
    // Contact form hydrates asynchronously after client navigation.
    await page.waitForFunction(() => document.querySelector('textarea[name="message"]')?.value.includes("bathroom remodeling"), null, { timeout: 15000 });
    const message = await page.locator("textarea[name=message]").inputValue();
    assert.match(message, /bathroom remodeling \(medium scope\)/);
    assert.match(message, /\$8,000–\$16,000/);
    assert.match(message, /not a quote/);
    for (const path of ["/kitchen", "/bathroom"]) {
      const res = await page.request.get(base + path);
      assert.equal(res.status(), 200, path + " landing page status");
    }
    await page.close();
    console.log("PASS public estimator mobile/desktop, pricing, retail guard and lead handoff:", viewport.width);
  }
} finally {
  if (browser) await browser.close();
  stopServer();
}
