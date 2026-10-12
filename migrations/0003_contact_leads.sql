-- Public contact / lead form submissions (idempotent by submission_id).
CREATE TABLE IF NOT EXISTS contact_leads (
  submission_id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT NOT NULL,
  message TEXT NOT NULL,
  service TEXT,
  source TEXT,
  affiliation TEXT,
  ad_ids JSONB NOT NULL DEFAULT '{}'::jsonb,
  has_photo BOOLEAN NOT NULL DEFAULT false,
  delivered_email BOOLEAN NOT NULL DEFAULT false,
  client_ip TEXT
);

CREATE INDEX IF NOT EXISTS contact_leads_created_at_idx
  ON contact_leads (created_at DESC);

CREATE INDEX IF NOT EXISTS contact_leads_phone_created_at_idx
  ON contact_leads (phone, created_at DESC);
