-- Personalized estimate PDF email requests and private download tokens.
ALTER TABLE contact_leads
  ADD COLUMN IF NOT EXISTS marketing_consent BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE contact_leads
  ADD COLUMN IF NOT EXISTS estimate_total_cents INTEGER;
DO $$ BEGIN
  ALTER TABLE contact_leads
    ADD CONSTRAINT contact_leads_estimate_total_cents_check
    CHECK (estimate_total_cents IS NULL OR estimate_total_cents >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS estimate_pdf_downloads (
  token_hash TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL REFERENCES contact_leads (submission_id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS estimate_pdf_downloads_submission_idx
  ON estimate_pdf_downloads (submission_id);

CREATE INDEX IF NOT EXISTS estimate_pdf_downloads_expires_idx
  ON estimate_pdf_downloads (expires_at);
