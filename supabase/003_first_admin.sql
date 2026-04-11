-- ============================================================
-- AutomationHub — Utwórz pierwszego admina
-- ============================================================
-- INSTRUKCJA:
-- 1. Najpierw zarejestruj się w aplikacji (strona /login)
--    albo dodaj użytkownika ręcznie w Supabase:
--    Authentication → Users → Add user
-- 2. Skopiuj UUID nowego użytkownika z panelu Auth
-- 3. Zamień 'TWOJ_USER_ID' poniżej na skopiowany UUID
-- 4. Zamień resztę danych na swoje
-- 5. Uruchom ten skrypt w SQL Editor
-- ============================================================

insert into public.employees (
  user_id,
  name,
  email,
  position,
  role,
  is_active,
  access_crm_leads,
  access_crm_clients,
  access_accounting,
  access_marketing,
  access_operations,
  access_tasks
) values (
  'TWOJ_USER_ID',           -- ← wklej UUID z Auth
  'Twoje Imię Nazwisko',    -- ← zmień
  'twoj@email.pl',          -- ← zmień (musi być ten sam co w Auth)
  'CEO / Admin',            -- ← zmień
  'admin',
  true,
  true, true, true, true, true, true
)
on conflict (email) do update set
  user_id = excluded.user_id,
  role = 'admin';

-- Po wykonaniu tego skryptu wróć do aplikacji
-- i odśwież stronę — powinieneś zobaczyć dashboard.
