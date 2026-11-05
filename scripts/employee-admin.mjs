import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
/** Run only with direct database credentials. No HTTP sign-up endpoint is used. */
export async function provisionEmployee(client, { email, password, name = "Employee", reset = false }) {
  if (!email || !password || password.length < 12) throw new Error("Set EMPLOYEE_EMAIL and EMPLOYEE_PASSWORD (at least 12 characters).");
  const hashed = await hashPassword(password);
  await client.query("BEGIN");
  try {
    const { rows } = await client.query('SELECT id FROM "user" WHERE lower(email) = lower($1)', [email]);
    if (rows.length && !reset) throw new Error("Account already exists; use reset-employee-password explicitly.");
    if (!rows.length && reset) throw new Error("Account not found; use create-employee.");
    const id = rows[0]?.id ?? randomUUID();
    if (!rows.length) await client.query('INSERT INTO "user" (id, name, email, "emailVerified") VALUES ($1,$2,$3,false)', [id, name, email.toLowerCase()]);
    if (reset) {
      await client.query('DELETE FROM "session" WHERE "userId" = $1', [id]);
      const result = await client.query('UPDATE "account" SET password = $1, "updatedAt" = now() WHERE "userId" = $2 AND "providerId" = $3 RETURNING id', [hashed, id, "credential"]);
      if (!result.rows.length) await insertCredential(client, id, hashed);
    } else await insertCredential(client, id, hashed);
    await client.query("COMMIT");
    return id;
  } catch (error) { await client.query("ROLLBACK"); throw error; }
}
function insertCredential(client, id, hashed) {
  return client.query('INSERT INTO "account" (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt") VALUES ($1,$2,$3,$4,$5,now(),now())', [randomUUID(), id, "credential", id, hashed]);
}
