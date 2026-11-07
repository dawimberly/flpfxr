/**
 * Real PGLite integration tests for estimate follow-up claim/transaction semantics.
 */
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import {
  ESTIMATE_STAFF_NOTIFY_TO,
  handleEstimateEmailRequest,
  type WithTransaction,
} from "./estimate-email.server.ts";
import { DEFAULT_PROJECT_INPUTS } from "./public-estimate-options.ts";

type Sql = { query<T>(text: string, params?: unknown[]): Promise<T[]> };

async function createIsolatedDb() {
  const { PGlite } = await import("@electric-sql/pglite");
  const pg = new PGlite();
  await pg.waitReady;
  const migrationDir = join(process.cwd(), "migrations");
  const files = readdirSync(migrationDir)
    .filter((name) => /^\d+_.*\.sql$/i.test(name))
    .sort();
  assert.ok(files.length >= 6, "expected migrations present");
  for (const file of files) {
    await pg.exec(readFileSync(join(migrationDir, file), "utf8"));
  }
  const sql: Sql = {
    async query<T>(text: string, params: unknown[] = []) {
      return (await pg.query<T>(text, params)).rows;
    },
  };
  const withTransaction: WithTransaction = async (fn) =>
    pg.transaction(async (tx) => {
      const txSql: Sql = {
        async query<T>(text: string, params: unknown[] = []) {
          return (await tx.query<T>(text, params)).rows;
        },
      };
      return fn(txSql);
    });
  return { sql, withTransaction, pg };
}

function formFrom(fields: Record<string, string>) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  return form;
}

/** Unique forwarded IP so shared abuse windows do not trip across cases. */
function postRequest(fields: Record<string, string>, ip = `203.0.113.${1 + Math.floor(Math.random() * 200)}`) {
  return new Request("https://theflipfixer.com/api/estimate-email", {
    method: "POST",
    headers: { "x-forwarded-for": ip },
    body: formFrom(fields),
  });
}

const enabledEnv = {
  ESTIMATE_FOLLOWUP_ENABLED: "1",
  RESEND_API_KEY: "re_test_key",
  LEAD_FROM_EMAIL: "The Flip Fixer <leads@theflipfixer.com>",
  DATABASE_URL: "postgres://integration-test",
};

