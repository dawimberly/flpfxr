#!/usr/bin/env node
/**
 * Reset an employee's password on production by deleting their auth rows and
 * re-running sign-up with EMPLOYEE_* from `.env`.
 *
 * Usage: BETTER_AUTH_URL=https://theflipfixer.com npm run reset-employee-password
 */
import pg from "pg";
import { loadDotEnv } from "./load-dotenv.mjs";

loadDotEnv();

const email = process.env.EMPLOYEE_EMAIL?.trim();
const password = process.env.EMPLOYEE_PASSWORD;
const name = process.env.EMPLOYEE_NAME?.trim() || "Employee";
const base = (process.env.BETTER_AUTH_URL || "https://theflipfixer.com").replace(/\/+$/, "");
const databaseUrl = process.env.DATABASE_URL?.trim();

if (!email || !password) {
  console.error("Set EMPLOYEE_EMAIL and EMPLOYEE_PASSWORD in .env");
  process.exit(1);
}

if (!databaseUrl) {
  console.error("Set DATABASE_URL in .env");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });
const client = await pool.connect();
try {
  const { rows } = await client.query('SELECT id FROM "user" WHERE email = $1', [email]);
  if (rows.length > 0) {
    const userId = rows[0].id;
    await client.query('DELETE FROM "session" WHERE "userId" = $1', [userId]);
    await client.query('DELETE FROM "account" WHERE "userId" = $1', [userId]);
    await client.query('DELETE FROM "user" WHERE id = $1', [userId]);
    console.log(`Removed existing account for ${email}.`);
  }
} finally {
  client.release();
  await pool.end();
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

console.log(`Password updated for ${email}. Sign in at ${base}/login`);
