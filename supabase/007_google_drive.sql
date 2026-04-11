-- ============================================================
-- AutomationHub — Google Drive onboarding dla klientów
-- Uruchom w Supabase SQL Editor
-- ============================================================

-- Dodaj kolumny Drive do klientów
alter table public.clients
  add column if not exists google_drive_folder_id     text,
  add column if not exists google_drive_shared_folder_id text,
  add column if not exists onboarding_done_at         timestamptz;

-- Dodaj klucz Service Account do app_settings
insert into public.app_settings (key, value) values
  ('google_service_account_email', null)
on conflict (key) do nothing;
