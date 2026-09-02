#!/usr/bin/env node
/**
 * Create the one employee login (run once after auth DB is set up).
 *
 * Usage:
 *   EMPLOYEE_EMAIL=jon@theflipfixer.com \
 *   EMPLOYEE_PASSWORD='your-secure-password' \
 *   EMPLOYEE_NAME='Jon' \
 *   BETTER_AUTH_URL=https://theflipfixer.com \
 *   node scripts/create-employee.mjs
 *
 * For local dev with auth on:
 *   BETTER_AUTH_URL=http://localhost:8080 node scripts/create-employee.mjs
 */
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
  headers: { "Content-Type": "application/json" },
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
