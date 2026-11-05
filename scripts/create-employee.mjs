#!/usr/bin/env node
import pg from "pg";
import { loadDotEnv } from "./load-dotenv.mjs";
import { provisionEmployee } from "./employee-admin.mjs";
loadDotEnv();
if (!process.env.DATABASE_URL?.trim()) throw new Error("DATABASE_URL is required for server-only account provisioning.");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
const client = await pool.connect();
try {
  const id = await provisionEmployee(client, { email: process.env.EMPLOYEE_EMAIL?.trim(), password: process.env.EMPLOYEE_PASSWORD, name: process.env.EMPLOYEE_NAME?.trim() });
  console.log("Account created. Before crew access is granted, add this user ID to the server-only EMPLOYEE_USER_IDS allow-list:", id);
} finally { client.release(); await pool.end(); }
