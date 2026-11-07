-- Double opt-in tokens for optional customer estimate PDF email (default-OFF feature).
CREATE TABLE IF NOT EXISTS estimate_customer_email_confirm (
  token_hash TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL REFERENCES contact_leads (submission_id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS estimate_customer_email_confirm_submission_idx
  ON estimate_customer_email_confirm (submission_id);

CREATE INDEX IF NOT EXISTS estimate_customer_email_confirm_expires_idx
  ON estimate_customer_email_confirm (expires_at);
