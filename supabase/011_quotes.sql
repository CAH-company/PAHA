-- ============================================================
-- AutomationHub — Oferty i pozycje ofert
-- ============================================================

create table public.quotes (
  id uuid primary key default uuid_generate_v4(),
  number text not null,
  title text not null,
  client_name text not null,
  client_id uuid references public.clients(id) on delete set null,
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'accepted', 'rejected', 'expired')),
  currency text not null default 'PLN'
    check (currency in ('PLN', 'EUR', 'USD')),
  discount_percent numeric(5,2) not null default 0,
  notes text,
  total_net numeric(12,2) not null default 0,
  total_vat numeric(12,2) not null default 0,
  total_gross numeric(12,2) not null default 0,
  valid_until date,
  created_by uuid references public.employees(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.quote_line_items (
  id uuid primary key default uuid_generate_v4(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  position integer not null default 0,
  name text not null,
  description text,
  quantity numeric(10,3) not null default 1,
  unit text not null default 'szt',
  unit_price_net numeric(12,2) not null,
  vat_rate integer not null default 23,
  amount_net numeric(12,2) not null,
  vat_amount numeric(12,2) not null,
  amount_gross numeric(12,2) not null
);

create index idx_quotes_status on public.quotes(status);
create index idx_quotes_created_at on public.quotes(created_at desc);
create index idx_quote_items_quote_id on public.quote_line_items(quote_id);

create trigger trg_quotes_updated_at
  before update on public.quotes
  for each row execute function public.set_updated_at();

alter table public.quotes enable row level security;
alter table public.quote_line_items enable row level security;

create policy "quotes_all" on public.quotes for all using (true) with check (true);
create policy "quote_items_all" on public.quote_line_items for all using (true) with check (true);
