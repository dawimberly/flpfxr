#!/usr/bin/env node
/**
 * Create the one employee login (run once after auth DB is set up).
 *
 * Reads `flpfxr/.env` when present (EMPLOYEE_* and BETTER_AUTH_URL).
 * Or set env vars manually before running: npm run create-employee
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

function loadDotEnv() {
  const path = join(root, ".env");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadDotEnv();

const email = process.env.EMPLOYEE_EMAIL?.trim();
const password = process.env.EMPLOYEE_PASSWORD;
const name = process.env.EMPLOYEE_NAME?.trim() || "Employee";
const base = (process.env.BETTER_AUTH_URL || "http://localhost:8080").replace(/\/+$/, "");

if (!email || !password) {
  console.error("Set EMPLOYEE_EMAIL and EMPLOYEE_PASSWORD.");
  process.exit(1);
}

const res = await fetch(`${base}/api/auth/sign-up/email`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Origin: base,
  },
  body: JSON.stringify({ email, password, name }),
});

const text = await res.text();
let payload;
try {
  payload = text ? JSON.parse(text) : null;
} catch {
  payload = text;
}

if (!res.ok) {
  console.error("Sign-up failed:", res.status, payload);
  process.exit(1);
}

console.log(`Employee account ready for ${email}. They can sign in at ${base}/login`);
