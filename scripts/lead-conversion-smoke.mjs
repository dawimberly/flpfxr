/**
 * Local smoke: mock /api/leads, submit the contact form, assert exactly one
 * Ads lead conversion is queued with the primary send_to label.
 *
 * Does not hit production FormSubmit, Resend, or Google Ads.
 */
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const PORT = 8087;
const BASE = `http://127.0.0.1:${PORT}`;
const LEAD_SEND_TO = "AW-18251288464/XOc8CJqR8-8cEJCf8v5D";
const ROOT = fileURLToPath(new URL("..", import.meta.url));

function startVite() {
  const viteJs = join(ROOT, "node_modules", "vite", "bin", "vite.js");
  return spawn(
    process.execPath,
    [
      "scripts/with-app-env.mjs",
      process.execPath,
      viteJs,
      "dev",
      "--host",
      "127.0.0.1",
      "--port",
      String(PORT),
    ],
    {
      cwd: ROOT,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        VITE_AUTH_ENABLED: "false",
        RESEND_API_KEY: "re_smoke_test",
        LEAD_TO_EMAIL: "Jon@TheFlipFixer.com",
      },
    },
  );
}

async function waitForServer(url, child, attempts = 80) {
  let logs = "";
  child.stdout.on("data", (chunk) => {
    logs += String(chunk);
  });
  child.stderr.on("data", (chunk) => {
    logs += String(chunk);
  });
  for (let i = 0; i < attempts; i += 1) {
    if (child.exitCode != null) {
      throw new Error(`vite exited early with ${child.exitCode}\n${logs}`);
    }
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 404) return logs;
    } catch {
      // retry
    }
    await sleep(500);
  }
  throw new Error(`vite did not become ready\n${logs}`);
}

function conversionCalls(calls) {
  return calls.filter((call) => call[0] === "event" && call[1] === "conversion");
}

async function installGtagSpy(page) {
  await page.evaluate(() => {
    window.__ffGtagCalls = [];
    const wrap = (fn) =>
      function gtag(...args) {
        window.__ffGtagCalls.push(
          args.map((item) => {
            if (item && typeof item === "object") {
              try {
                return JSON.parse(
                  JSON.stringify(item, (_k, v) => (typeof v === "function" ? "[fn]" : v)),
                );
              } catch {
                return String(item);
              }
            }
            return item;
          }),
        );
        if (typeof fn === "function") return fn.apply(this, args);
        return undefined;
      };
    window.gtag = wrap(window.gtag);
    window.dataLayer = window.dataLayer || [];
  });
}

async function clearLeadConversionClaims(page) {
  await page.evaluate(() => {
    const keys = [];
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith("ff-ads-lead-tracked:")) keys.push(key);
    }
    for (const key of keys) sessionStorage.removeItem(key);
  });
}

function extractSubmissionId(postData) {
  if (!postData) return null;
  const match = /name="submissionId"\r?\n\r?\n([0-9a-f-]{36})/i.exec(postData);
  return match?.[1] ?? null;
}

