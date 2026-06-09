-- ============================================================
-- Email Campaigns — clean reset
-- Uruchom w Supabase Dashboard → SQL Editor
-- Bezpiecznie: DROP IF EXISTS + recreate
-- ============================================================

-- 1. Drop tables (odwrotna kolejność zależności)
DROP TABLE IF EXISTS email_campaign_events    CASCADE;
DROP TABLE IF EXISTS email_campaign_sends     CASCADE;
DROP TABLE IF EXISTS email_campaign_recipients CASCADE;
DROP TABLE IF EXISTS email_campaign_steps     CASCADE;
DROP TABLE IF EXISTS email_campaigns          CASCADE;

-- 2. Helper function (idempotent)
CREATE OR REPLACE FUNCTION current_employee_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT id FROM employees WHERE user_id = auth.uid() LIMIT 1;
$$;

-- 3. Główna tabela kampanii
CREATE TABLE email_campaigns (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text        NOT NULL,
  from_name        text        NOT NULL DEFAULT 'AutomationHub',
  from_email       text        NOT NULL,
  signature_html   text,
  status           text        NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'paused', 'completed')),
  stop_on_open     boolean     NOT NULL DEFAULT false,
  stop_on_reply    boolean     NOT NULL DEFAULT false,
  send_window      jsonb,
  recipient_filter jsonb       NOT NULL DEFAULT '{"type":"all"}',
  total_recipients int         NOT NULL DEFAULT 0,
  sent_count       int         NOT NULL DEFAULT 0,
  delivered_count  int         NOT NULL DEFAULT 0,
  opened_count     int         NOT NULL DEFAULT 0,
  clicked_count    int         NOT NULL DEFAULT 0,
  replied_count    int         NOT NULL DEFAULT 0,
  bounced_count    int         NOT NULL DEFAULT 0,
  created_by       uuid        REFERENCES employees(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- 4. Kroki sekwencji
CREATE TABLE email_campaign_steps (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid        NOT NULL REFERENCES email_campaigns(id) ON DELETE CASCADE,
  step_order  int         NOT NULL,
  subject     text        NOT NULL,
  body_html   text        NOT NULL,
  delay_days  int         NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, step_order)
);

-- 5. Odbiorcy kampanii
CREATE TABLE email_campaign_recipients (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid        NOT NULL REFERENCES email_campaigns(id) ON DELETE CASCADE,
  lead_id     uuid        NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  status      text        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','active','completed','bounced','replied','unsubscribed')),
  current_step int        NOT NULL DEFAULT 0,
  next_send_at timestamptz,
  last_sent_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, lead_id)
);

-- 6. Log wysyłek
CREATE TABLE email_campaign_sends (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id  uuid        NOT NULL REFERENCES email_campaigns(id) ON DELETE CASCADE,
  recipient_id uuid        NOT NULL REFERENCES email_campaign_recipients(id) ON DELETE CASCADE,
  step_id      uuid        NOT NULL REFERENCES email_campaign_steps(id),
  step_order   int         NOT NULL,
  lead_id      uuid        NOT NULL REFERENCES leads(id),
  sent_at      timestamptz NOT NULL DEFAULT now(),
  status       text        NOT NULL DEFAULT 'sent'
    CHECK (status IN ('sent','delivered','opened','clicked','replied','bounced','failed')),
  resend_id    text
);

-- 7. Log zdarzeń (webhooks Resend, tracking)
CREATE TABLE email_campaign_events (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id  uuid        NOT NULL REFERENCES email_campaigns(id) ON DELETE CASCADE,
  send_id      uuid        REFERENCES email_campaign_sends(id) ON DELETE SET NULL,
  recipient_id uuid        REFERENCES email_campaign_recipients(id) ON DELETE SET NULL,
  event_type   text        NOT NULL,
  data         jsonb,
  occurred_at  timestamptz NOT NULL DEFAULT now()
);

-- 8. RLS
ALTER TABLE email_campaigns          ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_campaign_steps     ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_campaign_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_campaign_sends     ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_campaign_events    ENABLE ROW LEVEL SECURITY;

-- 9. Policies — email_campaigns
CREATE POLICY "campaigns_read_all" ON email_campaigns
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "campaigns_insert_own" ON email_campaigns
  FOR INSERT TO authenticated
  WITH CHECK (created_by = current_employee_id());

CREATE POLICY "campaigns_update_own" ON email_campaigns
  FOR UPDATE TO authenticated
  USING (created_by = current_employee_id())
  WITH CHECK (created_by = current_employee_id());

CREATE POLICY "campaigns_delete_own" ON email_campaigns
  FOR DELETE TO authenticated
  USING (created_by = current_employee_id());

-- 10. Policies — tabele potomne
CREATE POLICY "steps_access_own" ON email_campaign_steps
  FOR ALL TO authenticated
  USING (campaign_id IN (
    SELECT id FROM email_campaigns WHERE created_by = current_employee_id()
  ))
  WITH CHECK (campaign_id IN (
    SELECT id FROM email_campaigns WHERE created_by = current_employee_id()
  ));

CREATE POLICY "recipients_access_own" ON email_campaign_recipients
  FOR ALL TO authenticated
  USING (campaign_id IN (
    SELECT id FROM email_campaigns WHERE created_by = current_employee_id()
  ))
  WITH CHECK (campaign_id IN (
    SELECT id FROM email_campaigns WHERE created_by = current_employee_id()
  ));

CREATE POLICY "sends_access_own" ON email_campaign_sends
  FOR ALL TO authenticated
  USING (campaign_id IN (
    SELECT id FROM email_campaigns WHERE created_by = current_employee_id()
  ))
  WITH CHECK (campaign_id IN (
    SELECT id FROM email_campaigns WHERE created_by = current_employee_id()
  ));

CREATE POLICY "events_read_own" ON email_campaign_events
  FOR SELECT TO authenticated
  USING (campaign_id IN (
    SELECT id FROM email_campaigns WHERE created_by = current_employee_id()
  ));

CREATE POLICY "events_insert_service" ON email_campaign_events
  FOR INSERT TO service_role WITH CHECK (true);

-- 11. contact_status na leadach (idempotent)
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS contact_status text NOT NULL DEFAULT 'not_contacted'
    CHECK (contact_status IN (
      'not_contacted','in_sequence','replied','bounced','unsubscribed','meeting_booked'
    ));
