/** Browser smoke for the public estimator and existing lead funnel (no lead submission). */
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";

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

  browser = await chromium.launch({ headless: true });
  for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
    const page = await browser.newPage({ viewport });
    const response = await page.goto(base + "/estimate", { waitUntil: "domcontentloaded" });
    assert.equal(response?.status(), 200, "/estimate HTTP status");
    await page.getByRole("heading", { name: "Plan your next project." }).waitFor();
    await page.getByText("Benchmark pending verification").waitFor();
    await page.getByLabel("Base crew days").fill("4");
    await page.getByLabel("Materials at cost ($)").fill("2000");
    await page.getByLabel("Other costs ($)").fill("0");
    await page.getByText("$5,250", { exact: true }).waitFor();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(overflow <= 3, "Horizontal overflow at " + viewport.width + "px: " + overflow);
    await page.getByRole("link", { name: "Request an on-site estimate" }).click();
    await page.waitForURL(/\/contact/);
    const message = await page.locator("textarea[name=message]").inputValue();
    assert.match(message, /bathroom remodeling \(medium scope\)/);
    assert.match(message, /\$5,250/);
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
