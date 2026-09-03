-- Estimator jobs + in-progress draft, scoped per signed-in employee.
CREATE TABLE IF NOT EXISTS saved_jobs (
  owner_key TEXT NOT NULL,
  id TEXT NOT NULL,
  saved_at TIMESTAMPTZ NOT NULL,
  snapshot JSONB NOT NULL,
  summary JSONB NOT NULL,
  PRIMARY KEY (owner_key, id)
);

CREATE INDEX IF NOT EXISTS saved_jobs_owner_saved_at_idx
  ON saved_jobs (owner_key, saved_at DESC);

CREATE TABLE IF NOT EXISTS job_drafts (
  owner_key TEXT PRIMARY KEY,
  draft JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
