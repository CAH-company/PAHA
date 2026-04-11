-- ============================================================
-- AutomationHub — Dodaj pola netto/VAT/brutto do kosztów i przychodów
-- Uruchom w Supabase SQL Editor
-- ============================================================

-- KOSZTY
alter table public.costs
  add column if not exists amount_net numeric(12,2),
  add column if not exists vat_rate  numeric(5,2) default 23,
  add column if not exists vat_amount numeric(12,2);

-- Uzupełnij istniejące rekordy: jeśli amount_net null, traktuj dotychczasową kwotę jako brutto
update public.costs
set
  vat_rate   = 23,
  amount_net = round(amount / 1.23, 2),
  vat_amount = amount - round(amount / 1.23, 2)
where amount_net is null;

-- PRZYCHODY
alter table public.revenues
  add column if not exists amount_net  numeric(12,2),
  add column if not exists vat_rate    numeric(5,2) default 23,
  add column if not exists vat_amount  numeric(12,2);

update public.revenues
set
  vat_rate   = 23,
  amount_net = round(amount / 1.23, 2),
  vat_amount = amount - round(amount / 1.23, 2)
where amount_net is null;
