-- ============================================================
-- AutomationHub — Katalog usług (wewnętrzny cennik)
-- ============================================================

create table public.services (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text,
  unit text not null default 'projekt'
    check (unit in ('szt', 'godz', 'mies', 'projekt', 'dzień')),
  unit_price_net numeric(12,2) not null,
  vat_rate integer not null default 23
    check (vat_rate in (0, 5, 8, 23)),
  is_active boolean not null default true,
  position integer not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create trigger trg_services_updated_at
  before update on public.services
  for each row execute function update_updated_at_column();

alter table public.services enable row level security;
create policy "services_all" on public.services for all using (true) with check (true);

-- Seed z obecnego SERVICES_CATALOG z kodu
insert into public.services (name, unit, unit_price_net, vat_rate, position) values
  ('Automatyzacja procesów',     'projekt', 4500, 23, 0),
  ('Integracja systemów',        'projekt', 3200, 23, 1),
  ('Konsultacje',                'godz',     350, 23, 2),
  ('Wdrożenie',                  'projekt', 6000, 23, 3),
  ('Wsparcie techniczne',        'mies',    2800, 23, 4),
  ('Analiza procesów',           'projekt', 1800, 23, 5),
  ('Tworzenie stron WWW',        'projekt', 5500, 23, 6),
  ('Marketing automation',       'mies',    2200, 23, 7),
  ('Szkolenie zespołu',          'godz',     450, 23, 8),
  ('Audyt systemów IT',          'projekt', 2500, 23, 9),
  ('Opieka SEO',                 'mies',    1500, 23, 10),
  ('Zarządzanie kampaniami Ads', 'mies',    1200, 23, 11);
