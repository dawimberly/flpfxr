/**
 * Local smoke: mock FormSubmit, submit the contact form, assert exactly one
 * Ads lead conversion is queued with the primary send_to label.
 *
 * Does not hit production FormSubmit or Google Ads. Safe to run repeatedly.
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
        window.__ffGtagCalls.push(args.map((item) => {
          if (item && typeof item === "object") {
            try {
              return JSON.parse(JSON.stringify(item, (_k, v) => (typeof v === "function" ? "[fn]" : v)));
            } catch {
              return String(item);
            }
          }
          return item;
        }));
        if (typeof fn === "function") return fn.apply(this, args);
        return undefined;
      };
    window.gtag = wrap(window.gtag);
    window.dataLayer = window.dataLayer || [];
  });
}

async function main() {
  const vite = startVite();
  const browser = await chromium.launch({ headless: true });
  try {
    await waitForServer(`${BASE}/contact`, vite);
    const page = await browser.newPage();

    await page.route("**/formsubmit.co/**", async (route) => {
      const req = route.request();
      if (req.method() === "POST" && req.url().includes("/ajax/")) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            message: "Your form has been submitted",
          }),
        });
        return;
      }
      await route.abort();
    });

    // Opening ?sent=1 alone must not convert.
    await page.goto(`${BASE}/contact?sent=1`, { waitUntil: "networkidle" });
    await installGtagSpy(page);
    await sleep(300);
    let calls = await page.evaluate(() => window.__ffGtagCalls || []);
    if (conversionCalls(calls).length !== 0) {
      throw new Error(`bare ?sent=1 fired conversion(s): ${JSON.stringify(conversionCalls(calls))}`);
    }

    await page.goto(`${BASE}/contact`, { waitUntil: "networkidle" });
    await installGtagSpy(page);
    await page.fill("#contact-name", "CURSOR AGENT TEST — NOT A LEAD");
    await page.fill("#contact-phone", "2105550199");
    await page.fill("#contact-email", "agent-test+discard@example.com");
    await page.fill(
      "#contact-message",
      "AGENT SMOKE TEST — discard. Do not call. Mocked FormSubmit only.",
    );
    await page.click('button[type="submit"]');
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

    // Rejected FormSubmit must not convert.
    await page.unroute("**/formsubmit.co/**");
    await page.route("**/formsubmit.co/**", async (route) => {
      const req = route.request();
      if (req.method() === "POST" && req.url().includes("/ajax/")) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: false,
            message: "Make sure you confirm the form through your email.",
          }),
        });
        return;
      }
      await route.abort();
    });
    await page.goto(`${BASE}/contact`, { waitUntil: "networkidle" });
    await installGtagSpy(page);
    await page.fill("#contact-name", "CURSOR AGENT TEST — NOT A LEAD");
    await page.fill("#contact-phone", "2105550198");
    await page.fill("#contact-message", "AGENT SMOKE TEST reject path — discard.");
    await page.click('button[type="submit"]');
    await page.waitForSelector("text=FormSubmit confirmation", { timeout: 15_000 });
    calls = await page.evaluate(() => window.__ffGtagCalls || []);
    if (conversionCalls(calls).length !== 0) {
      throw new Error("confirmation/reject path fired a conversion");
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          leadSendTo: LEAD_SEND_TO,
          conversionCount: 1,
          enhancedUserData: userData[2],
          note: "Mocked FormSubmit only — no production lead and no claim about Ads UI warning clearance.",
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
