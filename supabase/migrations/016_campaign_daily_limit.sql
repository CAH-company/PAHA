-- Dodaj limit dzienny wysyłek per kampania
ALTER TABLE email_campaigns
  ADD COLUMN IF NOT EXISTS daily_limit int NOT NULL DEFAULT 50;
