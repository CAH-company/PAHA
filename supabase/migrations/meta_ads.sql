-- Meta Ads: daily campaign metrics fetched from Facebook Graph API
-- Run this in Supabase Dashboard → SQL Editor

CREATE TABLE IF NOT EXISTS meta_ads_data (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date           date NOT NULL,
  campaign_id    text NOT NULL,
  campaign_name  text NOT NULL,
  status         text,
  objective      text,
  impressions    int          NOT NULL DEFAULT 0,
  clicks         int          NOT NULL DEFAULT 0,
  spend          numeric(12,2) NOT NULL DEFAULT 0,
  reach          int          NOT NULL DEFAULT 0,
  frequency      numeric(6,3) NOT NULL DEFAULT 0,
  ctr            numeric(8,4) NOT NULL DEFAULT 0,
  cpm            numeric(10,2) NOT NULL DEFAULT 0,
  cpc            numeric(10,2) NOT NULL DEFAULT 0,
  conversions    int          NOT NULL DEFAULT 0,
  conversion_value numeric(12,2) NOT NULL DEFAULT 0,
  fetched_at     timestamptz  NOT NULL DEFAULT now(),
  UNIQUE(date, campaign_id)
);

ALTER TABLE meta_ads_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "meta_ads_read" ON meta_ads_data
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "meta_ads_write_service" ON meta_ads_data
  FOR ALL TO service_role USING (true) WITH CHECK (true);
