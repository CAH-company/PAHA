-- ============================================================
-- KATEGORIE ZADAŃ
-- ============================================================

alter table public.tasks
  add column if not exists category text default 'general'
    check (category in ('general', 'client', 'onboarding', 'documentation', 'marketing', 'hr', 'operations'));

comment on column public.tasks.category is 'Kategoria zadania: general=firmowe, client=klienckie, onboarding, documentation, marketing, hr, operations';
