import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import type { EstimateDraft, SavedEstimate } from "@/lib/estimate-log";

function cloudReady() {
  return Boolean(process.env.DATABASE_URL?.trim());
}

function asJobs(rows: Array<{ id: string; saved_at: string; snapshot: unknown; summary: unknown }>): SavedEstimate[] {
  return rows.map((row) => ({
    id: row.id,
    savedAt: typeof row.saved_at === "string" ? row.saved_at : new Date(row.saved_at).toISOString(),
    snapshot: row.snapshot as SavedEstimate["snapshot"],
    summary: row.summary as SavedEstimate["summary"],
  }));
}

export const pullCloudJobs = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    if (!cloudReady()) return { ok: false as const, reason: "no-database", jobs: [] as SavedEstimate[] };
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const rows = await sql.query<{
      id: string;
      saved_at: string;
      snapshot: unknown;
      summary: unknown;
    }>("select id, saved_at, snapshot, summary from saved_jobs where owner_key = $1 order by saved_at desc", [
      context.userId,
    ]);
    return { ok: true as const, reason: null, jobs: asJobs(rows) };
  });

export const pushCloudJob = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { job: SavedEstimate }) => data)
  .handler(async ({ data, context }) => {
    if (!cloudReady()) return { ok: false as const, reason: "no-database" };
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    await sql.query(
      `insert into saved_jobs (owner_key, id, saved_at, snapshot, summary)
       values ($1, $2, $3, $4::jsonb, $5::jsonb)
       on conflict (owner_key, id) do update set
         saved_at = excluded.saved_at,
         snapshot = excluded.snapshot,
         summary = excluded.summary`,
      [
        context.userId,
        data.job.id,
        data.job.savedAt,
        JSON.stringify(data.job.snapshot),
        JSON.stringify(data.job.summary),
      ],
    );
    return { ok: true as const, reason: null };
  });

export const deleteCloudJob = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    if (!cloudReady()) return { ok: false as const, reason: "no-database" };
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    await sql.query("delete from saved_jobs where owner_key = $1 and id = $2", [context.userId, data.id]);
    return { ok: true as const, reason: null };
  });

export const pullCloudDraft = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    if (!cloudReady()) return { ok: false as const, reason: "no-database", draft: null as EstimateDraft | null };
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const rows = await sql.query<{ draft: EstimateDraft }>("select draft from job_drafts where owner_key = $1", [
      context.userId,
    ]);
    return { ok: true as const, reason: null, draft: rows[0]?.draft ?? null };
  });

export const pushCloudDraft = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { draft: EstimateDraft }) => data)
  .handler(async ({ data, context }) => {
    if (!cloudReady()) return { ok: false as const, reason: "no-database" };
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    await sql.query(
      `insert into job_drafts (owner_key, draft, updated_at)
       values ($1, $2::jsonb, now())
       on conflict (owner_key) do update set draft = excluded.draft, updated_at = now()`,
      [context.userId, JSON.stringify(data.draft)],
    );
    return { ok: true as const, reason: null };
  });
