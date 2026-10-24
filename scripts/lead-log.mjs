/** Private operator CLI. Requires database credentials; never exposed as a web route. */
import pg from "pg";
import { pathToFileURL } from "node:url";

const fields = {
  contact_status: ["new", "attempted", "connected", "closed"],
  qualification: ["unreviewed", "qualified", "unqualified", "spam"],
  booked_job: ["true", "false"],
  is_test: ["true", "false"],
};

export function parseLeadUpdate(field, value) {
  if (field === "quote_amount") {
    if (!/^\d{1,10}(\.\d{1,2})?$/.test(value)) throw new Error("Invalid quote amount");
    return value;
  }
  if (!Object.hasOwn(fields, field) || !fields[field].includes(value))
    throw new Error("Invalid field or value");
  return ["booked_job", "is_test"].includes(field) ? value === "true" : value;
}

export async function runLeadLog(db, args) {
  const [command, id, field, raw] = args;
  if (command === "summary" && args.length === 1) {
    return (
      await db.query(`SELECT count(*) AS inquiries,
      count(*) FILTER (WHERE qualification = 'qualified') AS qualified,
      count(*) FILTER (WHERE booked_job) AS booked_jobs
      FROM lead_business_performance`)
    ).rows;
  }
  if (command === "list" && args.length === 1) {
    return (
      await db.query("SELECT * FROM lead_business_performance ORDER BY created_at DESC LIMIT 100")
    ).rows;
  }
  if (command !== "update" || args.length !== 4 || !/^[0-9a-f-]{36}$/i.test(id)) {
    throw new Error("Usage: lead-log.mjs summary | list | update SUBMISSION_ID FIELD VALUE");
  }
  const value = parseLeadUpdate(field, raw);
  // field is strictly allowlisted above; all values are parameterized.
  const result = await db.query(
    `UPDATE contact_leads SET ${field} = $2, updated_at = now()
    WHERE submission_id = $1 RETURNING submission_id`,
    [id, value],
  );
  if (!result.rows.length) throw new Error("Submission not found");
  return result.rows;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!process.env.DATABASE_URL?.trim()) throw new Error("DATABASE_URL is required");
  const db = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  try {
    console.log(JSON.stringify(await runLeadLog(db, process.argv.slice(2)), null, 2));
  } catch {
    console.error("Lead log operation failed. Check command, database access, and migrations.");
    process.exitCode = 1;
  } finally {
    await db.end();
  }
}
