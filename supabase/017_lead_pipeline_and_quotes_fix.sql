-- ============================================================
-- 1) Wielkość firmy na leadzie (z formularza Meta lub ręcznie)
-- ============================================================
alter table public.leads
  add column if not exists company_size text;

-- ============================================================
-- 2) Dwa nowe statusy pipeline: "Źle wypełniony formularz", "Pomyłka"
-- ============================================================
alter table public.leads
  drop constraint if exists leads_status_check;

alter table public.leads
  add constraint leads_status_check
    check (status in ('new', 'contacted', 'offer_sent', 'negotiation', 'won', 'lost', 'wrong_form', 'mistake'));

-- ============================================================
-- 3) Oferty (quotes) — reasercja w pełni otwartych polityk RLS,
--    żeby wszyscy zalogowani użytkownicy widzieli te same oferty
--    (naprawia rozjazd, jeśli 011_quotes.sql nie był wcześniej wklejony
--    albo polityka została ręcznie zmieniona w panelu Supabase)
-- ============================================================
drop policy if exists "quotes_all" on public.quotes;
create policy "quotes_all" on public.quotes for all using (true) with check (true);

drop policy if exists "quote_items_all" on public.quote_line_items;
create policy "quote_items_all" on public.quote_line_items for all using (true) with check (true);
