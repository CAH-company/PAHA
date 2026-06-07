-- Email Campaigns: Lemlist-style outreach sequences
-- Run this in Supabase Dashboard → SQL Editor

CREATE TABLE IF NOT EXISTS email_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  from_name text NOT NULL DEFAULT 'AutomationHub',
  from_email text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed')),
  recipient_filter jsonb NOT NULL DEFAULT '{"type":"all"}',
  total_recipients int NOT NULL DEFAULT 0,
  sent_count int NOT NULL DEFAULT 0,
  opened_count int NOT NULL DEFAULT 0,
  replied_count int NOT NULL DEFAULT 0,
  bounced_count int NOT NULL DEFAULT 0,
  created_by uuid REFERENCES employees(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_campaign_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES email_campaigns(id) ON DELETE CASCADE,
  step_order int NOT NULL,
  subject text NOT NULL,
  body_html text NOT NULL,
  delay_days int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, step_order)
);

CREATE TABLE IF NOT EXISTS email_campaign_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES email_campaigns(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','completed','bounced','replied','unsubscribed')),
  current_step int NOT NULL DEFAULT 0,
  next_send_at timestamptz,
  last_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, lead_id)
);

CREATE TABLE IF NOT EXISTS email_campaign_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES email_campaigns(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES email_campaign_recipients(id) ON DELETE CASCADE,
  step_id uuid NOT NULL REFERENCES email_campaign_steps(id),
  step_order int NOT NULL,
  lead_id uuid NOT NULL REFERENCES leads(id),
  sent_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent','opened','bounced','failed')),
  resend_id text
);

-- Enable RLS
ALTER TABLE email_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_campaign_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_campaign_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_campaign_sends ENABLE ROW LEVEL SECURITY;

-- Helper: resolve employee id for current auth user
-- Used in RLS policies to avoid repeating the subquery
CREATE OR REPLACE FUNCTION current_employee_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT id FROM employees WHERE user_id = auth.uid() LIMIT 1;
$$;

-- email_campaigns: owner can do everything, others can read (internal team visibility)
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

-- Child tables: access scoped to campaigns owned by the user
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