async function main() {
  const vite = startVite();
  const browser = await chromium.launch({ headless: true });
  const retrySubmissionId = "550e8400-e29b-41d4-a716-446655440099";
  try {
    await waitForServer(`${BASE}/contact`, vite);
    const page = await browser.newPage();
    const leadPosts = [];

    await page.route("**/api/leads", async (route) => {
      const req = route.request();
      if (req.method() !== "POST") {
        await route.fulfill({ status: 405, body: "Method Not Allowed" });
        return;
      }
      const raw = req.postData() || "";
      leadPosts.push(raw);
      const submissionId =
        extractSubmissionId(raw) || "550e8400-e29b-41d4-a716-446655440000";
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          submissionId,
        }),
      });
    });

    await page.goto(`${BASE}/contact?sent=1`, { waitUntil: "networkidle" });
    await installGtagSpy(page);
    await sleep(300);
    let calls = await page.evaluate(() => window.__ffGtagCalls || []);
    if (conversionCalls(calls).length !== 0) {
      throw new Error(`bare ?sent=1 fired conversion(s)`);
    }

    // Refreshing an old thank-you URL must still not convert.
    await page.reload({ waitUntil: "networkidle" });
    await installGtagSpy(page);
    await sleep(300);
    calls = await page.evaluate(() => window.__ffGtagCalls || []);
    if (conversionCalls(calls).length !== 0) {
      throw new Error(`refreshed ?sent=1 fired conversion(s)`);
    }

    await page.goto(`${BASE}/contact`, { waitUntil: "networkidle" });
    await installGtagSpy(page);
    await page.fill("#contact-name", "CURSOR AGENT TEST — NOT A LEAD");
    await page.fill("#contact-phone", "2105550199");
    await page.fill("#contact-email", "agent-test+discard@example.com");
    await page.fill(
      "#contact-message",
      "AGENT SMOKE TEST — discard. Mocked /api/leads only.",
    );
    // Double-click must still yield a single conversion.
    await Promise.all([
      page.click('button[type="submit"]'),
      page.click('button[type="submit"]'),
    ]);
    await page.waitForSelector("text=Sent.", { timeout: 15_000 });
    await sleep(200);

    calls = await page.evaluate(() => window.__ffGtagCalls || []);
    const conversions = conversionCalls(calls);
    if (conversions.length !== 1) {
      throw new Error(`expected 1 conversion, got ${conversions.length}: ${JSON.stringify(calls)}`);
    }
    if (conversions[0][2]?.send_to !== LEAD_SEND_TO) {
      throw new Error(`wrong send_to: ${JSON.stringify(conversions[0][2])}`);
    }
    const userData = calls.find((call) => call[0] === "set" && call[1] === "user_data");
    if (!userData?.[2]?.phone_number || !userData?.[2]?.email) {
      throw new Error(`missing enhanced user_data: ${JSON.stringify(userData)}`);
    }
    if (leadPosts.length !== 1) {
      throw new Error(`expected 1 lead POST after double-click, got ${leadPosts.length}`);
    }

    // Uncertain first response, then duplicate acceptance — still one conversion.
    await page.unroute("**/api/leads");
    leadPosts.length = 0;
    let uncertainAttempt = 0;
    await page.route("**/api/leads", async (route) => {
      uncertainAttempt += 1;
      leadPosts.push(`attempt-${uncertainAttempt}`);
      if (uncertainAttempt === 1) {
        await route.abort("failed");
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          duplicate: true,
          submissionId: retrySubmissionId,
        }),
      });
    });
    await page.goto(`${BASE}/contact`, { waitUntil: "networkidle" });
    await clearLeadConversionClaims(page);
    await page.evaluate((id) => {
      sessionStorage.setItem(
        "flipfixer-lead-draft",
        JSON.stringify({
          name: "CURSOR AGENT TEST — NOT A LEAD",
          phone: "2105550197",
          email: "agent-test+retry@example.com",
          message: "AGENT SMOKE retry path — discard.",
          submissionId: id,
        }),
      );
    }, retrySubmissionId);
    await page.reload({ waitUntil: "networkidle" });
    await installGtagSpy(page);
    await page.click('button[type="submit"]');
    await page.waitForSelector("text=Could not send the form", { timeout: 15_000 });
    calls = await page.evaluate(() => window.__ffGtagCalls || []);
    if (conversionCalls(calls).length !== 0) {
      throw new Error("uncertain failure path fired a conversion");
    }
    await page.click('button[type="submit"]');
    await page.waitForSelector("text=Sent.", { timeout: 15_000 });
    await sleep(200);
    calls = await page.evaluate(() => window.__ffGtagCalls || []);
    if (conversionCalls(calls).length !== 1) {
      throw new Error(
        `retry-after-uncertain expected 1 conversion, got ${conversionCalls(calls).length}`,
      );
    }
    // Same submission must not convert again if the duplicate response is replayed.
    await page.goto(`${BASE}/contact`, { waitUntil: "networkidle" });
    await page.evaluate((id) => {
      sessionStorage.setItem(
        "flipfixer-lead-draft",
        JSON.stringify({
          name: "CURSOR AGENT TEST — NOT A LEAD",
          phone: "2105550197",
          message: "AGENT SMOKE replay duplicate — discard.",
          submissionId: id,
        }),
      );
    }, retrySubmissionId);
    await page.reload({ waitUntil: "networkidle" });
    await installGtagSpy(page);
    await page.unroute("**/api/leads");
    await page.route("**/api/leads", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          duplicate: true,
          submissionId: retrySubmissionId,
        }),
      });
    });
    await page.click('button[type="submit"]');
    await page.waitForSelector("text=Sent.", { timeout: 15_000 });
    await sleep(200);
    calls = await page.evaluate(() => window.__ffGtagCalls || []);
    if (conversionCalls(calls).length !== 0) {
      throw new Error("duplicate replay of same submissionId fired another conversion");
    }

    await page.unroute("**/api/leads");
    await page.route("**/api/leads", async (route) => {
      await route.fulfill({
        status: 502,
        contentType: "application/json",
        body: JSON.stringify({
          ok: false,
          code: "delivery_failed",
          message: "Could not deliver the message. Call or text instead.",
        }),
      });
    });
    await page.goto(`${BASE}/contact`, { waitUntil: "networkidle" });
    await installGtagSpy(page);
    await page.fill("#contact-name", "CURSOR AGENT TEST — NOT A LEAD");
    await page.fill("#contact-phone", "2105550198");
    await page.fill("#contact-message", "AGENT SMOKE TEST reject path — discard.");
    await page.click('button[type="submit"]');
    await page.waitForSelector("text=Could not deliver", { timeout: 15_000 });
    await page.waitForSelector("text=Call", { timeout: 5_000 });
    await page.waitForSelector("text=Text", { timeout: 5_000 });
    const preserved = {
      name: await page.inputValue("#contact-name"),
      phone: await page.inputValue("#contact-phone"),
      message: await page.inputValue("#contact-message"),
    };
    if (
      preserved.name !== "CURSOR AGENT TEST — NOT A LEAD" ||
      preserved.phone !== "2105550198" ||
      !preserved.message.includes("reject path")
    ) {
      throw new Error(`failure cleared form fields: ${JSON.stringify(preserved)}`);
    }
    calls = await page.evaluate(() => window.__ffGtagCalls || []);
    if (conversionCalls(calls).length !== 0) {
      throw new Error("failed delivery path fired a conversion");
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          leadSendTo: LEAD_SEND_TO,
          conversionCount: 1,
          enhancedUserData: userData[2],
          note: "Mocked /api/leads only — no production lead and no Ads UI claim.",
        },
        null,
        2,
      ),
    );
  } finally {
    await browser.close();
    vite.kill("SIGTERM");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
