-- Paid labor estimates and catalog signups stay on contact_leads.
ALTER TABLE contact_leads
  ADD COLUMN estimate_fee_cents INTEGER
    CHECK (estimate_fee_cents IS NULL OR (estimate_fee_cents >= 50 AND estimate_fee_cents <= 100000)),
  ADD COLUMN estimate_fee_status TEXT NOT NULL DEFAULT 'none'
    CHECK (estimate_fee_status IN ('none', 'checkout', 'paid')),
  ADD COLUMN stripe_checkout_session_id TEXT,
  ADD COLUMN stripe_payment_intent_id TEXT,
  ADD COLUMN estimate_fee_paid_at TIMESTAMPTZ,
  ADD COLUMN estimate_fee_notified_at TIMESTAMPTZ,
  ADD COLUMN customer_notified_at TIMESTAMPTZ,
  ADD COLUMN planner_inputs JSONB;

CREATE UNIQUE INDEX IF NOT EXISTS contact_leads_stripe_session_uidx
  ON contact_leads (stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;

CREATE OR REPLACE VIEW lead_business_performance AS
SELECT submission_id, created_at, service, source,
       ad_ids->>'gclid' AS gclid, ad_ids->>'gbraid' AS gbraid,
       ad_ids->>'wbraid' AS wbraid, ad_ids->>'utm_source' AS utm_source,
       ad_ids->>'utm_medium' AS utm_medium, ad_ids->>'utm_campaign' AS utm_campaign,
       contact_status, qualification, quote_amount, booked_job,
       estimate_fee_cents, estimate_fee_status, estimate_fee_paid_at
FROM contact_leads
WHERE delivered_email AND NOT is_test
  AND qualification <> 'spam'
  AND NOT EXISTS (SELECT 1 FROM lead_test_exclusions e
                  WHERE e.submission_id = contact_leads.submission_id);
