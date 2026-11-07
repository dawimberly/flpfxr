-- Durable estimate-email abuse windows, immutable PDF snapshots, delivery flags, revocation.
CREATE TABLE IF NOT EXISTS estimate_email_abuse (
  bucket TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  hit_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket, window_start)
);

CREATE INDEX IF NOT EXISTS estimate_email_abuse_window_idx
  ON estimate_email_abuse (window_start);

ALTER TABLE contact_leads
  ADD COLUMN IF NOT EXISTS customer_email_ok BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE contact_leads
  ADD COLUMN IF NOT EXISTS staff_email_ok BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE contact_leads
  ADD COLUMN IF NOT EXISTS estimate_snapshot JSONB;

ALTER TABLE estimate_pdf_downloads
  ADD COLUMN IF NOT EXISTS pdf_bytes BYTEA;
ALTER TABLE estimate_pdf_downloads
  ADD COLUMN IF NOT EXISTS snapshot_total_cents INTEGER;
ALTER TABLE estimate_pdf_downloads
  ADD COLUMN IF NOT EXISTS snapshot_name TEXT;
ALTER TABLE estimate_pdf_downloads
  ADD COLUMN IF NOT EXISTS snapshot_selections JSONB;
ALTER TABLE estimate_pdf_downloads
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;
ALTER TABLE estimate_pdf_downloads
  ADD COLUMN IF NOT EXISTS download_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE estimate_pdf_downloads
  ADD COLUMN IF NOT EXISTS last_download_at TIMESTAMPTZ;

DO $$ BEGIN
  ALTER TABLE estimate_pdf_downloads
    ADD CONSTRAINT estimate_pdf_downloads_total_check
    CHECK (snapshot_total_cents IS NULL OR snapshot_total_cents >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
