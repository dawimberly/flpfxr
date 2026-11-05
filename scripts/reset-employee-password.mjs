#!/usr/bin/env node
import pg from "pg";
import { loadDotEnv } from "./load-dotenv.mjs";
import { provisionEmployee } from "./employee-admin.mjs";
loadDotEnv();
if (!process.env.DATABASE_URL?.trim()) throw new Error("DATABASE_URL is required for server-only password reset.");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
const client = await pool.connect();
try {
  await provisionEmployee(client, { email: process.env.EMPLOYEE_EMAIL?.trim(), password: process.env.EMPLOYEE_PASSWORD, reset: true });
  console.log("Password updated and existing sessions revoked. Employee approval remains unchanged.");
} finally { client.release(); await pool.end(); }
