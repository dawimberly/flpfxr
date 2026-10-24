import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { runLeadLog, parseLeadUpdate } from "./lead-log.mjs";

test("private log preserves phone-only leads, attribution and status; excludes known and flagged tests", async () => {
  const db = new PGlite();
  try {
    await db.exec(readFileSync("migrations/0003_contact_leads.sql", "utf8"));
    const known = "89184cbd-8083-4fe0-948d-595de1614cf7";
    await db.query(
      `INSERT INTO contact_leads (submission_id,name,phone,message,delivered_email)
      VALUES ($1,'TEST','2105550100','fixture',true)`,
      [known],
    );
    await db.exec(readFileSync("migrations/0004_private_lead_log.sql", "utf8"));
    const id = "550e8400-e29b-41d4-a716-446655440000";
    await db.query(
      `INSERT INTO contact_leads (submission_id,name,phone,message,delivered_email)
      VALUES ($1,'Fixture','2105550100','fixture',true)`,
      [id],
    );
    assert.equal((await runLeadLog(db, ["summary"]))[0].inquiries, 1);
    await runLeadLog(db, ["update", id, "contact_status", "attempted"]);
    await runLeadLog(db, ["update", id, "qualification", "qualified"]);
    await runLeadLog(db, ["update", id, "quote_amount", "2500.00"]);
    await runLeadLog(db, ["update", id, "booked_job", "true"]);
    const [row] = await runLeadLog(db, ["list"]);
    assert.equal(row.contact_status, "attempted");
    assert.equal(row.gclid, null);
    for (const key of ["name", "email", "phone", "message", "client_ip"])
      assert.equal(key in row, false);
    await db.query("UPDATE contact_leads SET ad_ids = $2::jsonb WHERE submission_id = $1", [
      id,
      JSON.stringify({ gclid: "fixture-click" }),
    ]);
    assert.equal((await runLeadLog(db, ["list"]))[0].gclid, "fixture-click");
    await runLeadLog(db, ["update", known, "is_test", "false"]);
    assert.equal((await runLeadLog(db, ["summary"]))[0].inquiries, 1);
    await runLeadLog(db, ["update", id, "is_test", "true"]);
    assert.equal((await runLeadLog(db, ["summary"]))[0].inquiries, 0);
    assert.throws(() => parseLeadUpdate("name", "anything"));
    assert.throws(() => parseLeadUpdate("quote_amount", "-1"));
  } finally {
    await db.close();
  }
});
