/**
 * Local PGLite check: 0003_contact_leads.sql applies via the same pendingMigrations
 * bookkeeping as Vercel `npm run db:migrate`, is idempotent, and does not wipe rows.
 * Never points at production DATABASE_URL.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { pendingMigrations } from "./migration-plan.mjs";
import { projectRoot } from "./with-app-env.mjs";

const MIGRATION = "0003_contact_leads.sql";

test("0003_contact_leads applies once and preserves existing rows", async () => {
  assert.equal(process.env.DATABASE_URL, undefined);

  const sqlText = readFileSync(join(projectRoot(), "migrations", MIGRATION), "utf8");
  const db = new PGlite();

  await db.exec(
    "CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())",
  );

  const entries = ["0001_auth.sql", "0002_estimator_jobs.sql", MIGRATION];
  const firstPass = pendingMigrations(entries, []);
  assert.ok(firstPass.some((item) => item.name === MIGRATION));

  await db.transaction(async (tx) => {
    await tx.exec(sqlText);
    await tx.query("insert into _migrations (name) values ($1)", [MIGRATION]);
  });

  await db.query(
    `insert into contact_leads (
       submission_id, name, phone, message, delivered_email
     ) values ($1, $2, $3, $4, $5)`,
    [
      "550e8400-e29b-41d4-a716-446655440000",
      "EXISTING ROW",
      "2104369117",
      "must survive re-migrate",
      true,
    ],
  );

  const applied = (await db.query("select name from _migrations")).rows.map(
    (row) => row.name,
  );
  assert.ok(applied.includes(MIGRATION));
  assert.equal(
    pendingMigrations(entries, applied).some((item) => item.name === MIGRATION),
    false,
  );

  // Re-running the CREATE IF NOT EXISTS DDL is safe; bookkeeping skips a second apply.
  await db.exec(sqlText);

  const rows = await db.query(
    "select submission_id, name, delivered_email from contact_leads",
  );
  assert.equal(rows.rows.length, 1);
  assert.equal(rows.rows[0].submission_id, "550e8400-e29b-41d4-a716-446655440000");
  assert.equal(rows.rows[0].name, "EXISTING ROW");
  assert.equal(rows.rows[0].delivered_email, true);

  await db.close();
});
