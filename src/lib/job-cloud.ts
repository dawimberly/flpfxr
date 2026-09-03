import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import type { EstimateDraft, SavedEstimate } from "@/lib/estimate-log";

function cloudReady() {
  return Boolean(process.env.DATABASE_URL?.trim());
}

function toIso(value: string | Date | undefined | null): string {
  if (!value) return new Date().toISOString();
  return value instanceof Date ? value.toISOString() : String(value);
}

function asJobs(
  rows: Array<{ id: string; saved_at: string | Date; snapshot: unknown; summary: unknown }>,
): SavedEstimate[] {
  return rows.map((row) => ({
    id: row.id,
    savedAt: toIso(row.saved_at),
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
      saved_at: string | Date;
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
    if (!cloudReady()) {
      return {
        ok: false as const,
        reason: "no-database",
        draft: null as EstimateDraft | null,
        updatedAt: null as string | null,
      };
    }
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const rows = await sql.query<{ draft: EstimateDraft; updated_at: string | Date }>(
      "select draft, updated_at from job_drafts where owner_key = $1",
      [context.userId],
    );
    const row = rows[0];
    if (!row) return { ok: true as const, reason: null, draft: null, updatedAt: null as string | null };
    const updatedAt = toIso(row.updated_at);
    const draft = {
      ...row.draft,
      updatedAt: row.draft?.updatedAt ?? updatedAt,
    };
    return { ok: true as const, reason: null, draft, updatedAt };
  });

export const pushCloudDraft = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { draft: EstimateDraft }) => data)
  .handler(async ({ data, context }) => {
    if (!cloudReady()) return { ok: false as const, reason: "no-database" };
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const updatedAt = data.draft.updatedAt ?? new Date().toISOString();
    const draft = { ...data.draft, updatedAt };
    await sql.query(
      `insert into job_drafts (owner_key, draft, updated_at)
       values ($1, $2::jsonb, $3::timestamptz)
       on conflict (owner_key) do update set draft = excluded.draft, updated_at = excluded.updated_at`,
      [context.userId, JSON.stringify(draft), updatedAt],
    );
    return { ok: true as const, reason: null };
  });
