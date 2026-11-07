/** Local-only UI regression: availability is mocked; all mutation APIs/external traffic are blocked. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";

const base = process.env.PDF_ACTION_BASE ?? "http://127.0.0.1:8098";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(base).hostname));
const artifacts = process.env.PDF_ACTION_ARTIFACTS ?? (process.env.GITHUB_ACTIONS ? process.cwd() : join(tmpdir(), "flipfixer-pdf-action"));
await mkdir(artifacts, { recursive: true });
const server = process.env.PDF_ACTION_BASE ? null : spawn(process.execPath, ["node_modules/vite/bin/vite.js", "dev", "--host", "127.0.0.1", "--port", "8098", "--strictPort"], { windowsHide: true, stdio: "pipe" });
let logs = "";
if (server) for (const stream of [server.stdout, server.stderr]) stream.on("data", chunk => { logs = (logs + chunk).slice(-6000); });
server?.on("error", error => { logs += String(error); });
let browser;
try {
  let ready = false;
  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    if (server && server.exitCode !== null) break;
    try { if ((await fetch(base + "/estimate", { signal: AbortSignal.timeout(2000) })).ok) { ready = true; break; } } catch { /* startup */ }
    await delay(500);
  }
  assert.ok(ready, "Preview not ready: " + logs);
  browser = await chromium.launch({ headless: true });
  for (const width of [390, 1280]) {
    for (const scenario of ["available", "unavailable", "http-error", "network-error", "invalid-json", "timeout"]) {
      const page = await browser.newPage({ viewport: { width, height: width === 390 ? 844 : 1100 } });
      const errors = [];
      const mutations = [];
      page.on("pageerror", error => errors.push(error.message));
      let availabilityCalls = 0;
      let release;
      const gate = new Promise(resolve => { release = resolve; });
      await page.route("**/*", async route => {
        const request = route.request();
        if (!request.url().startsWith(base + "/")) return route.abort();
        if (request.url().includes("/api/") && request.method() !== "GET") {
          mutations.push(request.url());
          return route.fulfill({ status: 500, json: { ok: false } });
        }
        if (new URL(request.url()).pathname !== "/api/estimate-email") return route.continue();
        availabilityCalls++;
        if (availabilityCalls > 1) return route.fulfill({ json: { ok: true, available: true } });
        await gate;
        if (scenario === "timeout") return;
        if (scenario === "network-error") return route.abort();
        if (scenario === "http-error") return route.fulfill({ status: 500, json: { ok: false, available: true } });
        if (scenario === "invalid-json") return route.fulfill({ contentType: "application/json", body: "{" });
        return route.fulfill({ json: { ok: true, available: scenario === "available", message: "Downloads temporarily unavailable. Please retry." } });
      });
      await page.goto(base + "/estimate", { waitUntil: "domcontentloaded" });
      const button = page.getByRole("button", { name: "Download estimate PDF", exact: true });
      await button.waitFor();
      assert.ok(await button.isDisabled(), "Initial button visible but disabled");
      assert.equal(await button.getAttribute("aria-busy"), "true");
      assert.equal(await page.getByTestId("email-my-estimate-form").count(), 0);
      if (scenario === "available") {
        await page.screenshot({ path: join(artifacts, `pdf-action-loading-${width}.png`) });
      }
      release();
      if (scenario !== "available") {
        await page.getByTestId("email-my-estimate-unavailable").waitFor({ timeout: 15_000 });
        assert.ok(await button.isVisible());
        assert.ok(await button.isDisabled());
        assert.equal(await button.getAttribute("aria-busy"), "false");
        if (scenario !== "unavailable") await page.getByText("PDF availability check failed", { exact: true }).waitFor();
        await page.getByTestId("estimate-pdf-retry").click();
      }
      await button.waitFor({ state: "visible" });
      await page.waitForFunction(() => !document.querySelector('[data-testid="email-my-estimate-open"]')?.disabled);
      assert.equal(await button.getAttribute("type"), "button");
      assert.equal(await page.getByTestId("email-my-estimate-open").count(), 1);
      await page.getByTestId("estimate-total").waitFor();
      const rect = await button.boundingBox();
      const disclaimer = await page.getByTestId("estimate-disclaimer").boundingBox();
      const onsite = await page.getByRole("link", { name: "Request an on-site estimate", exact: true }).boundingBox();
      const size = await page.getByRole("group", { name: "Starting point", exact: true }).boundingBox();
      const materials = await page.locator("#estimate-counter").boundingBox();
      assert.ok(rect.y >= disclaimer.y + disclaimer.height);
      assert.ok(rect.y + rect.height <= onsite.y && onsite.y < size.y && size.y < materials.y, "PDF before onsite, size and material fields");
      assert.ok(rect.height >= 48);
      assert.ok(rect.x >= 0 && rect.x + rect.width <= width);
      if (width === 390) {
        const container = await page.getByTestId("estimate-pdf-action").boundingBox();
        assert.ok(Math.abs(rect.width - container.width) < 1, "Full-width mobile action");
        const bar = await page.locator(".fixed.inset-x-0.bottom-0").boundingBox();
        assert.ok(rect.y + rect.height < bar.y, "Sticky call/text bar does not cover PDF action");
        assert.ok(await button.evaluate(element => {
          const r = element.getBoundingClientRect();
          return element.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
        }));
      }
      if (scenario === "available") await page.screenshot({ path: join(artifacts, `pdf-action-available-${width}.png`) });
      await button.click();
      const form = page.getByTestId("email-my-estimate-form");
      await form.waitFor();
      await form.getByText(/Download your preliminary estimate and send your project details/).waitFor();
      assert.equal(await form.getByRole("link", { name: "How we use your information" }).getAttribute("href"), "/privacy");
      assert.equal(await form.getByTestId("email-my-estimate-submit").textContent(), "Download estimate & request follow-up");
      assert.deepEqual(mutations, [], "Initial click/retries never submit a lead or send email");
      if (scenario === "available") {
        await page.getByRole("button", { name: "Large", exact: true }).click();
        await page.waitForFunction(() => !document.querySelector('[data-testid="email-my-estimate-open"]')?.disabled);
        assert.equal(await page.getByTestId("email-my-estimate-form").count(), 0, "A changed estimate starts a fresh download request");
        assert.deepEqual(mutations, []);
      }
      assert.deepEqual(errors, []);
      await page.close();
      console.log(`PASS ${width}px ${scenario}: loading, placement, recovery and zero mutations`);
    }
  }
} finally {
  await browser?.close();
  server?.kill();
}
