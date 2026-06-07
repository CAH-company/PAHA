-- Email Campaigns v3: send time window
-- Run this in Supabase Dashboard → SQL Editor

ALTER TABLE email_campaigns
  ADD COLUMN IF NOT EXISTS send_window jsonb DEFAULT NULL;

-- Example value:
-- {"days":[1,2,3,4,5],"from":"09:00","to":"17:00","tz":"Europe/Warsaw"}
-- days: 0=Sun 1=Mon 2=Tue 3=Wed 4=Thu 5=Fri 6=Sat
-- null = no restriction (send any time)
