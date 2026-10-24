-- Extend existing private intake records; do not copy customer data into files.
ALTER TABLE contact_leads
  ADD COLUMN contact_status TEXT NOT NULL DEFAULT 'new'
    CHECK (contact_status IN ('new', 'attempted', 'connected', 'closed')),
  ADD COLUMN qualification TEXT NOT NULL DEFAULT 'unreviewed'
    CHECK (qualification IN ('unreviewed', 'qualified', 'unqualified', 'spam')),
  ADD COLUMN quote_amount NUMERIC(12,2) CHECK (quote_amount >= 0),
  ADD COLUMN booked_job BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN is_test BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Also excludes the known test if it arrives/backfills after this migration.
CREATE TABLE lead_test_exclusions (
  submission_id TEXT PRIMARY KEY
);
INSERT INTO lead_test_exclusions (submission_id)
VALUES ('89184cbd-8083-4fe0-948d-595de1614cf7');
UPDATE contact_leads SET is_test = true
WHERE submission_id IN (SELECT submission_id FROM lead_test_exclusions);

CREATE INDEX contact_leads_gclid_idx ON contact_leads ((ad_ids->>'gclid'))
WHERE ad_ids->>'gclid' IS NOT NULL;

-- Explicit columns avoid exposing names, contact details, messages, or client IP.
-- Not a public API: access remains limited to database credentials.
CREATE VIEW lead_business_performance AS
SELECT submission_id, created_at, service, source,
       ad_ids->>'gclid' AS gclid, ad_ids->>'gbraid' AS gbraid,
       ad_ids->>'wbraid' AS wbraid, ad_ids->>'utm_source' AS utm_source,
       ad_ids->>'utm_medium' AS utm_medium, ad_ids->>'utm_campaign' AS utm_campaign,
       contact_status, qualification, quote_amount, booked_job
FROM contact_leads
WHERE delivered_email AND NOT is_test
  AND qualification <> 'spam'
  AND NOT EXISTS (SELECT 1 FROM lead_test_exclusions e
                  WHERE e.submission_id = contact_leads.submission_id);