describe("estimate follow-up PGLite integration", () => {
  let sql: Sql;
  let withTransaction: WithTransaction;

  before(async () => {
    ({ sql, withTransaction } = await createIsolatedDb());
  });

  it("applies migrations and stores a claimed lead + PDF snapshot atomically", async () => {
    const tables = await sql.query<{ tablename: string }>(
      `select tablename from pg_tables where schemaname = 'public' and tablename in ('contact_leads','estimate_pdf_downloads','estimate_email_abuse')`,
    );
    assert.equal(tables.length, 3);

    let sends = 0;
    const submissionId = randomUUID();
    const response = await handleEstimateEmailRequest(postRequest({
      submissionId,
      name: "Alex Sample",
      email: "alex.sample@example.com",
      phone: "",
      zip: "78209",
      selections: JSON.stringify({ ...DEFAULT_PROJECT_INPUTS, includeFlooring: false }),
    }, "198.51.100.10"), {
      sql,
      withTransaction,
      env: enabledEnv,
      sendMail: async (input) => {
        sends += 1;
        assert.equal(input.to.toLowerCase(), ESTIMATE_STAFF_NOTIFY_TO);
        return { ok: true, id: "mock" };
      },
    });
    const body = await response.json() as { ok: boolean; downloadToken?: string; leadSaved?: boolean };
    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.leadSaved, true);
    assert.ok(body.downloadToken);
    assert.equal(sends, 1);

    const leads = await sql.query<{ submission_id: string; staff_email_ok: boolean }>(
      `select submission_id, staff_email_ok from contact_leads where submission_id = $1`,
      [submissionId],
    );
    assert.equal(leads.length, 1);
    assert.equal(leads[0].staff_email_ok, true);
    const downloads = await sql.query<{ pdf_bytes: Uint8Array | null }>(
      `select pdf_bytes from estimate_pdf_downloads where submission_id = $1`,
      [submissionId],
    );
    assert.ok(downloads[0]?.pdf_bytes && downloads[0].pdf_bytes.byteLength > 500);
  });

  it("resolves concurrent matching claims without duplicate notifications", async () => {
    const submissionId = randomUUID();
    let sends = 0;
    const fields = {
      submissionId,
      name: "Alex Sample",
      email: "concurrent@example.com",
      phone: "",
      zip: "78209",
      selections: JSON.stringify({ ...DEFAULT_PROJECT_INPUTS, includeFlooring: false }),
    };
    const sendMail = async (input: { to: string; idempotencyKey?: string }) => {
      sends += 1;
      assert.equal(input.to.toLowerCase(), ESTIMATE_STAFF_NOTIFY_TO);
      assert.equal(input.idempotencyKey, `estimate-followup-staff/${submissionId}`);
      return { ok: true as const, id: `m${sends}` };
    };
    const [a, b] = await Promise.all([
      handleEstimateEmailRequest(postRequest(fields, "198.51.100.20"), {
        sql, withTransaction, env: enabledEnv, sendMail,
      }),
      handleEstimateEmailRequest(postRequest(fields, "198.51.100.21"), {
        sql, withTransaction, env: enabledEnv, sendMail,
      }),
    ]);
    assert.equal(a.status, 200);
    assert.equal(b.status, 200);
    const leads = await sql.query(
      `select submission_id from contact_leads where submission_id = $1`,
      [submissionId],
    );
    assert.equal(leads.length, 1);
    const downloads = await sql.query<{ snapshot_total_cents: number }>(
      `select snapshot_total_cents from estimate_pdf_downloads where submission_id = $1`,
      [submissionId],
    );
    assert.ok(downloads.length >= 1);
    assert.ok(downloads.every((row) => row.snapshot_total_cents === downloads[0].snapshot_total_cents));
    // Idempotent provider key + staff flag: at most a small number of send attempts, one lead.
    assert.ok(sends >= 1 && sends <= 2);
  });

  it("returns 409 for conflicting payloads without alternate PDF or notification", async () => {
    const submissionId = randomUUID();
    let sends = 0;
    const first = await handleEstimateEmailRequest(postRequest({
      submissionId,
      name: "Alex Sample",
      email: "first@example.com",
      phone: "",
      zip: "78209",
      selections: JSON.stringify({ ...DEFAULT_PROJECT_INPUTS, includeFlooring: false }),
    }, "198.51.100.30"), {
      sql,
      withTransaction,
      env: enabledEnv,
      sendMail: async () => {
        sends += 1;
        return { ok: true, id: "first" };
      },
    });
    assert.equal(first.status, 200);
    const beforeDownloads = await sql.query(
      `select token_hash from estimate_pdf_downloads where submission_id = $1`,
      [submissionId],
    );
    const conflict = await handleEstimateEmailRequest(postRequest({
      submissionId,
      name: "Alex Sample",
      email: "other@example.com",
      phone: "",
      zip: "78209",
      selections: JSON.stringify({ ...DEFAULT_PROJECT_INPUTS, includeFlooring: false }),
    }, "198.51.100.31"), {
      sql,
      withTransaction,
      env: enabledEnv,
      sendMail: async () => {
        sends += 1;
        return { ok: true, id: "conflict" };
      },
    });
    assert.equal(conflict.status, 409);
    assert.equal(sends, 1);
    const afterDownloads = await sql.query(
      `select token_hash from estimate_pdf_downloads where submission_id = $1`,
      [submissionId],
    );
    assert.equal(afterDownloads.length, beforeDownloads.length);
  });

  it("rolls back the lead when PDF persistence fails inside the transaction", async () => {
    const submissionId = randomUUID();
    const failingTx: WithTransaction = async (fn) =>
      withTransaction(async (txSql) => {
        const wrapped: Sql = {
          async query<T>(text: string, params: unknown[] = []) {
            if (/insert into estimate_pdf_downloads/i.test(text)) {
              throw new Error("forced pdf failure");
            }
            return txSql.query<T>(text, params);
          },
        };
        return fn(wrapped);
      });

    const response = await handleEstimateEmailRequest(postRequest({
      submissionId,
      name: "Alex Sample",
      email: "rollback@example.com",
      phone: "",
      zip: "78209",
      selections: JSON.stringify({ ...DEFAULT_PROJECT_INPUTS, includeFlooring: false }),
    }, "198.51.100.40"), {
      sql,
      withTransaction: failingTx,
      env: enabledEnv,
      sendMail: async () => ({ ok: true, id: "x" }),
    });
    assert.equal(response.status, 500);
    const body = await response.json() as { leadSaved?: boolean };
    // Transaction rolled back: lead must not remain.
    const leads = await sql.query(
      `select submission_id from contact_leads where submission_id = $1`,
      [submissionId],
    );
    assert.equal(leads.length, 0);
    assert.equal(body.leadSaved, false);
  });
});
