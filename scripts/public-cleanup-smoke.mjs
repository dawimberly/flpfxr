/** Local public-page regression smoke. Never submits a form or contacts external services. */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";
import { AREA_PAGES } from "../src/lib/areas.ts";
import { BLOG_POSTS } from "../src/lib/blog.ts";
import { NAV, EXTRA_NAV } from "../src/lib/site.ts";

const base = process.env.PUBLIC_CLEANUP_BASE ?? "http://127.0.0.1:8097";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(base).hostname), "Local preview only");
const artifacts = process.env.PUBLIC_CLEANUP_ARTIFACTS ?? (process.env.GITHUB_ACTIONS ? process.cwd() : join(tmpdir(), "flipfixer-public-cleanup"));
await mkdir(artifacts, { recursive: true });
const paths = ["/", "/kitchen", "/bathroom", "/services", "/gallery", "/contact", "/blog", "/estimate", "/areas", "/about", "/community", "/testimonials", "/privacy", "/roof", ...AREA_PAGES.map(a => `/areas/${a.slug}`), ...BLOG_POSTS.map(p => `/blog/${p.slug}`)];
const screenshotNames = new Map([["/", "home"], ["/kitchen", "kitchen"], ["/estimate", "estimate"], ["/testimonials", "reviews"], ["/blog/first-remodeling-appointment", "appointment"]]);
// An explicit base reuses an already running local server; otherwise own its lifecycle.
const server = process.env.PUBLIC_CLEANUP_BASE ? null : spawn(process.execPath, ["node_modules/vite/bin/vite.js", "dev", "--host", "127.0.0.1", "--port", "8097", "--strictPort"], { windowsHide: true, stdio: "pipe" });
let serverLog = "";
if (server) for (const stream of [server.stdout, server.stderr]) stream.on("data", chunk => { serverLog = (serverLog + chunk).slice(-6000); });
let browser;
let activePage;
const results = [];
try {
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (server && server.exitCode !== null) break;
    try { if ((await fetch(base + "/kitchen", { signal: AbortSignal.timeout(2000) })).ok) { ready = true; break; } } catch { /* startup */ }
    await delay(500);
  }
  assert.ok(ready, "Local preview did not start: " + serverLog);
  browser = await chromium.launch({ headless: true });
  for (const width of [390, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    activePage = page;
    const startupErrors = [];
    page.on("pageerror", error => startupErrors.push(error.message));
    await page.route("**/*", route => {
      const request = route.request();
      if (!request.url().startsWith(base + "/")) return route.abort();
      if (/\/api\/(leads|estimate-email|estimate-inquiry|estimate-checkout|catalog-signup|stripe)/.test(request.url()) && request.method() !== "GET") {
        throw new Error("Smoke must never submit leads, emails, or payments");
      }
      return route.continue();
    });
    let expectedFooter;
    const seenTitles = new Set();
    for (const path of paths) {
      console.log(`${width}: ${path}`);
      const response = await page.goto(base + path, { waitUntil: "networkidle" });
      assert.equal(response.status(), 200, path);
      const title = await page.title();
      assert.ok(!seenTitles.has(title), `Duplicate title: ${path}`);
      seenTitles.add(title);
      const description = await page.locator('meta[name="description"]').getAttribute("content");
      for (const [attribute, key, expected] of [["property", "og:title", title], ["name", "twitter:title", title], ["property", "og:description", description], ["name", "twitter:description", description]]) {
        const tag = page.locator(`meta[${attribute}="${key}"]`);
        assert.equal(await tag.count(), 1, `${path}: duplicate/missing ${key}`);
        assert.equal(await tag.getAttribute("content"), expected, `${path}: stale ${key}`);
      }
      const footer = await page.getByRole("contentinfo").locator("a").evaluateAll(elements => elements.map(e => [e.getAttribute("href"), e.textContent.trim()]));
      expectedFooter ??= footer;
      assert.deepEqual(footer, expectedFooter, `${path}: footer parity`);
      assert.ok(footer.some(([href]) => href === "/login"), "Employee login preserved");
      for (const area of AREA_PAGES) assert.ok(footer.some(([href]) => href === `/areas/${area.slug}`));
      if (width === 390) {
        await page.getByRole("button", { name: "Open menu", exact: true }).click();
        const dialog = page.getByRole("dialog");
        for (const item of [...NAV, ...EXTRA_NAV]) assert.equal(await dialog.getByRole("link", { name: item.label, exact: true }).getAttribute("href"), item.to);
        assert.equal(await dialog.getByRole("link", { name: "Employee login", exact: true }).getAttribute("href"), "/login");
        await page.keyboard.press("Escape");
        await dialog.waitFor({ state: "hidden" });
      } else {
        const header = page.getByRole("banner");
        for (const item of NAV) {
          const link = header.getByRole("link", { name: item.label, exact: true });
          assert.ok(await link.isVisible(), `${path}: ${item.label}`);
          assert.equal(await link.getAttribute("href"), item.to);
          const pathname = new URL(page.url()).pathname;
          const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
          const classes = (await link.getAttribute("class")).split(/\s+/);
          assert.equal(classes.includes("text-primary"), active, `${path}: ${item.label} active state`);
        }
      }
      const geometry = await page.evaluate(() => ({ viewport: innerWidth, scroll: document.documentElement.scrollWidth }));
      assert.ok(geometry.scroll <= geometry.viewport, `${path}: horizontal overflow at ${width}`);
      assert.ok(await page.locator('a[href^="tel:"]').count(), "Call links preserved");
      assert.ok(await page.locator('a[href^="sms:"]').count(), "Text links preserved");
      if (screenshotNames.has(path)) await page.screenshot({ path: join(artifacts, `after-${screenshotNames.get(path)}-${width}.png`), fullPage: true });
      results.push({ path, width, title, description });
    }
    // Client-side navigation must update share text too, without duplicate SSR tags.
    await page.goto(base + "/kitchen", { waitUntil: "networkidle" });
    if (width === 390) await page.getByRole("button", { name: "Open menu", exact: true }).click();
    await page.getByRole(width === 390 ? "dialog" : "banner").getByRole("link", { name: "Resources", exact: true }).click();
    await page.waitForURL(base + "/blog");
    await page.getByRole("heading", { level: 1 }).waitFor();
    const clientTitle = await page.title();
    for (const selector of ['meta[property="og:title"]', 'meta[name="twitter:title"]']) {
      assert.equal(await page.locator(selector).count(), 1);
      assert.equal(await page.locator(selector).getAttribute("content"), clientTitle);
    }
    const clientDescription = await page.locator('meta[name="description"]').getAttribute("content");
    for (const selector of ['meta[property="og:description"]', 'meta[name="twitter:description"]']) {
      assert.equal(await page.locator(selector).count(), 1);
      assert.equal(await page.locator(selector).getAttribute("content"), clientDescription);
    }
    assert.deepEqual(startupErrors, [], "No uncaught public-page errors");
    await page.close();
  }
  await writeFile(join(artifacts, "smoke-results.json"), JSON.stringify(results, null, 2));
  console.log(`PASS: ${results.length} page/viewport checks; desktop/mobile navigation, footer parity, unique metadata, client navigation, call/text links, no overflow or startup errors. ${artifacts}`);
} catch (error) {
  if (activePage && !activePage.isClosed()) {
    await activePage.screenshot({ path: join(artifacts, "failure.png"), fullPage: true });
    await writeFile(join(artifacts, "failure.html"), await activePage.content());
  }
  throw error;
} finally {
  await browser?.close();
  server?.kill();
}
