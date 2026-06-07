-- Email Campaigns v2: stop conditions, delivery/click stats, events log
-- Run this in Supabase Dashboard → SQL Editor

ALTER TABLE email_campaigns
  ADD COLUMN IF NOT EXISTS stop_on_open    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stop_on_reply   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS delivered_count int     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS clicked_count   int     NOT NULL DEFAULT 0;

-- Expand allowed statuses for sends
ALTER TABLE email_campaign_sends
  DROP CONSTRAINT IF EXISTS email_campaign_sends_status_check;
ALTER TABLE email_campaign_sends
  ADD CONSTRAINT email_campaign_sends_status_check
  CHECK (status IN ('sent','delivered','opened','clicked','replied','bounced','failed'));

-- Lightweight event log (one row per Resend webhook event or tracking hit)
CREATE TABLE IF NOT EXISTS email_campaign_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id  uuid NOT NULL REFERENCES email_campaigns(id) ON DELETE CASCADE,
  send_id      uuid REFERENCES email_campaign_sends(id) ON DELETE SET NULL,
  recipient_id uuid REFERENCES email_campaign_recipients(id) ON DELETE SET NULL,
  event_type   text NOT NULL,  -- delivered | opened | clicked | replied | bounced | unsubscribed | complained
  data         jsonb,
  occurred_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE email_campaign_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "events_read_own" ON email_campaign_events
  FOR SELECT TO authenticated
  USING (campaign_id IN (
    SELECT id FROM email_campaigns WHERE created_by = current_employee_id()
  ));

CREATE POLICY "events_insert_service" ON email_campaign_events
  FOR INSERT TO service_role WITH CHECK (true);
